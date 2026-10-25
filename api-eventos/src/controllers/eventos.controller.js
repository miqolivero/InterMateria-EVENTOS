import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { esEmpleadoActivo } from "../utils/consultas.js";
import {
  esIdValido,
  esFechaValida,
  esEnteroPositivo,
  esVacio
} from "../utils/validaciones.js";
import {
  SERVICIO_ACORDADO,
  servicioARevisar,
  servicioPendientesRevision
} from "../utils/indicadores.js";
import {
  MENSAJES_CAMBIO,
  tieneTexto,
  leerTareasAfectadas,
  sonTareasDelEvento,
  registrarCambio,
  marcarAfectados,
  buscarCambios
} from "../utils/cambios.js";

// Eventos: nacen al aceptar un presupuesto (regla 4) y desde ahi se coordinan.
// La tabla eventos SI tiene id_empresa (se guarda la del token al crearlo),
// asi que las consultas filtran directo por e.id_empresa.

// Un evento "abierto" todavia se puede editar. Realizado o cancelado ya esta
// cerrado (regla 8): solo se le cargan observaciones y feedback (fase 8).
// Se exportan porque los servicios y las tareas del evento aplican la misma
// regla: con el evento cerrado, nada se modifica.
export const ESTADOS_EVENTO_ABIERTO = ["confirmado", "en_preparacion"];
export const MENSAJE_EVENTO_CERRADO = "El evento esta cerrado y no se puede modificar";
const ESTADOS_ABIERTOS = ESTADOS_EVENTO_ABIERTO;

const MENSAJES = {
  noEncontrado: "Evento no encontrado",
  presupuestoNoEncontrado: "Presupuesto no encontrado",
  fechaObligatoria: "La fecha del evento es obligatoria",
  fechaPasada: "La fecha del evento no puede ser anterior a hoy",
  coordinadorInvalido: "El coordinador no es un empleado activo de la empresa",
  noAceptable: "Solo se puede aceptar un presupuesto presentado",
  yaTieneEvento: "La solicitud ya tiene un evento",
  cerrado: MENSAJE_EVENTO_CERRADO,
  noIniciable: "Solo se puede iniciar la preparacion de un evento confirmado",
  asistentesInvalidos: "La cantidad de asistentes tiene que ser mayor a 0"
};

const solicitudCerrada = (estado) =>
  `La solicitud esta ${estado} y no admite presupuestos`;

const ESTADOS_SOLICITUD_ABIERTA = ["pendiente", "presupuestada"];

// Objeto Evento (listado). El coordinador va con LEFT JOIN porque es opcional:
// con un JOIN comun, un evento sin coordinador desapareceria del listado.
// nombre_coordinador queda null en ese caso (null || ' ' || null = null).
const SELECT_EVENTO_LISTADO = `
  SELECT e.id_evento, e.id_solicitud,
         CONCAT_WS(' ', c.nombre, NULLIF(c.apellido, '-')) AS nombre_cliente,
         te.nombre AS nombre_tipo_evento,
         e.fecha_evento_confirmada, e.sede_acordada, e.cantidad_asistentes,
         e.id_empleado_coordinador,
         emp.nombre || ' ' || emp.apellido AS nombre_coordinador,
         e.estado
  FROM eventos e
  JOIN solicitudes s ON s.id_solicitud = e.id_solicitud
  JOIN clientes c ON c.id_cliente = s.id_cliente
  JOIN tipos_eventos te ON te.id_tipo_evento = s.id_tipo_evento
  LEFT JOIN empleados emp ON emp.id_empleado = e.id_empleado_coordinador`;

