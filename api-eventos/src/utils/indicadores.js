// Definiciones que se calculan y no se guardan: "vencida", "a revisar" y los
// indicadores del evento (Fase 11). Estan escritas UNA sola vez y las usan el
// resumen del evento, el tablero, los servicios y las tareas. Asi el numero
// del tablero y el de la pantalla del evento salen siempre de la misma regla.
//
// Son fragmentos de SQL, igual que el resto de las consultas del proyecto:
// la base cuenta y filtra, y la condicion se puede revisar a mano en psql.

// Regla 1: una tarea vencida tiene fecha prevista pasada y no esta completada.
// Una tarea sin fecha prevista nunca esta vencida (null < fecha da null, por
// eso se chequea aparte).
export const CONDICION_VENCIDA = `(t.fecha_prevista IS NOT NULL
   AND t.fecha_prevista < CURRENT_DATE
   AND t.estado_tarea <> 'completada')`;

// Servicios del evento (alias sxe). Un servicio cancelado no cuenta en ningun
// indicador: no esta ni confirmado ni sin confirmar.
export const SERVICIO_ACORDADO = "sxe.estado_servicio = 'acordado'";

// Confirmado: hay proveedor y respondio que si (o ya cumplio)
export const SERVICIO_CONFIRMADO = `(${SERVICIO_ACORDADO}
   AND sxe.id_proveedor IS NOT NULL
   AND sxe.estado_proveedor IN ('confirmado', 'completado'))`;

// Sin confirmar: todo servicio acordado que no esta confirmado. Incluye el
// proveedor pendiente, el que rechazo y el servicio sin proveedor asignado.
// Asi confirmados + sin confirmar = total, sin huecos.
export const SERVICIO_SIN_CONFIRMAR = `(${SERVICIO_ACORDADO}
   AND NOT (sxe.id_proveedor IS NOT NULL
            AND sxe.estado_proveedor IN ('confirmado', 'completado')))`;

// "A revisar": tiene alguna fila en afectados_cambio sin revisar. Igual que
// "vencida", no es una columna. Se reciben el alias y la columna porque se
// usa con servicios (sxe.id_servicio_x_evento) y con tareas (t.id_tarea).
const pendientes = (columna, valor) => `
  SELECT 1 FROM afectados_cambio ac
  WHERE ac.${columna} = ${valor} AND ac.revisado = FALSE`;

export const servicioARevisar = (sxe = "sxe") =>
  `EXISTS (${pendientes("id_servicio_x_evento", `${sxe}.id_servicio_x_evento`)})`;

export const servicioPendientesRevision = (sxe = "sxe") =>
  `(SELECT COUNT(*)::int FROM (${pendientes("id_servicio_x_evento", `${sxe}.id_servicio_x_evento`)}) p)`;

export const tareaARevisar = (t = "t") =>
  `EXISTS (${pendientes("id_tarea", `${t}.id_tarea`)})`;

export const tareaPendientesRevision = (t = "t") =>
  `(SELECT COUNT(*)::int FROM (${pendientes("id_tarea", `${t}.id_tarea`)}) p)`;

// Compromisos a revisar de un evento: los afectados sin revisar de todos sus
// cambios. Incluye los de un servicio que despues se cancelo: la revision
// queda abierta hasta que alguien deje la nota (cerrarla sola seria decidir).
export const PENDIENTES_DEL_EVENTO = `
  SELECT COUNT(*)::int FROM afectados_cambio ac
  JOIN cambios_evento ce ON ce.id_cambio = ac.id_cambio
  WHERE ce.id_evento = e.id_evento AND ac.revisado = FALSE`;

// Los indicadores del evento (alias e), para sumar a cualquier consulta de
// eventos con un JOIN. Las columnas quedan en "ind". Cada conteo va en su
// propio subselect: juntar tareas y servicios en un mismo GROUP BY
// multiplicaria las filas y los numeros saldrian inflados.
//
// alerta: hay servicios sin confirmar o compromisos a revisar. Terminar las
// tareas NO la apaga (pedido explicito del cliente).
export const JOIN_INDICADORES = `
  CROSS JOIN LATERAL (
    SELECT ta.tareas_completadas, ta.tareas_total,
           sv.servicios_confirmados, sv.servicios_total,
           ta.tareas_vencidas, sv.servicios_sin_confirmar,
           rv.pendientes_revision,
           (sv.servicios_sin_confirmar > 0 OR rv.pendientes_revision > 0) AS alerta
    FROM (SELECT COUNT(*) FILTER (WHERE t.estado_tarea = 'completada')::int AS tareas_completadas,
                 COUNT(*)::int AS tareas_total,
                 COUNT(*) FILTER (WHERE ${CONDICION_VENCIDA})::int AS tareas_vencidas
          FROM tareas t WHERE t.id_evento = e.id_evento) ta,
         (SELECT COUNT(*) FILTER (WHERE ${SERVICIO_CONFIRMADO})::int AS servicios_confirmados,
                 COUNT(*) FILTER (WHERE ${SERVICIO_ACORDADO})::int AS servicios_total,
                 COUNT(*) FILTER (WHERE ${SERVICIO_SIN_CONFIRMAR})::int AS servicios_sin_confirmar
          FROM servicios_x_evento sxe WHERE sxe.id_evento = e.id_evento) sv,
         (${PENDIENTES_DEL_EVENTO}) AS rv(pendientes_revision)
  ) ind`;

// Las columnas de JOIN_INDICADORES en el orden del contrato
export const COLUMNAS_INDICADORES = `
  ind.tareas_completadas, ind.tareas_total,
  ind.servicios_confirmados, ind.servicios_total,
  ind.tareas_vencidas, ind.servicios_sin_confirmar,
  ind.pendientes_revision, ind.alerta`;
