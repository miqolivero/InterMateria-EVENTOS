import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { existeEnEmpresa } from "../utils/consultas.js";
import {
  esIdValido,
  esEnteroPositivo,
  esImporteValido
} from "../utils/validaciones.js";

// Presupuestos: las versiones de la propuesta que se le hace al cliente.
//
// La tabla presupuestos NO tiene id_empresa: un presupuesto es de la empresa
// de su solicitud. Por eso TODAS las consultas entran por
// JOIN solicitudes s ... AND s.id_empresa = <empresa del token>. Si el
// presupuesto es de otra empresa, la consulta no lo encuentra y es un 404.
//
// Reglas de negocio que se aplican aca (ver CLAUDE.md de la raiz):
// - Regla 2: importe_total = suma de importe_cliente del detalle. Lo recalcula
//   la API en la misma transaccion que modifica el detalle; nunca viene del body.
// - Regla 3: solo se edita en 'borrador'. Para cambiar uno presentado se crea
//   una nueva version que copia el detalle.

const MENSAJES = {
  noEncontrado: "Presupuesto no encontrado",
  solicitudNoEncontrada: "Solicitud no encontrada",
  renglonNoEncontrado: "Renglon no encontrado",
  yaTienePresupuestos: "La solicitud ya tiene presupuestos. Usa 'nueva version'",
  obligatoriosDetalle: "El servicio y el importe al cliente son obligatorios",
  importesNegativos: "Los importes no pueden ser negativos",
  cantidadInvalida: "La cantidad tiene que ser mayor a 0",
  servicioInvalido: "El servicio no existe o esta inactivo",
  proveedorNoOfrece: "El proveedor no ofrece ese servicio",
  validezInvalida: "La validez tiene que ser un numero de dias mayor a 0",
  noBorrador: "Solo se puede modificar un presupuesto en borrador",
  sinRenglones: "No se puede presentar un presupuesto sin renglones",
  noPresentable: "Solo se puede presentar un presupuesto en borrador",
  noVersionable:
    "Solo se puede crear una nueva version desde un presupuesto presentado o rechazado",
  yaHayBorrador: "Ya hay una version en borrador para esta solicitud",
  noEsUltima: "Solo se puede crear una nueva version desde la ultima version",
  noRechazable: "Solo se puede rechazar un presupuesto presentado"
};

const solicitudCerrada = (estado) =>
  `La solicitud esta ${estado} y no admite presupuestos`;

// Mientras la solicitud esta en uno de estos estados se sigue negociando con
// el cliente. Cancelada, rechazada o aceptada ya no admite propuestas nuevas.
const ESTADOS_SOLICITUD_ABIERTA = ["pendiente", "presupuestada"];

// Vacio = no vino. Se usa para los campos opcionales: 0 es un valor valido.
const vacio = (valor) => valor === undefined || valor === null || valor === "";