// Objeto Evento (detalle), en una sola consulta. Los objetos anidados se arman
// con json_build_object. El coordinador usa un CASE porque, si no hay,
// json_build_object devolveria un objeto con todos los campos en null, y el
// contrato pide coordinador: null.
const SELECT_EVENTO_DETALLE = `
  SELECT e.id_evento, e.estado, e.fecha_evento_confirmada, e.sede_acordada,
         e.condiciones_acordadas, e.cantidad_asistentes,
         e.observaciones_cierre, e.feedback_cliente,
         e.fecha_cierre,
         e.estado IN ('confirmado', 'en_preparacion') AS editable,
         CASE WHEN emp.id_empleado IS NULL THEN NULL
              ELSE json_build_object('id_empleado', emp.id_empleado,
                                     'nombre', emp.nombre,
                                     'apellido', emp.apellido)
         END AS coordinador,
         json_build_object(
           'id_cliente', c.id_cliente,
           'nombre', c.nombre,
           'apellido', c.apellido,
           'telefono', c.telefono,
           'email', c.email
         ) AS cliente,
         json_build_object(
           'id_solicitud', s.id_solicitud,
           'fecha_solicitud', s.fecha_solicitud,
           'nombre_tipo_evento', te.nombre,
           'cantidad_asistentes', s.cantidad_asistentes,
           'preferencias', s.preferencias
         ) AS solicitud,
         json_build_object(
           'id_presupuesto', p.id_presupuesto,
           'numero_version', p.numero_version,
           'importe_total', p.importe_total
         ) AS presupuesto_aceptado
  FROM eventos e
  JOIN solicitudes s ON s.id_solicitud = e.id_solicitud
  JOIN clientes c ON c.id_cliente = s.id_cliente
  JOIN tipos_eventos te ON te.id_tipo_evento = s.id_tipo_evento
  JOIN presupuestos p ON p.id_presupuesto = e.id_presupuesto_aceptado
  LEFT JOIN empleados emp ON emp.id_empleado = e.id_empleado_coordinador
  WHERE e.id_evento = $1 AND e.id_empresa = $2`;

// Objeto ServicioEvento (definido en la fase 6 del contrato, ampliado en la
// 11). Se exporta para que el controlador de servicios del evento devuelva
// exactamente lo mismo.
//
// - tipos_generados: los pasos (id_tipo_tarea) que ya tienen tarea. Reemplaza
//   a tareas_generadas y paso_actual, que sin secuencia no tienen sentido.
// - a_revisar y pendientes_revision: calculados, como "vencida".
export const SELECT_SERVICIO_EVENTO = `
  SELECT sxe.id_servicio_x_evento, sxe.id_evento, sxe.id_servicio,
         sv.nombre AS nombre_servicio,
         sxe.id_proveedor, pr.razon_social AS nombre_proveedor,
         sxe.descripcion, sxe.cantidad, sxe.costo_acordado_proveedor,
         sxe.importe_acordado_cliente, sxe.estado_proveedor,
         sxe.fecha_confirmacion_proveedor, sxe.observaciones,
         sxe.estado_servicio,
         ${servicioARevisar("sxe")} AS a_revisar,
         ${servicioPendientesRevision("sxe")} AS pendientes_revision,
         ARRAY(SELECT t.id_tipo_tarea FROM tareas t
               JOIN tipos_tarea tt ON tt.id_tipo_tarea = t.id_tipo_tarea
               WHERE t.id_servicio_x_evento = sxe.id_servicio_x_evento
               ORDER BY tt.orden) AS tipos_generados
  FROM servicios_x_evento sxe
  JOIN servicios sv ON sv.id_servicio = sxe.id_servicio
  LEFT JOIN proveedores pr ON pr.id_proveedor = sxe.id_proveedor`;

const buscarEvento = async (ejecutor, idEvento, idEmpresa) => {
  const resultado = await ejecutor.query(SELECT_EVENTO_DETALLE, [idEvento, idEmpresa]);
  return resultado.rows[0] ?? null;
};

// Estado actual del evento, o null si no existe o es de otra empresa. Sirve
// para distinguir 404 de 409.
const estadoEvento = async (idEvento, idEmpresa) => {
  const resultado = await pool.query(
    "SELECT estado FROM eventos WHERE id_evento = $1 AND id_empresa = $2",
    [idEvento, idEmpresa]
  );

  return resultado.rows[0]?.estado ?? null;
};

