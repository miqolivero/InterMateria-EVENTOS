import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { existeEnEmpresa } from "../utils/consultas.js";
import { esIdValido, esFechaValida } from "../utils/validaciones.js";

// Solicitudes: el pedido inicial del cliente, antes de cualquier presupuesto.
// Como todo el sistema es multitenant, TODAS las consultas filtran por
// s.id_empresa = req.usuario.id_empresa, que sale del token.

const MENSAJES = {
  noEncontrada: "Solicitud no encontrada",
  obligatorios:
    "El cliente, el tipo de evento, la fecha y la cantidad de asistentes son obligatorios",
  clienteInvalido: "El cliente no existe o esta inactivo",
  tipoEventoInvalido: "El tipo de evento no existe o esta inactivo",
  cantidadInvalida: "La cantidad de asistentes tiene que ser mayor a 0",
  fechaPasada: "La fecha del evento no puede ser anterior a hoy",
  noEditable: "Solo se puede editar una solicitud pendiente o presupuestada",
  estadoInvalido: "Estado invalido"
};

// Las unicas transiciones que se hacen desde este recurso. Pasar a
// 'presupuestada' o 'aceptada' lo hacen los presupuestos (fases 4 y 5),
// porque dependen de lo que pase con ellos.
const ESTADOS_DESTINO = ["cancelada", "rechazada"];

// Mientras la solicitud esta en uno de estos estados todavia se esta
// negociando, asi que se puede editar o cerrar. Despues ya no.
const ESTADOS_ABIERTOS = ["pendiente", "presupuestada"];

// Las columnas del objeto Solicitud, en el orden de docs/API.md. Se escriben
// una sola vez para que el listado, el POST, el PUT y el PATCH devuelvan
// exactamente los mismos campos.
//
// - nombre_cliente se arma en el SQL concatenando nombre y apellido.
// - id_evento sale de un LEFT JOIN: si la solicitud todavia no tiene evento,
//   el JOIN no encuentra fila y queda en null (con un JOIN comun la solicitud
//   desapareceria del listado).
const COLUMNAS = `
  s.id_solicitud, s.id_cliente,
  c.nombre || ' ' || c.apellido AS nombre_cliente,
  s.id_tipo_evento, te.nombre AS nombre_tipo_evento,
  s.fecha_solicitud, s.fecha_evento_prevista, s.cantidad_asistentes,
  s.sede_prevista, s.preferencias, s.estado,
  e.id_evento`;

const FROM_SOLICITUD = `
  FROM solicitudes s
  JOIN clientes c ON c.id_cliente = s.id_cliente
  JOIN tipos_eventos te ON te.id_tipo_evento = s.id_tipo_evento
  LEFT JOIN eventos e ON e.id_solicitud = s.id_solicitud`;

// Devuelve la Solicitud en el formato del listado, o null si no existe o es de
// otra empresa. Se usa despues de crear o editar: el INSERT/UPDATE solo
// devuelve las columnas de la tabla, y el contrato pide tambien los nombres
// del cliente y del tipo de evento.
const buscarSolicitud = async (idSolicitud, idEmpresa) => {
  const resultado = await pool.query(
    `SELECT ${COLUMNAS} ${FROM_SOLICITUD}
     WHERE s.id_solicitud = $1 AND s.id_empresa = $2`,
    [idSolicitud, idEmpresa]
  );

  return resultado.rows[0] ?? null;
};