// El objeto Presupuesto completo de docs/API.md, en una sola consulta. Lo
// devuelven todos los endpoints del recurso, asi el front siempre recibe los
// totales actualizados.
//
// - total_costo se suma en un LATERAL, una vez, y total_margen sale de
//   importe_total - total_costo (los calculos van en el SQL).
// - editable es true solo en borrador (regla 3).
// - solicitud, detalle y versiones se arman con json_build_object/json_agg,
//   igual que los servicios de un proveedor. COALESCE deja [] cuando no hay
//   renglones, nunca null.
// - El proveedor del renglon va con LEFT JOIN porque es opcional (un servicio
//   que da el propio salon no tiene proveedor).
const SELECT_PRESUPUESTO = `
  SELECT p.id_presupuesto, p.id_solicitud, p.numero_version, p.fecha_emision,
         p.validez_dias, p.observaciones, p.estado, p.importe_total,
         t.total_costo,
         p.importe_total - t.total_costo AS total_margen,
         p.estado = 'borrador' AS editable,
         json_build_object(
           'id_solicitud', s.id_solicitud,
           'nombre_cliente', c.nombre || ' ' || c.apellido,
           'nombre_tipo_evento', te.nombre,
           'fecha_evento_prevista', s.fecha_evento_prevista,
           'cantidad_asistentes', s.cantidad_asistentes,
           'estado', s.estado
         ) AS solicitud,
         COALESCE(
           (SELECT json_agg(json_build_object(
                     'id_detalle', d.id_detalle,
                     'id_servicio', d.id_servicio,
                     'nombre_servicio', sv.nombre,
                     'id_proveedor', d.id_proveedor,
                     'nombre_proveedor', pr.razon_social,
                     'descripcion', d.descripcion,
                     'cantidad', d.cantidad,
                     'costo_proveedor', d.costo_proveedor,
                     'importe_cliente', d.importe_cliente,
                     'margen', d.importe_cliente - d.costo_proveedor)
                   ORDER BY d.id_detalle)
            FROM detalle_presupuesto d
            JOIN servicios sv ON sv.id_servicio = d.id_servicio
            LEFT JOIN proveedores pr ON pr.id_proveedor = d.id_proveedor
            WHERE d.id_presupuesto = p.id_presupuesto),
           '[]'
         ) AS detalle,
         (SELECT json_agg(json_build_object(
                   'id_presupuesto', v.id_presupuesto,
                   'numero_version', v.numero_version,
                   'estado', v.estado)
                 ORDER BY v.numero_version)
          FROM presupuestos v
          WHERE v.id_solicitud = p.id_solicitud) AS versiones
  FROM presupuestos p
  JOIN solicitudes s ON s.id_solicitud = p.id_solicitud
  JOIN clientes c ON c.id_cliente = s.id_cliente
  JOIN tipos_eventos te ON te.id_tipo_evento = s.id_tipo_evento
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(costo_proveedor), 0) AS total_costo
    FROM detalle_presupuesto
    WHERE id_presupuesto = p.id_presupuesto
  ) t
  WHERE p.id_presupuesto = $1 AND s.id_empresa = $2`;

const buscarPresupuesto = async (ejecutor, idPresupuesto, idEmpresa) => {
  const resultado = await ejecutor.query(SELECT_PRESUPUESTO, [
    idPresupuesto,
    idEmpresa
  ]);

  return resultado.rows[0] ?? null;
};

// Trae el estado del presupuesto y el de su solicitud, bloqueando la fila del
// presupuesto hasta que termine la transaccion (FOR UPDATE OF p).
//
// Por que el bloqueo: entre "chequear que este en borrador" y "modificar el
// detalle" otro pedido podria presentarlo. Con la fila bloqueada, ese otro
// pedido espera a que esta transaccion termine, y despues ve el estado nuevo.
const bloquearPresupuesto = async (client, idPresupuesto, idEmpresa) => {
  const resultado = await client.query(
    `SELECT p.id_presupuesto, p.id_solicitud, p.numero_version, p.estado,
            s.estado AS estado_solicitud
     FROM presupuestos p
     JOIN solicitudes s ON s.id_solicitud = p.id_solicitud
     WHERE p.id_presupuesto = $1 AND s.id_empresa = $2
     FOR UPDATE OF p`,
    [idPresupuesto, idEmpresa]
  );

  return resultado.rows[0] ?? null;
};

// Regla 2: el total es SIEMPRE la suma del detalle. Se llama en la misma
// transaccion que modifica un renglon: si algo falla, no queda un total
// distinto del detalle.
const recalcularTotal = async (client, idPresupuesto) => {
  await client.query(
    `UPDATE presupuestos
     SET importe_total = (SELECT COALESCE(SUM(importe_cliente), 0)
                          FROM detalle_presupuesto
                          WHERE id_presupuesto = $1)
     WHERE id_presupuesto = $1`,
    [idPresupuesto]
  );
};

// Cuando un UPDATE condicional no modifica nada, distingue entre 404 (no
// existe o es de otra empresa) y 409 (estado que no lo permite).
const estadoPresupuesto = async (idPresupuesto, idEmpresa) => {
  const resultado = await pool.query(
    `SELECT p.estado FROM presupuestos p
     JOIN solicitudes s ON s.id_solicitud = p.id_solicitud
     WHERE p.id_presupuesto = $1 AND s.id_empresa = $2`,
    [idPresupuesto, idEmpresa]
  );

  return resultado.rows[0]?.estado ?? null;
};

// validez_dias es opcional, pero si viene tiene que ser un entero mayor a 0
const validezInvalida = (validezDias) =>
  !vacio(validezDias) && !esEnteroPositivo(validezDias);

