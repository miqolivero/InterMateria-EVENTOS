import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { esEmpleadoActivo } from "../utils/consultas.js";
import { esFechaValida } from "../utils/validaciones.js";
import {
  tieneTexto,
  selectCambio,
  ORDEN_CAMBIOS,
  SELECT_REVISION,
  ORDEN_REVISIONES,
  condicionRevisionDelEmpleado
} from "../utils/cambios.js";
import {
  JOIN_INDICADORES,
  COLUMNAS_INDICADORES,
  servicioARevisar,
  servicioPendientesRevision,
  plazoTerminado
} from "../utils/indicadores.js";
import { ESTADOS_EVENTO_ABIERTO, MENSAJE_EVENTO_CERRADO, SELECT_SERVICIO_EVENTO } from "./eventos.controller.js";
import { SELECT_TAREA, ORDEN_TAREAS, ESTADOS_TAREA, MENSAJE_CANCELAR_TAREA, responsableObligatorio, aplicarEstadoTarea } from "./tareas.controller.js";
import { ESTADOS_PROVEEDOR, setEstadoProveedor } from "./serviciosEvento.controller.js";

// Fase 11: lo que se lee del historial de cambios y de los compromisos a
// revisar, y el resumen del evento (la vista completa, tambien para el
// empleado). Revisar es lo unico que se escribe aca: deja constancia y, si la
// persona lo indica, actualiza el compromiso.

const MENSAJES = {
  eventoNoEncontrado: "Evento no encontrado",
  revisionNoEncontrada: "Revision no encontrada",
  notaObligatoria: "La nota de revision es obligatoria",
  yaRevisado: "Ya fue revisado",
  soloEstado: "Solo podes actualizar el estado",
  estadoInvalido: "Estado invalido",
  fechaInvalida: "La fecha prevista no es valida",
  camposAjenos: "Esos datos no corresponden a lo que se esta revisando",
  responsableInvalido: "El responsable no es un empleado activo de la empresa",
  plazoTerminado: "El evento ya paso y la tarea no se puede modificar: solo se puede dejar la nota",
  servicioCancelado: "El servicio esta cancelado",
  sinProveedor: "El servicio no tiene proveedor asignado"
};

const ETIQUETAS_ESTADO = {
  pendiente: "Pendiente", en_curso: "En curso", completada: "Completada", cancelada: "Cancelada",
  confirmado: "Confirmado", completado: "Completado", rechazado: "Rechazado"
};
const fechaLegible = (fecha) => fecha ? fecha.split("-").reverse().join("/") : "sin fecha";

// Actualiza la tarea de una revision. Devuelve el texto de lo que cambio, o un
// error [status, mensaje]. Lo que ya tiene ese valor no cuenta como cambio.
const actualizarTarea = async (client, afectado, body, idEmpresa, idUsuario) => {
  const { fecha_prevista: fecha, id_empleado_responsable: responsable, estado_tarea: estado } = body;
  const cambiaFecha = fecha != null && fecha !== afectado.fecha_actual;
  const cambiaResponsable = responsable != null && Number(responsable) !== afectado.responsable_actual;
  const cambiaEstado = estado != null && estado !== afectado.estado_actual;
  if (!cambiaFecha && !cambiaResponsable && !cambiaEstado) return { texto: null };
  if (afectado.plazo_terminado) return { error: [409, MENSAJES.plazoTerminado] };

  const partes = [];
  if (cambiaResponsable) {
    if (!(await esEmpleadoActivo(client, responsable, idEmpresa))) return { error: [400, MENSAJES.responsableInvalido] };
    const nombres = await client.query(
      `SELECT (SELECT nombre || ' ' || apellido FROM empleados WHERE id_empleado = $1::int) AS anterior,
              (SELECT nombre || ' ' || apellido FROM empleados WHERE id_empleado = $2::int) AS nuevo`,
      [afectado.responsable_actual, responsable]
    );
    partes.push(`Responsable: ${nombres.rows[0].anterior ?? "sin asignar"} → ${nombres.rows[0].nuevo}`);
  }
  if (cambiaFecha) partes.push(`Fecha prevista: ${fechaLegible(afectado.fecha_actual)} → ${fechaLegible(fecha)}`);
  if (cambiaEstado) partes.push(`Estado: ${ETIQUETAS_ESTADO[afectado.estado_actual]} → ${ETIQUETAS_ESTADO[estado]}`);

  // El estado primero: mover la fecha antes podria reabrir un plazo terminado
  if (cambiaEstado && !(await aplicarEstadoTarea(client, afectado.id_tarea, estado, idUsuario))) {
    return { error: [409, MENSAJE_EVENTO_CERRADO] };
  }
  if (cambiaFecha || cambiaResponsable) {
    await client.query(
      `UPDATE tareas SET fecha_prevista = COALESCE($1::date, fecha_prevista),
                          id_empleado_responsable = COALESCE($2::int, id_empleado_responsable)
       WHERE id_tarea = $3`,
      [cambiaFecha ? fecha : null, cambiaResponsable ? responsable : null, afectado.id_tarea]
    );
  }
  return { texto: partes.join(" · ") };
};