// Validaciones del body de aceptar y del PUT que no dependen de la empresa.
// La fecha mal escrita cuenta como fecha faltante (mismo criterio que en
// solicitudes). Un coordinador con formato invalido no puede ser un empleado.
// fechaActual (PUT): si la fecha no cambia, no se exige que sea futura. Asi
// se puede corregir la sede de un evento cuya fecha ya paso.
const validarDatosEvento = async (body, fechaActual = null) => {
  const { fecha_evento_confirmada, id_empleado_coordinador } = body;

  if (!esFechaValida(fecha_evento_confirmada)) {
    return MENSAJES.fechaObligatoria;
  }

  // "Hoy" lo decide la base (CURRENT_DATE), no la zona horaria de Node
  const { rows } = await pool.query("SELECT $1::date < CURRENT_DATE AS pasada", [
    fecha_evento_confirmada
  ]);
  if (rows[0].pasada && fecha_evento_confirmada !== fechaActual) {
    return MENSAJES.fechaPasada;
  }

  if (!esVacio(id_empleado_coordinador) && !esIdValido(id_empleado_coordinador)) {
    return MENSAJES.coordinadorInvalido;
  }

  return null;
};

// El coordinador es opcional. Si viene, tiene que trabajar hoy en la empresa
// del token (regla 9): sin esto se podria asignar a alguien de otra empresa o
// a un empleado dado de baja.
const coordinadorValido = async (ejecutor, idCoordinador, idEmpresa) =>
  esVacio(idCoordinador) || esEmpleadoActivo(ejecutor, idCoordinador, idEmpresa);

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// POST /api/presupuestos/:id/aceptar
// Regla 4 completa, en UNA transaccion. Son 5 cambios en 4 tablas:
//   1. el presupuesto pasa a 'aceptado';
//   2. las otras versiones abiertas de la solicitud pasan a 'reemplazado';
//   3. la solicitud pasa a 'aceptada';
//   4. se crea el evento ('confirmado'), con los asistentes de la solicitud;
//   5. el detalle se copia a servicios_x_evento (proveedor 'pendiente').
// Si cualquiera falla, el ROLLBACK deshace los anteriores: no puede quedar un
// presupuesto aceptado sin evento, ni un evento sin sus servicios.
export const aceptarPresupuesto = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const {
    fecha_evento_confirmada,
    sede_acordada,
    condiciones_acordadas,
    id_empleado_coordinador
  } = req.body;

  const client = await pool.connect();

  try {
    const errorDatos = await validarDatosEvento(req.body);
    if (errorDatos) {
      return res.status(400).json({ mensaje: errorDatos });
    }

    await client.query("BEGIN");

    // Se bloquean el presupuesto y su solicitud: dos aceptaciones a la vez (de
    // la misma version o de dos versiones distintas) quedan en fila, y la
    // segunda ve el estado que dejo la primera.
    const actual = await client.query(
      `SELECT p.id_presupuesto, p.estado, p.id_solicitud,
              s.estado AS estado_solicitud
       FROM presupuestos p
       JOIN solicitudes s ON s.id_solicitud = p.id_solicitud
       WHERE p.id_presupuesto = $1 AND s.id_empresa = $2
       FOR UPDATE OF p, s`,
      [req.params.id, idEmpresa]
    );

    if (actual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.presupuestoNoEncontrado });
    }

    const { estado, id_solicitud, estado_solicitud } = actual.rows[0];

    if (estado !== "presentado") {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.noAceptable });
    }

    const eventoPrevio = await client.query(
      "SELECT 1 FROM eventos WHERE id_solicitud = $1",
      [id_solicitud]
    );

    if (eventoPrevio.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.yaTieneEvento });
    }

    // Si se cancelo la solicitud con un presupuesto ya presentado, ese
    // presupuesto no se puede aceptar
    if (!ESTADOS_SOLICITUD_ABIERTA.includes(estado_solicitud)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: solicitudCerrada(estado_solicitud) });
    }

    if (!(await coordinadorValido(client, id_empleado_coordinador, idEmpresa))) {
      await client.query("ROLLBACK");
      return res.status(400).json({ mensaje: MENSAJES.coordinadorInvalido });
    }

    // 1. El presupuesto elegido
    await client.query(
      "UPDATE presupuestos SET estado = 'aceptado' WHERE id_presupuesto = $1",
      [req.params.id]
    );

    // 2. Las otras versiones que seguian abiertas. Las ya rechazadas o
    //    reemplazadas quedan como estaban: es su historial.
    await client.query(
      `UPDATE presupuestos SET estado = 'reemplazado'
       WHERE id_solicitud = $1 AND id_presupuesto <> $2
         AND estado IN ('borrador', 'presentado')`,
      [id_solicitud, req.params.id]
    );

    // 3. La solicitud
    await client.query(
      "UPDATE solicitudes SET estado = 'aceptada' WHERE id_solicitud = $1",
      [id_solicitud]
    );

    // 4. El evento. id_empresa sale del token; estado ('confirmado') del DEFAULT.
    //    La cantidad de asistentes se copia de la solicitud: desde aca vive en
    //    el evento y sus cambios quedan en el historial (Fase 11).
    const evento = await client.query(
      `INSERT INTO eventos (id_empresa, id_solicitud, id_presupuesto_aceptado,
                            id_empleado_coordinador, fecha_evento_confirmada,
                            sede_acordada, condiciones_acordadas,
                            cantidad_asistentes)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               (SELECT cantidad_asistentes FROM solicitudes WHERE id_solicitud = $2))
       RETURNING id_evento`,
      [
        idEmpresa,
        id_solicitud,
        req.params.id,
        esVacio(id_empleado_coordinador) ? null : id_empleado_coordinador,
        fecha_evento_confirmada,
        sede_acordada ?? null,
        condiciones_acordadas ?? null
      ]
    );

    const idEvento = evento.rows[0].id_evento;

    // 5. Lo presupuestado pasa a ser lo ACORDADO. Desde aca cada servicio
    //    tiene su propio estado de proveedor ('pendiente' por DEFAULT).
    await client.query(
      `INSERT INTO servicios_x_evento (id_evento, id_servicio, id_proveedor,
                                       descripcion, cantidad,
                                       costo_acordado_proveedor,
                                       importe_acordado_cliente)
       SELECT $1, id_servicio, id_proveedor, descripcion, cantidad,
              costo_proveedor, importe_cliente
       FROM detalle_presupuesto
       WHERE id_presupuesto = $2
       ORDER BY id_detalle`,
      [idEvento, req.params.id]
    );

    const respuesta = await buscarEvento(client, idEvento, idEmpresa);

    await client.query("COMMIT");

    res.status(201).json(respuesta);
  } catch (error) {
    await client.query("ROLLBACK");

    // Red de seguridad: el UNIQUE (id_solicitud) de eventos impide en la base
    // que una solicitud tenga dos eventos, aunque algo se escapara del chequeo.
    if (error.code === "23505") {
      return res.status(409).json({ mensaje: MENSAJES.yaTieneEvento });
    }
    responderError(res, error);
  } finally {
    client.release();
  }
};