// ---------------------------------------------------------------------------
// Validaciones de un renglon del detalle
// ---------------------------------------------------------------------------

// Lo que se puede validar sin ir a la base: obligatorios y formatos. Va antes
// que todo para no abrir una transaccion por un body mal armado.
const validarFormatoRenglon = (body) => {
  const { id_servicio, cantidad, costo_proveedor, importe_cliente } = body;

  if (vacio(id_servicio) || vacio(importe_cliente)) {
    return MENSAJES.obligatoriosDetalle;
  }

  // costo_proveedor es opcional (por defecto 0), pero si viene se valida igual
  if (
    !esImporteValido(importe_cliente) ||
    (!vacio(costo_proveedor) && !esImporteValido(costo_proveedor))
  ) {
    return MENSAJES.importesNegativos;
  }

  if (!vacio(cantidad) && !esEnteroPositivo(cantidad)) {
    return MENSAJES.cantidadInvalida;
  }

  return null;
};

// Lo que necesita la base: el servicio tiene que ser de la empresa y estar
// activo, y el proveedor (si viene) tiene que ser de la empresa, estar activo
// y OFRECER ese servicio (proveedores_x_servicio). Sin esto se podria asignar
// el fotografo al catering, o un proveedor de otra empresa.
const validarRenglonEnEmpresa = async (client, body, idEmpresa) => {
  const { id_servicio, id_proveedor } = body;

  const servicioOk =
    esIdValido(id_servicio) &&
    (await existeEnEmpresa(client, "servicios", "id_servicio", id_servicio, idEmpresa, {
      soloActivos: true
    }));
  if (!servicioOk) {
    return MENSAJES.servicioInvalido;
  }

  if (vacio(id_proveedor)) {
    return null;
  }

  if (!esIdValido(id_proveedor)) {
    return MENSAJES.proveedorNoOfrece;
  }

  // Un proveedor inactivo se trata como uno que no ofrece el servicio: no se
  // le asignan trabajos nuevos.
  const ofrece = await client.query(
    `SELECT 1 FROM proveedores_x_servicio pxs
     JOIN proveedores pr ON pr.id_proveedor = pxs.id_proveedor
     WHERE pxs.id_proveedor = $1 AND pxs.id_servicio = $2
       AND pr.id_empresa = $3 AND pr.activo = TRUE`,
    [id_proveedor, id_servicio, idEmpresa]
  );

  return ofrece.rows.length > 0 ? null : MENSAJES.proveedorNoOfrece;
};

// Los valores del renglon listos para el INSERT/UPDATE, con los defaults del
// contrato: cantidad 1 y costo 0.
const valoresRenglon = (body) => [
  body.id_servicio,
  vacio(body.id_proveedor) ? null : body.id_proveedor,
  body.descripcion ?? null,
  vacio(body.cantidad) ? 1 : body.cantidad,
  vacio(body.costo_proveedor) ? 0 : body.costo_proveedor,
  body.importe_cliente
];

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// POST /api/solicitudes/:id/presupuestos
// Crea la version 1 en borrador, sin renglones.
export const crearPresupuesto = async (req, res) => {
  const { validez_dias, observaciones } = req.body ?? {};
  const idEmpresa = req.usuario.id_empresa;

  if (validezInvalida(validez_dias)) {
    return res.status(400).json({ mensaje: MENSAJES.validezInvalida });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Se bloquea la solicitud: si llegan dos pedidos a la vez, el segundo
    // espera y despues ve que ya hay una version. Sin el bloqueo los dos
    // crearian una "version 1" y chocarian con el UNIQUE de la base.
    const solicitud = await client.query(
      `SELECT estado FROM solicitudes
       WHERE id_solicitud = $1 AND id_empresa = $2
       FOR UPDATE`,
      [req.params.id, idEmpresa]
    );

    if (solicitud.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.solicitudNoEncontrada });
    }

    // El estado se chequea antes que las versiones: a una solicitud aceptada
    // no tiene sentido decirle "usa nueva version".
    const { estado } = solicitud.rows[0];
    if (!ESTADOS_SOLICITUD_ABIERTA.includes(estado)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: solicitudCerrada(estado) });
    }

    const versiones = await client.query(
      "SELECT 1 FROM presupuestos WHERE id_solicitud = $1",
      [req.params.id]
    );

    if (versiones.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.yaTienePresupuestos });
    }

    // numero_version (1), fecha_emision (hoy), importe_total (0) y estado
    // ('borrador') los pone el DEFAULT de la base.
    const resultado = await client.query(
      `INSERT INTO presupuestos (id_solicitud, validez_dias, observaciones)
       VALUES ($1, $2, $3)
       RETURNING id_presupuesto`,
      [req.params.id, vacio(validez_dias) ? null : validez_dias, observaciones ?? null]
    );

    const presupuesto = await buscarPresupuesto(
      client,
      resultado.rows[0].id_presupuesto,
      idEmpresa
    );

    await client.query("COMMIT");

    res.status(201).json(presupuesto);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error);
  } finally {
    client.release();
  }
};