// Actualiza el proveedor de una revision: solo su estado. Cambiar de proveedor o
// los importes es otro cambio de lo acordado, con su motivo.
const actualizarServicio = async (client, afectado, estado) => {
  if (estado == null || estado === afectado.estado_proveedor) return { texto: null };
  if (afectado.estado_servicio === "cancelado") return { error: [409, MENSAJES.servicioCancelado] };
  if (["confirmado", "completado"].includes(estado) && afectado.id_proveedor === null) {
    return { error: [409, MENSAJES.sinProveedor] };
  }
  await client.query(
    `UPDATE servicios_x_evento SET ${setEstadoProveedor(1)} WHERE id_servicio_x_evento = $2`,
    [estado, afectado.id_servicio_x_evento]
  );
  return { texto: `Estado del proveedor: ${ETIQUETAS_ESTADO[afectado.estado_proveedor]} → ${ETIQUETAS_ESTADO[estado]}` };
};

const TIPOS_CAMBIO = [
  "fecha", "sede", "condiciones", "cantidad_asistentes",
  "servicio_agregado", "servicio_modificado", "servicio_cancelado", "proveedor_cambiado"
];

// El evento si es de la empresa y, para el empleado, si tiene alguna tarea en
// el. Si no, null (404): el empleado no se entera de que el evento existe.
const eventoVisible = async (idEvento, idEmpresa, idEmpleado) => {
  const { rows } = await pool.query(
    `SELECT e.id_evento FROM eventos e
     WHERE e.id_evento = $1 AND e.id_empresa = $2
       AND ($3::int IS NULL OR EXISTS (
             SELECT 1 FROM tareas t
             WHERE t.id_evento = e.id_evento AND t.id_empleado_responsable = $3::int))`,
    [idEvento, idEmpresa, idEmpleado]
  );
  return rows.length > 0;
};

