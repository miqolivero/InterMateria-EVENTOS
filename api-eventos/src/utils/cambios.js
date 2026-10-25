// Historial de cambios del evento y compromisos a revisar (Fase 11).
//
// Criterio del cliente: el sistema REGISTRA lo que cambia y AVISA que
// compromisos quedaron afectados, pero no decide nada solo. Por eso aca no hay
// ningun UPDATE sobre tareas ni proveedores: solo se escribe en cambios_evento
// y en afectados_cambio.
//
// Todo se llama con el client de la transaccion del cambio: si el registro
// falla, el ROLLBACK deshace tambien el cambio. No puede quedar un evento
// modificado sin su registro, ni un registro de algo que no cambio.

import { esIdValido } from "./validaciones.js";

export const MENSAJES_CAMBIO = {
  motivoObligatorio: "El motivo del cambio es obligatorio",
  sinCambios: "No hay cambios para registrar",
  tareasAjenas: "Alguna de las tareas no pertenece a este evento",
  servicioCancelado: "El servicio esta cancelado"
};

// Texto con contenido: un motivo hecho solo de espacios no es un motivo
export const tieneTexto = (valor) => typeof valor === "string" && valor.trim() !== "";

// tareas_afectadas es opcional. Si viene, es una lista de ids. Devuelve la
// lista sin repetidos, o null si el formato es invalido (que responde el
// mismo 400 que una tarea de otro evento: no existe en este evento).
export const leerTareasAfectadas = (valor) => {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor) || !valor.every(esIdValido)) return null;
  return [...new Set(valor.map(Number))];
};

// Todas las tareas elegidas tienen que ser de ESTE evento
export const sonTareasDelEvento = async (client, idEvento, ids) => {
  if (ids.length === 0) return true;
  const { rows } = await client.query(
    "SELECT COUNT(*)::int AS cantidad FROM tareas WHERE id_evento = $1 AND id_tarea = ANY($2::int[])",
    [idEvento, ids]
  );
  return rows[0].cantidad === ids.length;
};

// Una fila de cambios_evento. Devuelve el id_cambio.
export const registrarCambio = async (client, cambio) => {
  const { rows } = await client.query(
    `INSERT INTO cambios_evento (id_evento, id_usuario, tipo, id_servicio_x_evento,
                                 id_proveedor_anterior, id_proveedor_nuevo,
                                 descripcion, valor_anterior, valor_nuevo, motivo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id_cambio`,
    [
      cambio.idEvento,
      cambio.idUsuario,
      cambio.tipo,
      cambio.idServicioEvento ?? null,
      cambio.idProveedorAnterior ?? null,
      cambio.idProveedorNuevo ?? null,
      cambio.descripcion,
      cambio.valorAnterior ?? null,
      cambio.valorNuevo ?? null,
      cambio.motivo.trim()
    ]
  );
  return rows[0].id_cambio;
};

// Marca a revisar los servicios y las tareas indicados, vinculados al cambio.
// Un INSERT por tipo, con unnest: una sola consulta aunque sean muchos.
export const marcarAfectados = async (client, idCambio, { servicios = [], tareas = [] }) => {
  if (servicios.length > 0) {
    await client.query(
      `INSERT INTO afectados_cambio (id_cambio, id_servicio_x_evento)
       SELECT $1, unnest($2::int[])`,
      [idCambio, servicios]
    );
  }
  if (tareas.length > 0) {
    await client.query(
      `INSERT INTO afectados_cambio (id_cambio, id_tarea)
       SELECT $1, unnest($2::int[])`,
      [idCambio, tareas]
    );
  }
};

