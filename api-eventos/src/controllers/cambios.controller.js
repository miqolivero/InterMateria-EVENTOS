import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
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
  servicioPendientesRevision
} from "../utils/indicadores.js";
import { ESTADOS_EVENTO_ABIERTO, MENSAJE_EVENTO_CERRADO, SELECT_SERVICIO_EVENTO } from "./eventos.controller.js";
import { SELECT_TAREA, ORDEN_TAREAS, responsableObligatorio } from "./tareas.controller.js";

// Fase 11: lo que se lee del historial de cambios y de los compromisos a
// revisar, y el resumen del evento (la vista completa, tambien para el
// empleado). Revisar es lo unico que se escribe aca, y solo deja constancia:
// no toca la tarea ni el proveedor.

const MENSAJES = {
  eventoNoEncontrado: "Evento no encontrado",
  revisionNoEncontrada: "Revision no encontrada",
  notaObligatoria: "La nota de revision es obligatoria",
  yaRevisado: "Ya fue revisado"
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
// una nota obligatoria ("dejar constancia", pidio el cliente). NO cambia
// nada mas: si hay que mover la tarea o cambiar el proveedor, se hace con sus
// propios endpoints. Con el evento cerrado no se modifica, como todo lo demas.
export const revisarAfectado = async (req, res) => {
  const { id_empresa: idEmpresa } = req.usuario;
  const idEmpleado = responsableObligatorio(req.usuario);
  const nota = req.body?.nota_revision;

  if (!tieneTexto(nota)) {
    return res.status(400).json({ mensaje: MENSAJES.notaObligatoria });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Bloqueado: si dos personas revisan lo mismo a la vez, la segunda ve que
    // ya esta revisado y recibe 409
    const { rows } = await client.query(
      `SELECT ac.revisado, e.estado AS estado_evento
       FROM afectados_cambio ac
       JOIN cambios_evento ce ON ce.id_cambio = ac.id_cambio
       JOIN eventos e ON e.id_evento = ce.id_evento
       LEFT JOIN tareas tr ON tr.id_tarea = ac.id_tarea
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

    if (error) {
      await client.query("ROLLBACK");
      return res.status(error[0]).json({ mensaje: error[1] });
    }

    await client.query(
      `UPDATE afectados_cambio
       SET revisado = TRUE, id_usuario_revision = $1, fecha_revision = NOW(),
           nota_revision = $2
       WHERE id_afectado = $3`,
      [req.usuario.id, nota.trim(), req.params.id]
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