// GET /api/eventos?estado=&desde=&hasta=&id_coordinador=&buscar=
export const obtenerEventos = async (req, res) => {
  const { estado, desde, hasta, id_coordinador, buscar } = req.query;

  const condiciones = ["e.id_empresa = $1"];
  const valores = [req.usuario.id_empresa];

  const agregar = (condicion, valor) => {
    valores.push(valor);
    condiciones.push(condicion.replace("?", `$${valores.length}`));
  };

  if (estado) agregar("e.estado = ?", estado);

  // Un filtro con formato invalido se ignora (mismo criterio que solicitudes)
  if (desde && esFechaValida(desde)) agregar("e.fecha_evento_confirmada >= ?", desde);
  if (hasta && esFechaValida(hasta)) agregar("e.fecha_evento_confirmada <= ?", hasta);
  if (id_coordinador && esIdValido(id_coordinador)) {
    agregar("e.id_empleado_coordinador = ?", id_coordinador);
  }
  if (buscar) agregar("(CONCAT_WS(' ', c.nombre, NULLIF(c.apellido, '-'))) ILIKE ?", `%${buscar}%`);

  try {
    const resultado = await pool.query(
      `${SELECT_EVENTO_LISTADO}
       WHERE ${condiciones.join(" AND ")}
       ORDER BY e.fecha_evento_confirmada, e.id_evento`,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/eventos/:id
export const obtenerEventoPorId = async (req, res) => {
  try {
    const evento = await buscarEvento(pool, req.params.id, req.usuario.id_empresa);

    if (!evento) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }

    res.json(evento);
  } catch (error) {
    responderError(res, error);
  }
};

// PUT /api/eventos/:id
// Fase 11: es un CAMBIO REGISTRADO. Reemplaza el objeto completo (como en la
// Fase 5) y compara cada campo con lo guardado: por cada uno que cambio se
// crea una fila en cambios_evento, todas con el mismo motivo.
//
// El coordinador se guarda sin historial: es una decision interna, no un
// acuerdo con el cliente. Si solo cambio el coordinador, se guarda sin pedir
// motivo y cambios_registrados queda vacio.
//
// Afectados: si cambio la fecha o la sede, todos los servicios acordados
// quedan a revisar (vinculados al cambio de fecha, o al de sede si solo cambio
// la sede). Las tareas las elige el usuario (tareas_afectadas): el sistema no
// adivina cuales se corren con la fecha, ni las reprograma solo.
//
// Todo en UNA transaccion: el UPDATE del evento, los registros y los afectados.
// Si falla cualquier INSERT del historial, el ROLLBACK deshace el cambio del
// evento: no puede quedar una fecha cambiada sin su registro.
const CAMPOS_REGISTRADOS = [
  { campo: "fecha_evento_confirmada", tipo: "fecha", descripcion: "Cambio de fecha del evento" },
  { campo: "sede_acordada", tipo: "sede", descripcion: "Cambio de sede del evento" },
  { campo: "condiciones_acordadas", tipo: "condiciones", descripcion: "Cambio de las condiciones acordadas" },
  { campo: "cantidad_asistentes", tipo: "cantidad_asistentes", descripcion: "Cambio de la cantidad de asistentes" }
];

// Un texto opcional vacio se guarda como null, asi "" y null no cuentan
// como un cambio
const textoONull = (valor) => (tieneTexto(valor) ? valor.trim() : null);

export const editarEvento = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const body = req.body ?? {};

  if (!esFechaValida(body.fecha_evento_confirmada)) {
    return res.status(400).json({ mensaje: MENSAJES.fechaObligatoria });
  }
  if (!esEnteroPositivo(body.cantidad_asistentes)) {
    return res.status(400).json({ mensaje: MENSAJES.asistentesInvalidos });
  }
  const tareasAfectadas = leerTareasAfectadas(body.tareas_afectadas);
  if (!tareasAfectadas) {
    return res.status(400).json({ mensaje: MENSAJES_CAMBIO.tareasAjenas });
  }

  const nuevo = {
    fecha_evento_confirmada: body.fecha_evento_confirmada,
    sede_acordada: textoONull(body.sede_acordada),
    condiciones_acordadas: textoONull(body.condiciones_acordadas),
    cantidad_asistentes: Number(body.cantidad_asistentes),
    id_empleado_coordinador: esVacio(body.id_empleado_coordinador)
      ? null
      : Number(body.id_empleado_coordinador)
  };

  const client = await pool.connect();
  const responder = async (status, mensaje) => {
    await client.query("ROLLBACK");
    return res.status(status).json({ mensaje });
  };

  try {
    await client.query("BEGIN");

    // Bloqueado hasta el COMMIT: dos cambios a la vez quedan en fila y el
    // segundo compara contra lo que dejo el primero
    const actual = await client.query(
      `SELECT estado, fecha_evento_confirmada, sede_acordada, condiciones_acordadas,
              cantidad_asistentes, id_empleado_coordinador
       FROM eventos WHERE id_evento = $1 AND id_empresa = $2
       FOR UPDATE`,
      [req.params.id, idEmpresa]
    );
    const evento = actual.rows[0];

    if (!evento) return responder(404, MENSAJES.noEncontrado);
    if (!ESTADOS_ABIERTOS.includes(evento.estado)) return responder(409, MENSAJES.cerrado);

    const errorDatos = await validarDatosEvento(body, evento.fecha_evento_confirmada);
    if (errorDatos) return responder(400, errorDatos);

    const cambiados = CAMPOS_REGISTRADOS.filter(({ campo }) => nuevo[campo] !== evento[campo]);
    const cambioCoordinador = nuevo.id_empleado_coordinador !== evento.id_empleado_coordinador;

    if (cambiados.length === 0 && !cambioCoordinador) {
      return responder(400, MENSAJES_CAMBIO.sinCambios);
    }
    if (cambiados.length > 0 && !tieneTexto(body.motivo)) {
      return responder(400, MENSAJES_CAMBIO.motivoObligatorio);
    }
    if (cambioCoordinador && !(await coordinadorValido(client, nuevo.id_empleado_coordinador, idEmpresa))) {
      return responder(400, MENSAJES.coordinadorInvalido);
    }
    if (cambiados.length > 0 && !(await sonTareasDelEvento(client, req.params.id, tareasAfectadas))) {
      return responder(400, MENSAJES_CAMBIO.tareasAjenas);
    }

    await client.query(
      `UPDATE eventos
       SET fecha_evento_confirmada = $1, sede_acordada = $2,
           condiciones_acordadas = $3, cantidad_asistentes = $4,
           id_empleado_coordinador = $5
       WHERE id_evento = $6`,
      [
        nuevo.fecha_evento_confirmada,
        nuevo.sede_acordada,
        nuevo.condiciones_acordadas,
        nuevo.cantidad_asistentes,
        nuevo.id_empleado_coordinador,
        req.params.id
      ]
    );

    // Un registro por campo cambiado, en el orden de CAMPOS_REGISTRADOS
    const ids = {};
    for (const { campo, tipo, descripcion } of cambiados) {
      ids[tipo] = await registrarCambio(client, {
        idEvento: req.params.id,
        idUsuario: req.usuario.id,
        tipo,
        descripcion,
        valorAnterior: evento[campo] === null ? null : String(evento[campo]),
        valorNuevo: nuevo[campo] === null ? null : String(nuevo[campo]),
        motivo: body.motivo
      });
    }

    // La fecha o la sede afectan a todos los proveedores acordados
    const cambioDeLugar = ids.fecha ?? ids.sede;
    if (cambioDeLugar) {
      const servicios = await client.query(
        `SELECT sxe.id_servicio_x_evento FROM servicios_x_evento sxe
         WHERE sxe.id_evento = $1 AND ${SERVICIO_ACORDADO}
         ORDER BY sxe.id_servicio_x_evento`,
        [req.params.id]
      );
      await marcarAfectados(client, cambioDeLugar, {
        servicios: servicios.rows.map((fila) => fila.id_servicio_x_evento)
      });
    }

    // Las tareas elegidas, al primer cambio registrado
    const idsCambios = Object.values(ids);
    if (idsCambios.length > 0) {
      await marcarAfectados(client, idsCambios[0], { tareas: tareasAfectadas });
    }

    const respuesta = {
      ...(await buscarEvento(client, req.params.id, idEmpresa)),
      cambios_registrados: await buscarCambios(client, idsCambios)
    };

    await client.query("COMMIT");
    res.json(respuesta);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error);
  } finally {
    client.release();
  }
};