// Objeto Cambio del contrato. conValores = false es la version del empleado:
// sin valor_anterior ni valor_nuevo (en servicio_modificado llevan importes).
// Las columnas se nombran una por una: un campo nuevo de la tabla no se cuela.
export const selectCambio = ({ conValores = true } = {}) => `
  SELECT ce.id_cambio, ce.id_evento, ce.fecha_hora, ce.tipo, ce.descripcion,
         ${conValores ? "ce.valor_anterior, ce.valor_nuevo," : ""}
         ce.motivo,
         json_build_object('id_usuario', u.id_usuario, 'nombre', u.nombre) AS usuario,
         CASE WHEN ce.id_servicio_x_evento IS NULL THEN NULL
              ELSE json_build_object('id_servicio_x_evento', ce.id_servicio_x_evento,
                                     'nombre_servicio', svc.nombre) END AS servicio,
         CASE WHEN pa.id_proveedor IS NULL THEN NULL
              ELSE json_build_object('id_proveedor', pa.id_proveedor,
                                     'razon_social', pa.razon_social) END AS proveedor_anterior,
         CASE WHEN pn.id_proveedor IS NULL THEN NULL
              ELSE json_build_object('id_proveedor', pn.id_proveedor,
                                     'razon_social', pn.razon_social) END AS proveedor_nuevo,
         (SELECT COUNT(*)::int FROM afectados_cambio ac
          WHERE ac.id_cambio = ce.id_cambio) AS afectados,
         (SELECT COUNT(*)::int FROM afectados_cambio ac
          WHERE ac.id_cambio = ce.id_cambio AND ac.revisado = FALSE) AS pendientes_revision
  FROM cambios_evento ce
  JOIN usuarios u ON u.id_usuario = ce.id_usuario
  LEFT JOIN servicios_x_evento sxc ON sxc.id_servicio_x_evento = ce.id_servicio_x_evento
  LEFT JOIN servicios svc ON svc.id_servicio = sxc.id_servicio
  LEFT JOIN proveedores pa ON pa.id_proveedor = ce.id_proveedor_anterior
  LEFT JOIN proveedores pn ON pn.id_proveedor = ce.id_proveedor_nuevo`;

export const ORDEN_CAMBIOS = "ORDER BY ce.fecha_hora DESC, ce.id_cambio DESC";

// Los cambios recien creados, para la respuesta del endpoint que los registro
export const buscarCambios = async (client, ids) => {
  if (ids.length === 0) return [];
  const { rows } = await client.query(
    `${selectCambio()} WHERE ce.id_cambio = ANY($1::int[]) ORDER BY ce.id_cambio`,
    [ids]
  );
  return rows;
};

// Objeto Revision del contrato (un compromiso afectado). Se suma id_evento,
// que el front usa para ir al evento desde el panel del empleado.
export const SELECT_REVISION = `
  SELECT ac.id_afectado, ce.id_evento,
         CASE WHEN ac.id_tarea IS NULL THEN 'servicio' ELSE 'tarea' END AS tipo,
         ac.id_servicio_x_evento, svr.nombre AS nombre_servicio,
         ac.id_tarea, tr.descripcion AS descripcion_tarea,
         CASE WHEN er.id_empleado IS NULL THEN NULL
              ELSE json_build_object('id_empleado', er.id_empleado,
                                     'nombre', er.nombre || ' ' || er.apellido) END AS responsable,
         ac.revisado, ac.nota_revision,
         CASE WHEN ur.id_usuario IS NULL THEN NULL
              ELSE json_build_object('id_usuario', ur.id_usuario, 'nombre', ur.nombre) END AS revisado_por,
         ac.fecha_revision,
         json_build_object('id_cambio', ce.id_cambio, 'tipo', ce.tipo,
                           'descripcion', ce.descripcion, 'motivo', ce.motivo,
                           'fecha_hora', ce.fecha_hora) AS cambio
  FROM afectados_cambio ac
  JOIN cambios_evento ce ON ce.id_cambio = ac.id_cambio
  JOIN eventos e ON e.id_evento = ce.id_evento
  LEFT JOIN servicios_x_evento sxr ON sxr.id_servicio_x_evento = ac.id_servicio_x_evento
  LEFT JOIN servicios svr ON svr.id_servicio = sxr.id_servicio
  LEFT JOIN tareas tr ON tr.id_tarea = ac.id_tarea
  LEFT JOIN empleados er ON er.id_empleado = tr.id_empleado_responsable
  LEFT JOIN usuarios ur ON ur.id_usuario = ac.id_usuario_revision`;

// Regla 11 aplicada a las revisiones: el empleado ve las de SUS tareas y las
// de los servicios que gestiona (donde es responsable de alguna tarea).
// $n es el id_empleado, o null para admin y coordinador (ven todas).
export const condicionRevisionDelEmpleado = (n) => `($${n}::int IS NULL
   OR tr.id_empleado_responsable = $${n}::int
   OR EXISTS (SELECT 1 FROM tareas tg
              WHERE tg.id_servicio_x_evento = ac.id_servicio_x_evento
                AND tg.id_empleado_responsable = $${n}::int))`;

export const ORDEN_REVISIONES =
  "ORDER BY ac.revisado, ce.fecha_hora DESC, (ac.id_tarea IS NOT NULL), ac.id_afectado";