// Validaciones comunes del POST y del PUT ("mismo body y mismas validaciones"
// segun el contrato). Devuelve el mensaje de error, o null si todo esta bien.
const validarSolicitud = async (body, idEmpresa) => {
  const { id_cliente, id_tipo_evento, fecha_evento_prevista, cantidad_asistentes } =
    body;

  // Se compara contra null/"" y no con !valor: una cantidad 0 tiene que
  // responder "mayor a 0", no "es obligatoria". Una fecha mal escrita cuenta
  // como fecha faltante.
  const faltaAlguno = [id_cliente, id_tipo_evento, cantidad_asistentes].some(
    (valor) => valor === undefined || valor === null || valor === ""
  );

  if (faltaAlguno || !esFechaValida(fecha_evento_prevista)) {
    return MENSAJES.obligatorios;
  }

  // Entero y positivo: 80.5 asistentes no tiene sentido. La base tambien lo
  // controla con un CHECK, pero asi el mensaje es claro.
  const cantidad = Number(cantidad_asistentes);
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return MENSAJES.cantidadInvalida;
  }

  // La comparacion se hace en la base con CURRENT_DATE y no en JavaScript:
  // asi "hoy" es el mismo dia para todas las consultas del sistema, sin
  // depender de la zona horaria del servidor de Node.
  const { rows } = await pool.query(
    "SELECT $1::date < CURRENT_DATE AS pasada",
    [fecha_evento_prevista]
  );
  if (rows[0].pasada) {
    return MENSAJES.fechaPasada;
  }

  // El cliente y el tipo de evento tienen que ser de la empresa del token y
  // estar activos. Sin esto alguien podria cargar una solicitud con el
  // cliente de otra empresa. Un id con formato invalido es lo mismo que un id
  // que no existe.
  const clienteOk =
    esIdValido(id_cliente) &&
    (await existeEnEmpresa(pool, "clientes", "id_cliente", id_cliente, idEmpresa, {
      soloActivos: true
    }));
  if (!clienteOk) {
    return MENSAJES.clienteInvalido;
  }

  const tipoEventoOk =
    esIdValido(id_tipo_evento) &&
    (await existeEnEmpresa(
      pool,
      "tipos_eventos",
      "id_tipo_evento",
      id_tipo_evento,
      idEmpresa,
      { soloActivos: true }
    ));
  if (!tipoEventoOk) {
    return MENSAJES.tipoEventoInvalido;
  }

  return null;
};