// PATCH /api/eventos/:id/iniciar-preparacion
// De 'confirmado' a 'en_preparacion'. Un solo UPDATE condicional.
export const iniciarPreparacion = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;

  try {
    const resultado = await pool.query(
      `UPDATE eventos SET estado = 'en_preparacion'
       WHERE id_evento = $1 AND id_empresa = $2 AND estado = 'confirmado'
       RETURNING id_evento`,
      [req.params.id, idEmpresa]
    );

    if (resultado.rows.length === 0) {
      const estado = await estadoEvento(req.params.id, idEmpresa);
      if (!estado) {
        return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
      }
      return res.status(409).json({ mensaje: MENSAJES.noIniciable });
    }

    res.json(await buscarEvento(pool, req.params.id, idEmpresa));
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/eventos/:id/servicios
export const obtenerServiciosDelEvento = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;

  try {
    // Primero se verifica que el evento sea de la empresa: si no, un evento
    // ajeno devolveria [] en vez de 404 y se podria adivinar que ids existen.
    if (!(await estadoEvento(req.params.id, idEmpresa))) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }

    const resultado = await pool.query(
      `${SELECT_SERVICIO_EVENTO}
       WHERE sxe.id_evento = $1
       ORDER BY sxe.id_servicio_x_evento`,
      [req.params.id]
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// ---------------------------------------------------------------------------
// Fase 8: cierre y feedback (regla 8)
// ---------------------------------------------------------------------------

const MENSAJES_CIERRE = {
  estadoInvalido: "Estado de cierre invalido",
  faltaMotivo: "Para cancelar un evento hay que indicar el motivo",
  yaCerrado: "El evento ya esta cerrado",
  sinDatos: "No hay datos para actualizar",
  noRealizado: "Solo se puede cargar feedback de un evento realizado"
};

const ESTADOS_CIERRE = ["realizado", "cancelado"];

// tieneTexto (un texto hecho solo de espacios cuenta como vacio) viene de
// utils/cambios.js: es el mismo criterio que el motivo de un cambio.

// PATCH /api/eventos/:id/cerrar
// Cierra el evento como realizado o cancelado. Si se cancela, la solicitud
// tambien pasa a 'cancelada': son dos tablas, asi que va en una transaccion
// (no puede quedar un evento cancelado con su solicitud 'aceptada').
//
// No se exige que las tareas esten completas: el front avisa, pero la decision
// es del usuario (un evento se puede haber hecho aunque falte cargar algo).
export const cerrarEvento = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const { estado, observaciones_cierre } = req.body;

  if (!ESTADOS_CIERRE.includes(estado)) {
    return res.status(400).json({ mensaje: MENSAJES_CIERRE.estadoInvalido });
  }

  // Cancelar sin motivo deja un evento perdido sin explicacion: obligatorio
  if (estado === "cancelado" && !tieneTexto(observaciones_cierre)) {
    return res.status(400).json({ mensaje: MENSAJES_CIERRE.faltaMotivo });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Bloqueado hasta el COMMIT: si dos personas cierran el evento a la vez,
    // la segunda ve que ya esta cerrado y recibe 409.
    const actual = await client.query(
      `SELECT estado, id_solicitud FROM eventos
       WHERE id_evento = $1 AND id_empresa = $2
       FOR UPDATE`,
      [req.params.id, idEmpresa]
    );

    if (actual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }

    if (!ESTADOS_ABIERTOS.includes(actual.rows[0].estado)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES_CIERRE.yaCerrado });
    }

    await client.query(
      `UPDATE eventos
       SET estado = $1,
           observaciones_cierre = $2,
           fecha_cierre = CURRENT_DATE
       WHERE id_evento = $3`,
      [
        estado,
        tieneTexto(observaciones_cierre) ? observaciones_cierre : null,
        req.params.id
      ]
    );

    if (estado === "cancelado") {
      await client.query(
        "UPDATE solicitudes SET estado = 'cancelada' WHERE id_solicitud = $1",
        [actual.rows[0].id_solicitud]
      );
    }

    const evento = await buscarEvento(client, req.params.id, idEmpresa);

    await client.query("COMMIT");

    res.json(evento);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error);
  } finally {
    client.release();
  }
};