// GET /api/presupuestos/:id
export const obtenerPresupuestoPorId = async (req, res) => {
  try {
    const presupuesto = await buscarPresupuesto(
      pool,
      req.params.id,
      req.usuario.id_empresa
    );

    if (!presupuesto) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }

    res.json(presupuesto);
  } catch (error) {
    responderError(res, error);
  }
};

// PUT /api/presupuestos/:id
// Edita la cabecera (validez y observaciones), solo en borrador. Es un solo
// UPDATE: el estado va en el WHERE, asi el chequeo y el cambio son atomicos.
export const editarPresupuesto = async (req, res) => {
  const { validez_dias, observaciones } = req.body;
  const idEmpresa = req.usuario.id_empresa;

  if (validezInvalida(validez_dias)) {
    return res.status(400).json({ mensaje: MENSAJES.validezInvalida });
  }

  try {
    const resultado = await pool.query(
      `UPDATE presupuestos p
       SET validez_dias = $1, observaciones = $2
       FROM solicitudes s
       WHERE s.id_solicitud = p.id_solicitud
         AND p.id_presupuesto = $3 AND s.id_empresa = $4
         AND p.estado = 'borrador'
       RETURNING p.id_presupuesto`,
      [
        vacio(validez_dias) ? null : validez_dias,
        observaciones ?? null,
        req.params.id,
        idEmpresa
      ]
    );

    if (resultado.rows.length === 0) {
      const estado = await estadoPresupuesto(req.params.id, idEmpresa);
      if (!estado) {
        return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
      }
      return res.status(409).json({ mensaje: MENSAJES.noBorrador });
    }

    res.json(await buscarPresupuesto(pool, req.params.id, idEmpresa));
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/presupuestos/:id/detalle
// Agrega un renglon y recalcula el total, todo en una transaccion (regla 2).
export const agregarRenglon = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;

  const errorFormato = validarFormatoRenglon(req.body);
  if (errorFormato) {
    return res.status(400).json({ mensaje: errorFormato });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const actual = await bloquearPresupuesto(client, req.params.id, idEmpresa);

    if (!actual) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }

    // Regla 3: un presupuesto presentado ya lo vio el cliente, no se toca
    if (actual.estado !== "borrador") {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.noBorrador });
    }

    const errorEmpresa = await validarRenglonEnEmpresa(client, req.body, idEmpresa);
    if (errorEmpresa) {
      await client.query("ROLLBACK");
      return res.status(400).json({ mensaje: errorEmpresa });
    }

    await client.query(
      `INSERT INTO detalle_presupuesto (id_presupuesto, id_servicio, id_proveedor,
                                        descripcion, cantidad, costo_proveedor,
                                        importe_cliente)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.params.id, ...valoresRenglon(req.body)]
    );

    await recalcularTotal(client, req.params.id);

    const presupuesto = await buscarPresupuesto(client, req.params.id, idEmpresa);

    await client.query("COMMIT");

    res.status(201).json(presupuesto);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error);
  } finally {
    client.release();
  }
};

// PUT /api/presupuestos/:id/detalle/:idDetalle
export const editarRenglon = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const { id, idDetalle } = req.params;

  const errorFormato = validarFormatoRenglon(req.body);
  if (errorFormato) {
    return res.status(400).json({ mensaje: errorFormato });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const actual = await bloquearPresupuesto(client, id, idEmpresa);

    if (!actual) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }

    if (actual.estado !== "borrador") {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.noBorrador });
    }

    // El renglon tiene que ser de ESTE presupuesto. Si no, con el id de un
    // renglon ajeno se podria modificar otro presupuesto.
    const renglon = await client.query(
      "SELECT 1 FROM detalle_presupuesto WHERE id_detalle = $1 AND id_presupuesto = $2",
      [idDetalle, id]
    );

    if (renglon.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.renglonNoEncontrado });
    }

    const errorEmpresa = await validarRenglonEnEmpresa(client, req.body, idEmpresa);
    if (errorEmpresa) {
      await client.query("ROLLBACK");
      return res.status(400).json({ mensaje: errorEmpresa });
    }

    await client.query(
      `UPDATE detalle_presupuesto
       SET id_servicio = $1,
           id_proveedor = $2,
           descripcion = $3,
           cantidad = $4,
           costo_proveedor = $5,
           importe_cliente = $6
       WHERE id_detalle = $7 AND id_presupuesto = $8`,
      [...valoresRenglon(req.body), idDetalle, id]
    );

    await recalcularTotal(client, id);

    const presupuesto = await buscarPresupuesto(client, id, idEmpresa);

    await client.query("COMMIT");

    res.json(presupuesto);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error);
  } finally {
    client.release();
  }
};

// DELETE /api/presupuestos/:id/detalle/:idDetalle
// Devuelve 200 con el presupuesto (no 204) para que el front reciba los
// totales recalculados.
export const eliminarRenglon = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const { id, idDetalle } = req.params;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const actual = await bloquearPresupuesto(client, id, idEmpresa);

    if (!actual) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }

    if (actual.estado !== "borrador") {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.noBorrador });
    }

    const borrado = await client.query(
      `DELETE FROM detalle_presupuesto
       WHERE id_detalle = $1 AND id_presupuesto = $2
       RETURNING id_detalle`,
      [idDetalle, id]
    );

    if (borrado.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.renglonNoEncontrado });
    }

    await recalcularTotal(client, id);

    const presupuesto = await buscarPresupuesto(client, id, idEmpresa);

    await client.query("COMMIT");

    res.json(presupuesto);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error);
  } finally {
    client.release();
  }
};

// PATCH /api/presupuestos/:id/presentar
// El presupuesto pasa a 'presentado' y la solicitud a 'presupuestada'. Son dos
// tablas, asi que va en una transaccion: no puede quedar un presupuesto
// presentado con la solicitud todavia 'pendiente'.
export const presentarPresupuesto = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const actual = await bloquearPresupuesto(client, req.params.id, idEmpresa);

    if (!actual) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }

    if (actual.estado !== "borrador") {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.noPresentable });
    }

    // A una solicitud cancelada o rechazada no se le presenta nada
    if (!ESTADOS_SOLICITUD_ABIERTA.includes(actual.estado_solicitud)) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ mensaje: solicitudCerrada(actual.estado_solicitud) });
    }

    const renglones = await client.query(
      "SELECT 1 FROM detalle_presupuesto WHERE id_presupuesto = $1 LIMIT 1",
      [req.params.id]
    );

    if (renglones.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ mensaje: MENSAJES.sinRenglones });
    }

    // fecha_emision pasa a ser hoy: la validez se cuenta desde que el cliente
    // recibe la propuesta, no desde que se empezo a armar el borrador.
    await client.query(
      `UPDATE presupuestos
       SET estado = 'presentado', fecha_emision = CURRENT_DATE
       WHERE id_presupuesto = $1`,
      [req.params.id]
    );

    await client.query(
      "UPDATE solicitudes SET estado = 'presupuestada' WHERE id_solicitud = $1",
      [actual.id_solicitud]
    );

    const presupuesto = await buscarPresupuesto(client, req.params.id, idEmpresa);

    await client.query("COMMIT");

    res.json(presupuesto);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error);
  } finally {
    client.release();
  }
};

// POST /api/presupuestos/:id/nueva-version
// Regla 3: copia el presupuesto y su detalle a una version nueva en borrador.
// Si la anterior estaba presentada pasa a 'reemplazado'; si estaba rechazada
// queda 'rechazado' (asi se ve en el historial que el cliente la rechazo).
//
// Son 4 escrituras (version nueva, copia del detalle, total y estado de la
// anterior): si falla cualquiera, no puede quedar una version sin detalle o
// dos versiones abiertas. Por eso va todo en una transaccion.
export const crearNuevaVersion = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const actual = await bloquearPresupuesto(client, req.params.id, idEmpresa);

    if (!actual) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }

    if (!["presentado", "rechazado"].includes(actual.estado)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.noVersionable });
    }

    if (!ESTADOS_SOLICITUD_ABIERTA.includes(actual.estado_solicitud)) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ mensaje: solicitudCerrada(actual.estado_solicitud) });
    }

    // Se bloquea tambien la solicitud: dos "nueva version" a la vez desde
    // distintas versiones calcularian el mismo numero_version.
    await client.query(
      "SELECT 1 FROM solicitudes WHERE id_solicitud = $1 FOR UPDATE",
      [actual.id_solicitud]
    );

    const versiones = await client.query(
      `SELECT MAX(numero_version) AS ultima,
              BOOL_OR(estado = 'borrador') AS hay_borrador
       FROM presupuestos
       WHERE id_solicitud = $1`,
      [actual.id_solicitud]
    );

    const { ultima, hay_borrador } = versiones.rows[0];

    // Primero el borrador: es el caso mas comun (alguien aprieta "nueva
    // version" en la v1 cuando la v2 ya se esta armando) y el mensaje le dice
    // exactamente que pasa.
    if (hay_borrador) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.yaHayBorrador });
    }

    // Solo desde la ultima version. Si no, desde una v1 rechazada se podria
    // crear una v3 mientras la v2 sigue presentada: dos versiones abiertas.
    if (actual.numero_version !== ultima) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.noEsUltima });
    }

    // La cabecera se copia de la anterior. fecha_emision (hoy) y estado
    // (borrador) los pone el DEFAULT.
    const nueva = await client.query(
      `INSERT INTO presupuestos (id_solicitud, numero_version, validez_dias,
                                 observaciones)
       SELECT id_solicitud, $2, validez_dias, observaciones
       FROM presupuestos
       WHERE id_presupuesto = $1
       RETURNING id_presupuesto`,
      [req.params.id, ultima + 1]
    );

    const idNueva = nueva.rows[0].id_presupuesto;

    // La copia del detalle es un solo INSERT ... SELECT, sin traer los
    // renglones a JavaScript.
    await client.query(
      `INSERT INTO detalle_presupuesto (id_presupuesto, id_servicio, id_proveedor,
                                        descripcion, cantidad, costo_proveedor,
                                        importe_cliente)
       SELECT $2, id_servicio, id_proveedor, descripcion, cantidad,
              costo_proveedor, importe_cliente
       FROM detalle_presupuesto
       WHERE id_presupuesto = $1
       ORDER BY id_detalle`,
      [req.params.id, idNueva]
    );

    await recalcularTotal(client, idNueva);

    if (actual.estado === "presentado") {
      await client.query(
        "UPDATE presupuestos SET estado = 'reemplazado' WHERE id_presupuesto = $1",
        [req.params.id]
      );
    }

    const presupuesto = await buscarPresupuesto(client, idNueva, idEmpresa);

    await client.query("COMMIT");

    res.status(201).json(presupuesto);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error);
  } finally {
    client.release();
  }
};

// PATCH /api/presupuestos/:id/rechazar
// De presentado a rechazado. La solicitud no cambia: sigue 'presupuestada',
// porque se le puede hacer otra version. Un solo UPDATE condicional.
export const rechazarPresupuesto = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;

  try {
    const resultado = await pool.query(
      `UPDATE presupuestos p
       SET estado = 'rechazado'
       FROM solicitudes s
       WHERE s.id_solicitud = p.id_solicitud
         AND p.id_presupuesto = $1 AND s.id_empresa = $2
         AND p.estado = 'presentado'
       RETURNING p.id_presupuesto`,
      [req.params.id, idEmpresa]
    );

    if (resultado.rows.length === 0) {
      const estado = await estadoPresupuesto(req.params.id, idEmpresa);
      if (!estado) {
        return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
      }
      return res.status(409).json({ mensaje: MENSAJES.noRechazable });
    }

    res.json(await buscarPresupuesto(pool, req.params.id, idEmpresa));
  } catch (error) {
    responderError(res, error);
  }
};