// GET /api/eventos/:id/cambios?tipo=
// El historial completo, del mas nuevo al mas viejo. Solo admin y coordinador.
export const obtenerCambios = async (req, res) => {
  try {
    if (!(await eventoVisible(req.params.id, req.usuario.id_empresa, null))) {
      return res.status(404).json({ mensaje: MENSAJES.eventoNoEncontrado });
    }

    const valores = [req.params.id];
    let filtro = "";
    // Un tipo que no existe se ignora, como los demas filtros invalidos
    if (TIPOS_CAMBIO.includes(req.query.tipo)) {
      valores.push(req.query.tipo);
      filtro = "AND ce.tipo = $2";
    }

    const { rows } = await pool.query(
      `${selectCambio()} WHERE ce.id_evento = $1 ${filtro} ${ORDEN_CAMBIOS}`,
      valores
    );
    res.json(rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/eventos/:id/revisiones?revisado=false
// Los compromisos afectados del evento. El empleado recibe solo los suyos.
export const obtenerRevisiones = async (req, res) => {
  const idEmpleado = responsableObligatorio(req.usuario);

  try {
    if (!(await eventoVisible(req.params.id, req.usuario.id_empresa, idEmpleado))) {
      return res.status(404).json({ mensaje: MENSAJES.eventoNoEncontrado });
    }

    const valores = [req.params.id, idEmpleado];
    let filtro = "";
    if (req.query.revisado === "true" || req.query.revisado === "false") {
      valores.push(req.query.revisado === "true");
      filtro = "AND ac.revisado = $3";
    }

    const { rows } = await pool.query(
      `${SELECT_REVISION}
       WHERE ce.id_evento = $1 AND ${condicionRevisionDelEmpleado(2)} ${filtro}
       ${ORDEN_REVISIONES}`,
      valores
    );
    res.json(rows);
  } catch (error) {
    responderError(res, error);
  }
};

// PATCH /api/revisiones/:id
// Deja constancia de que un compromiso afectado se reviso: quien, cuando y
// una nota obligatoria ("dejar constancia", pidio el cliente). En la misma
// transaccion puede actualizar el compromiso, si la persona lo indica:
//   - una tarea: fecha_prevista, id_empleado_responsable, estado_tarea;
//   - un servicio: estado_proveedor.
// El empleado solo actualiza estados. Con el evento cerrado no se modifica,
// como todo lo demas.
export const revisarAfectado = async (req, res) => {
  const { id_empresa: idEmpresa } = req.usuario;
  const idEmpleado = responsableObligatorio(req.usuario);
  const body = req.body ?? {};
  const nota = body.nota_revision;

  if (!tieneTexto(nota)) {
    return res.status(400).json({ mensaje: MENSAJES.notaObligatoria });
  }
  // El 403 va antes que la base, asi no revela si la revision existe
  if (idEmpleado !== null && (body.fecha_prevista != null || body.id_empleado_responsable != null)) {
    return res.status(403).json({ mensaje: MENSAJES.soloEstado });
  }
  if (idEmpleado !== null && body.estado_tarea === "cancelada") {
    return res.status(403).json({ mensaje: MENSAJE_CANCELAR_TAREA });
  }
  if ((body.estado_tarea != null && !ESTADOS_TAREA.includes(body.estado_tarea))
    || (body.estado_proveedor != null && !ESTADOS_PROVEEDOR.includes(body.estado_proveedor))) {
    return res.status(400).json({ mensaje: MENSAJES.estadoInvalido });
  }
  if (body.fecha_prevista != null && !esFechaValida(body.fecha_prevista)) {
    return res.status(400).json({ mensaje: MENSAJES.fechaInvalida });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Bloqueado: si dos personas revisan lo mismo a la vez, la segunda ve que
    // ya esta revisado y recibe 409
    const { rows } = await client.query(
      `SELECT ac.revisado, ac.id_tarea, ac.id_servicio_x_evento, e.estado AS estado_evento,
              to_char(tr.fecha_prevista, 'YYYY-MM-DD') AS fecha_actual,
              tr.id_empleado_responsable AS responsable_actual, tr.estado_tarea AS estado_actual,
              ${plazoTerminado("tr")} AS plazo_terminado,
              sxr.id_proveedor, sxr.estado_proveedor, sxr.estado_servicio
       FROM afectados_cambio ac
       JOIN cambios_evento ce ON ce.id_cambio = ac.id_cambio
       JOIN eventos e ON e.id_evento = ce.id_evento
       LEFT JOIN tareas tr ON tr.id_tarea = ac.id_tarea
       LEFT JOIN servicios_x_evento sxr ON sxr.id_servicio_x_evento = ac.id_servicio_x_evento
       WHERE ac.id_afectado = $1 AND e.id_empresa = $2
         AND ${condicionRevisionDelEmpleado(3)}
       FOR UPDATE OF ac`,
      [req.params.id, idEmpresa, idEmpleado]
    );
    const afectado = rows[0];

    let error = null;
    if (!afectado) error = [404, MENSAJES.revisionNoEncontrada];
    else if (!ESTADOS_EVENTO_ABIERTO.includes(afectado.estado_evento)) error = [409, MENSAJE_EVENTO_CERRADO];
    else if (afectado.revisado) error = [409, MENSAJES.yaRevisado];
    else if (idEmpleado !== null && afectado.estado_actual === "cancelada" && body.estado_tarea != null && body.estado_tarea !== "cancelada") {
      error = [403, MENSAJE_CANCELAR_TAREA];
    }
    else if (afectado.id_tarea ? body.estado_proveedor != null
      : body.fecha_prevista != null || body.id_empleado_responsable != null || body.estado_tarea != null) {
      error = [400, MENSAJES.camposAjenos];
    }

    let actualizado = {};
    if (!error) {
      actualizado = afectado.id_tarea
        ? await actualizarTarea(client, afectado, body, idEmpresa, req.usuario.id)
        : await actualizarServicio(client, afectado, body.estado_proveedor);
      error = actualizado.error ?? null;
    }

    if (error) {
      await client.query("ROLLBACK");
      return res.status(error[0]).json({ mensaje: error[1] });
    }

    await client.query(
      `UPDATE afectados_cambio
       SET revisado = TRUE, id_usuario_revision = $1, fecha_revision = NOW(),
           nota_revision = $2, cambios_revision = $3
       WHERE id_afectado = $4`,
      [req.usuario.id, nota.trim(), actualizado.texto, req.params.id]
    );

    const revision = await client.query(`${SELECT_REVISION} WHERE ac.id_afectado = $1`, [req.params.id]);

    await client.query("COMMIT");
    res.json(revision.rows[0]);
  } catch (errorPg) {
    await client.query("ROLLBACK");
    responderError(res, errorPg);
  } finally {
    client.release();
  }
};

// El ServicioEvento del empleado: las mismas columnas, SIN los importes.
// Se escribe columna por columna para que nada se cuele (regla 11).
const SELECT_SERVICIO_SIN_IMPORTES = `
  SELECT sxe.id_servicio_x_evento, sxe.id_evento, sxe.id_servicio,
         sv.nombre AS nombre_servicio,
         sxe.id_proveedor, pr.razon_social AS nombre_proveedor,
         sxe.descripcion, sxe.cantidad, sxe.estado_proveedor,
         sxe.fecha_confirmacion_proveedor, sxe.observaciones,
         sxe.estado_servicio,
         ${servicioARevisar("sxe")} AS a_revisar,
         ${servicioPendientesRevision("sxe")} AS pendientes_revision
  FROM servicios_x_evento sxe
  JOIN servicios sv ON sv.id_servicio = sxe.id_servicio
  LEFT JOIN proveedores pr ON pr.id_proveedor = sxe.id_proveedor`;

// GET /api/eventos/:id/resumen
// Todo el evento en una respuesta: datos, cliente, indicadores, servicios,
// tareas, lo que falta revisar y los ultimos cambios. Es la consulta 5 del
// cliente y la vista ampliada del empleado, con su alcance:
//   - cliente: solo el nombre;
//   - servicios: sin importes;
//   - tareas: todas las del evento (el contexto completo);
//   - revisiones: solo las suyas;
//   - cambios: descripcion y motivo, sin valor anterior ni nuevo.
export const obtenerResumenEvento = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const idEmpleado = responsableObligatorio(req.usuario);
  const esEmpleado = idEmpleado !== null;

  try {
    if (!(await eventoVisible(req.params.id, idEmpresa, idEmpleado))) {
      return res.status(404).json({ mensaje: MENSAJES.eventoNoEncontrado });
    }

    const cliente = esEmpleado
      ? "json_build_object('nombre', CONCAT_WS(' ', c.nombre, NULLIF(c.apellido, '-')))"
      : `json_build_object('nombre', CONCAT_WS(' ', c.nombre, NULLIF(c.apellido, '-')),
                           'telefono', c.telefono, 'email', c.email)`;

    const [evento, servicios, tareas, revisiones, cambios] = await Promise.all([
      pool.query(
        `SELECT json_build_object(
                  'id_evento', e.id_evento,
                  'estado', e.estado,
                  'nombre_tipo_evento', te.nombre,
                  'fecha_evento_confirmada', e.fecha_evento_confirmada,
                  'sede_acordada', e.sede_acordada,
                  'cantidad_asistentes', e.cantidad_asistentes,
                  'condiciones_acordadas', e.condiciones_acordadas,
                  'coordinador', CASE WHEN emp.id_empleado IS NULL THEN NULL
                                      ELSE json_build_object('id_empleado', emp.id_empleado,
                                             'nombre', emp.nombre || ' ' || emp.apellido) END
                ) AS evento,
                ${cliente} AS cliente,
                ${COLUMNAS_INDICADORES}
         FROM eventos e
         JOIN solicitudes s ON s.id_solicitud = e.id_solicitud
         JOIN clientes c ON c.id_cliente = s.id_cliente
         JOIN tipos_eventos te ON te.id_tipo_evento = s.id_tipo_evento
         LEFT JOIN empleados emp ON emp.id_empleado = e.id_empleado_coordinador
         ${JOIN_INDICADORES}
         WHERE e.id_evento = $1`,
        [req.params.id]
      ),
      pool.query(
        `${esEmpleado ? SELECT_SERVICIO_SIN_IMPORTES : SELECT_SERVICIO_EVENTO}
         WHERE sxe.id_evento = $1
         ORDER BY (sxe.estado_servicio = 'cancelado'), sxe.id_servicio_x_evento`,
        [req.params.id]
      ),
      pool.query(`${SELECT_TAREA} WHERE t.id_evento = $1 ${ORDEN_TAREAS}`, [req.params.id]),
      pool.query(
        `${SELECT_REVISION}
         WHERE ce.id_evento = $1 AND ac.revisado = FALSE AND ${condicionRevisionDelEmpleado(2)}
         ${ORDEN_REVISIONES}`,
        [req.params.id, idEmpleado]
      ),
      pool.query(
        `${selectCambio({ conValores: !esEmpleado })} WHERE ce.id_evento = $1 ${ORDEN_CAMBIOS} LIMIT 5`,
        [req.params.id]
      )
    ]);

    const { evento: datosEvento, cliente: datosCliente, ...indicadores } = evento.rows[0];

    res.json({
      evento: datosEvento,
      cliente: datosCliente,
      indicadores,
      servicios: servicios.rows,
      tareas: tareas.rows,
      revisiones_pendientes: revisiones.rows,
      ultimos_cambios: cambios.rows
    });
  } catch (error) {
    responderError(res, error);
  }
};