// GET /api/solicitudes?estado=&id_cliente=&desde=&hasta=&buscar=
export const obtenerSolicitudes = async (req, res) => {
  const { estado, id_cliente, desde, hasta, buscar } = req.query;

  // Los filtros se arman a mano y no con construirFiltros: ese helper agrega
  // ?activo, y las solicitudes no tienen ese campo. Siempre parametrizado.
  const condiciones = ["s.id_empresa = $1"];
  const valores = [req.usuario.id_empresa];

  const agregar = (condicion, valor) => {
    valores.push(valor);
    condiciones.push(condicion.replace("?", `$${valores.length}`));
  };

  if (estado) agregar("s.estado = ?", estado);

  // Un filtro con formato invalido se ignora en vez de romper la consulta.
  if (id_cliente && esIdValido(id_cliente)) agregar("s.id_cliente = ?", id_cliente);
  if (desde && esFechaValida(desde)) agregar("s.fecha_evento_prevista >= ?", desde);
  if (hasta && esFechaValida(hasta)) agregar("s.fecha_evento_prevista <= ?", hasta);

  // Busca sobre el nombre completo, asi "lucia fern" encuentra a Lucia Fernandez
  if (buscar) agregar("(c.nombre || ' ' || c.apellido) ILIKE ?", `%${buscar}%`);

  try {
    const resultado = await pool.query(
      `SELECT ${COLUMNAS} ${FROM_SOLICITUD}
       WHERE ${condiciones.join(" AND ")}
       ORDER BY s.fecha_evento_prevista, s.id_solicitud`,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/solicitudes/:id
// La Solicitud con dos campos mas: los datos de contacto del cliente y las
// cabeceras de sus presupuestos. Se arma todo en una sola consulta: el
// cliente con json_build_object y los presupuestos con un subselect agregado,
// igual que los servicios de un proveedor. COALESCE deja [] cuando no hay
// presupuestos, nunca null.
export const obtenerSolicitudPorId = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT ${COLUMNAS},
              json_build_object(
                'id_cliente', c.id_cliente,
                'nombre', c.nombre,
                'apellido', c.apellido,
                'telefono', c.telefono,
                'email', c.email
              ) AS cliente,
              COALESCE(
                (SELECT json_agg(json_build_object(
                          'id_presupuesto', p.id_presupuesto,
                          'numero_version', p.numero_version,
                          'fecha_emision', p.fecha_emision,
                          'importe_total', p.importe_total,
                          'estado', p.estado)
                        ORDER BY p.numero_version)
                 FROM presupuestos p
                 WHERE p.id_solicitud = s.id_solicitud),
                '[]'
              ) AS presupuestos
       ${FROM_SOLICITUD}
       WHERE s.id_solicitud = $1 AND s.id_empresa = $2`,
      [req.params.id, req.usuario.id_empresa]
    );

    // Si es de otra empresa el WHERE no la encuentra: 404, sin revelar que existe
    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrada });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/solicitudes
export const crearSolicitud = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;

  try {
    const error = await validarSolicitud(req.body, idEmpresa);
    if (error) {
      return res.status(400).json({ mensaje: error });
    }

    const {
      id_cliente,
      id_tipo_evento,
      fecha_evento_prevista,
      cantidad_asistentes,
      sede_prevista,
      preferencias
    } = req.body;

    // fecha_solicitud (hoy) y estado ('pendiente') los pone el DEFAULT de la
    // base. No se leen del body: una solicitud siempre nace pendiente.
    // id_empresa sale del token.
    const resultado = await pool.query(
      `INSERT INTO solicitudes (id_empresa, id_cliente, id_tipo_evento,
                                fecha_evento_prevista, cantidad_asistentes,
                                sede_prevista, preferencias)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_solicitud`,
      [
        idEmpresa,
        id_cliente,
        id_tipo_evento,
        fecha_evento_prevista,
        cantidad_asistentes,
        sede_prevista ?? null,
        preferencias ?? null
      ]
    );

    const solicitud = await buscarSolicitud(resultado.rows[0].id_solicitud, idEmpresa);
    res.status(201).json(solicitud);
  } catch (error) {
    responderError(res, error);
  }
};

// Cuando un UPDATE condicional no modifica ninguna fila puede ser por dos
// motivos: la solicitud no existe (o es de otra empresa) o esta en un estado
// que no lo permite. Esta consulta los distingue para responder 404 o 409.
const estadoActual = async (idSolicitud, idEmpresa) => {
  const resultado = await pool.query(
    "SELECT estado FROM solicitudes WHERE id_solicitud = $1 AND id_empresa = $2",
    [idSolicitud, idEmpresa]
  );

  return resultado.rows[0]?.estado ?? null;
};

// PUT /api/solicitudes/:id
export const editarSolicitud = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;

  try {
    const error = await validarSolicitud(req.body, idEmpresa);
    if (error) {
      return res.status(400).json({ mensaje: error });
    }

    const {
      id_cliente,
      id_tipo_evento,
      fecha_evento_prevista,
      cantidad_asistentes,
      sede_prevista,
      preferencias
    } = req.body;

    // El estado va en el WHERE del UPDATE y no en un SELECT previo: asi el
    // chequeo y la modificacion son una sola operacion, y nadie puede aceptar
    // la solicitud justo entre las dos. El estado nunca se edita por aca.
    const resultado = await pool.query(
      `UPDATE solicitudes
       SET id_cliente = $1,
           id_tipo_evento = $2,
           fecha_evento_prevista = $3,
           cantidad_asistentes = $4,
           sede_prevista = $5,
           preferencias = $6
       WHERE id_solicitud = $7 AND id_empresa = $8
         AND estado = ANY($9)
       RETURNING id_solicitud`,
      [
        id_cliente,
        id_tipo_evento,
        fecha_evento_prevista,
        cantidad_asistentes,
        sede_prevista ?? null,
        preferencias ?? null,
        req.params.id,
        idEmpresa,
        ESTADOS_ABIERTOS
      ]
    );

    if (resultado.rows.length === 0) {
      const estado = await estadoActual(req.params.id, idEmpresa);
      if (!estado) {
        return res.status(404).json({ mensaje: MENSAJES.noEncontrada });
      }
      return res.status(409).json({ mensaje: MENSAJES.noEditable });
    }

    res.json(await buscarSolicitud(req.params.id, idEmpresa));
  } catch (error) {
    responderError(res, error);
  }
};

// PATCH /api/solicitudes/:id/estado
// Solo cierra la solicitud (cancelada o rechazada) mientras sigue abierta.
// Los presupuestos que tenga no se tocan aca: las fases 4 y 5 tienen que
// impedir presentar o aceptar un presupuesto de una solicitud cerrada.
export const cambiarEstadoSolicitud = async (req, res) => {
  const { estado } = req.body;
  const idEmpresa = req.usuario.id_empresa;

  if (!ESTADOS_DESTINO.includes(estado)) {
    return res.status(400).json({ mensaje: MENSAJES.estadoInvalido });
  }

  try {
    // Mismo criterio que el PUT: el estado de origen se controla en el WHERE
    const resultado = await pool.query(
      `UPDATE solicitudes SET estado = $1
       WHERE id_solicitud = $2 AND id_empresa = $3
         AND estado = ANY($4)
       RETURNING id_solicitud`,
      [estado, req.params.id, idEmpresa, ESTADOS_ABIERTOS]
    );

    if (resultado.rows.length === 0) {
      const actual = await estadoActual(req.params.id, idEmpresa);
      if (!actual) {
        return res.status(404).json({ mensaje: MENSAJES.noEncontrada });
      }
      return res.status(409).json({
        mensaje: `No se puede cambiar el estado de una solicitud ${actual}`
      });
    }

    res.json(await buscarSolicitud(req.params.id, idEmpresa));
  } catch (error) {
    responderError(res, error);
  }
};