// PATCH /api/eventos/:id/feedback
// La unica edicion permitida con el evento cerrado, y solo si se realizo (un
// evento cancelado no tiene opinion del cliente sobre el servicio). Parcial:
// solo se actualizan los campos que vienen con texto.
export const cargarFeedback = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const { feedback_cliente, observaciones_cierre } = req.body;

  const hayFeedback = tieneTexto(feedback_cliente);
  const hayObservaciones = tieneTexto(observaciones_cierre);

  if (!hayFeedback && !hayObservaciones) {
    return res.status(400).json({ mensaje: MENSAJES_CIERRE.sinDatos });
  }

  try {
    // CASE: si el campo no vino, la columna se queda con su valor. El estado
    // va en el WHERE, asi el chequeo y el cambio son una sola operacion.
    const resultado = await pool.query(
      `UPDATE eventos
       SET feedback_cliente = CASE WHEN $1 THEN $2 ELSE feedback_cliente END,
           observaciones_cierre = CASE WHEN $3 THEN $4 ELSE observaciones_cierre END
       WHERE id_evento = $5 AND id_empresa = $6 AND estado = 'realizado'
       RETURNING id_evento`,
      [
        hayFeedback,
        hayFeedback ? feedback_cliente : null,
        hayObservaciones,
        hayObservaciones ? observaciones_cierre : null,
        req.params.id,
        idEmpresa
      ]
    );

    if (resultado.rows.length === 0) {
      const estado = await estadoEvento(req.params.id, idEmpresa);
      if (!estado) {
        return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
      }
      return res.status(409).json({ mensaje: MENSAJES_CIERRE.noRealizado });
    }

    res.json(await buscarEvento(pool, req.params.id, idEmpresa));
  } catch (error) {
    responderError(res, error);
  }
};
