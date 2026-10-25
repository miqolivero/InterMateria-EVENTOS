import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { esEnteroPositivo, esFechaValida } from "../utils/validaciones.js";
import {
  SERVICIO_SIN_CONFIRMAR,
  JOIN_INDICADORES,
  COLUMNAS_INDICADORES,
  servicioARevisar
} from "../utils/indicadores.js";
import { ESTADOS_EVENTO_ABIERTO } from "./eventos.controller.js";
import {
  CONDICION_VENCIDA,
  selectTarea,
  COLUMNAS_EVENTO_DE_TAREA,
  JOINS_EVENTO_DE_TAREA
} from "./tareas.controller.js";

// Seguimiento: el tablero que responde "que falta resolver" cuando hay varios
// eventos en paralelo, que es el problema principal del relevamiento.
//
// Solo lectura. Todo se calcula en SQL con COUNT, FILTER y GROUP BY: la base
// cuenta mucho mas rapido que traer las filas a JavaScript, y asi el numero
// que se ve en el tablero sale de la misma consulta que se puede revisar a mano.
//
// Siempre sobre eventos ABIERTOS (confirmado o en_preparacion) de la empresa
// del token. ?dias (por defecto 30) define la ventana de los "proximos"; las
// tareas vencidas y los servicios sin confirmar son de TODOS los eventos
// abiertos, asi el numero de cada tarjeta coincide con el largo de su lista.

const DIAS_POR_DEFECTO = 30;
const DIAS_MAXIMO = 365;

// ?dias valido: entero entre 1 y 365. Cualquier otra cosa usa el default, como
// los demas filtros invalidos de la API.
const leerDias = (query) =>
  esEnteroPositivo(query.dias) && Number(query.dias) <= DIAS_MAXIMO
    ? Number(query.dias)
    : DIAS_POR_DEFECTO;

// "Sin confirmar" (Fase 11): servicio acordado con el proveedor pendiente o
// rechazado, o sin proveedor. La definicion vive en utils/indicadores.js, la
// misma que usa el resumen del evento.
const CONDICION_SIN_CONFIRMAR = SERVICIO_SIN_CONFIRMAR;

// Proximo = abierto y con fecha entre hoy y hoy + dias ($2)
const CONDICION_PROXIMO = `e.fecha_evento_confirmada
   BETWEEN CURRENT_DATE AND CURRENT_DATE + $2::int`;

// GET /api/seguimiento/resumen?dias=30
// Los numeros del tablero en una sola consulta: cada uno es un subselect con
// COUNT(*), filtrado por empresa y por eventos abiertos. pendientes_revision
// (Fase 11): los compromisos a revisar de todos los eventos abiertos.
export const obtenerResumen = async (req, res) => {
  const dias = leerDias(req.query);

  try {
    const resultado = await pool.query(
      `SELECT
         $2::int AS dias,
         (SELECT COUNT(*)::int FROM eventos e
          WHERE e.id_empresa = $1 AND e.estado = ANY($3)
            AND ${CONDICION_PROXIMO}) AS eventos_proximos,
         (SELECT COUNT(*) FILTER (WHERE ${CONDICION_VENCIDA})::int
          FROM tareas t JOIN eventos e ON e.id_evento = t.id_evento
          WHERE e.id_empresa = $1 AND e.estado = ANY($3)) AS tareas_vencidas,
         (SELECT COUNT(*) FILTER (WHERE t.estado_tarea <> 'completada')::int
          FROM tareas t JOIN eventos e ON e.id_evento = t.id_evento
          WHERE e.id_empresa = $1 AND e.estado = ANY($3)) AS tareas_pendientes,
         (SELECT COUNT(*)::int
          FROM servicios_x_evento sxe JOIN eventos e ON e.id_evento = sxe.id_evento
          WHERE e.id_empresa = $1 AND e.estado = ANY($3)
            AND ${CONDICION_SIN_CONFIRMAR}) AS servicios_sin_confirmar,
         (SELECT COUNT(*)::int FROM solicitudes
          WHERE id_empresa = $1 AND estado = 'pendiente') AS solicitudes_pendientes,
         (SELECT COUNT(*)::int
          FROM afectados_cambio ac
          JOIN cambios_evento ce ON ce.id_cambio = ac.id_cambio
          JOIN eventos e ON e.id_evento = ce.id_evento
          WHERE e.id_empresa = $1 AND e.estado = ANY($3)
            AND ac.revisado = FALSE) AS pendientes_revision`,
      [req.usuario.id_empresa, dias, ESTADOS_EVENTO_ABIERTO]
    );

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/seguimiento/proximos-eventos?dias=30
// Una fila por evento proximo con sus indicadores (Fase 11): tareas X de Y,
// servicios confirmados X de Y y la alerta. Reemplazan al porcentaje de
// avance, que con todas las tareas hechas daba 100% aunque un proveedor no
// hubiera confirmado. Salen de JOIN_INDICADORES, la misma definicion que el
// resumen del evento.
export const obtenerProximosEventos = async (req, res) => {
  const dias = leerDias(req.query);

  try {
    const resultado = await pool.query(
      `SELECT e.id_evento,
              CONCAT_WS(' ', c.nombre, NULLIF(c.apellido, '-')) AS nombre_cliente,
              te.nombre AS nombre_tipo_evento,
              e.fecha_evento_confirmada,
              e.fecha_evento_confirmada - CURRENT_DATE AS dias_restantes,
              e.estado,
              emp.nombre || ' ' || emp.apellido AS nombre_coordinador,
              ${COLUMNAS_INDICADORES}
       FROM eventos e
       JOIN solicitudes s ON s.id_solicitud = e.id_solicitud
       JOIN clientes c ON c.id_cliente = s.id_cliente
       JOIN tipos_eventos te ON te.id_tipo_evento = s.id_tipo_evento
       LEFT JOIN empleados emp ON emp.id_empleado = e.id_empleado_coordinador
       ${JOIN_INDICADORES}
       WHERE e.id_empresa = $1 AND e.estado = ANY($3)
         AND ${CONDICION_PROXIMO}
       ORDER BY e.fecha_evento_confirmada, e.id_evento`,
      [req.usuario.id_empresa, dias, ESTADOS_EVENTO_ABIERTO]
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/seguimiento/tareas-vencidas
// Las tareas vencidas de todos los eventos abiertos, con los datos del evento
// (igual que "mis tareas") y cuantos dias hace que vencieron. Las mas atrasadas
// primero.
export const obtenerTareasVencidas = async (req, res) => {
  try {
    const consulta = selectTarea(
      `${COLUMNAS_EVENTO_DE_TAREA},
       CURRENT_DATE - t.fecha_prevista AS dias_vencida`,
      JOINS_EVENTO_DE_TAREA
    );

    const resultado = await pool.query(
      `${consulta}
       WHERE e.id_empresa = $1 AND e.estado = ANY($2)
         AND ${CONDICION_VENCIDA}
       ORDER BY dias_vencida DESC, t.id_tarea`,
      [req.usuario.id_empresa, ESTADOS_EVENTO_ABIERTO]
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/seguimiento/servicios-sin-confirmar
// Los servicios de eventos abiertos que todavia no tienen un proveedor
// comprometido, empezando por el evento mas cercano. Los cancelados no estan:
// la condicion exige estado_servicio = 'acordado'.
export const obtenerServiciosSinConfirmar = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT sxe.id_servicio_x_evento, sxe.id_evento,
              CONCAT_WS(' ', c.nombre, NULLIF(c.apellido, '-')) AS nombre_cliente,
              e.fecha_evento_confirmada,
              e.fecha_evento_confirmada - CURRENT_DATE AS dias_para_evento,
              sv.nombre AS nombre_servicio,
              pr.razon_social AS nombre_proveedor,
              sxe.estado_proveedor,
              sxe.estado_servicio,
              ${servicioARevisar("sxe")} AS a_revisar
       FROM servicios_x_evento sxe
       JOIN eventos e ON e.id_evento = sxe.id_evento
       JOIN solicitudes s ON s.id_solicitud = e.id_solicitud
       JOIN clientes c ON c.id_cliente = s.id_cliente
       JOIN servicios sv ON sv.id_servicio = sxe.id_servicio
       LEFT JOIN proveedores pr ON pr.id_proveedor = sxe.id_proveedor
       WHERE e.id_empresa = $1 AND e.estado = ANY($2)
         AND ${CONDICION_SIN_CONFIRMAR}
       ORDER BY dias_para_evento, sxe.id_servicio_x_evento`,
      [req.usuario.id_empresa, ESTADOS_EVENTO_ABIERTO]
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// ---------------------------------------------------------------------------
// Fase 11 · Eventos por estado
// ---------------------------------------------------------------------------

const SITUACIONES = [
  "esperando_respuesta",
  "confirmado",
  "en_preparacion",
  "realizado",
  "cancelado",
  "solicitud_rechazada",
  "solicitud_cancelada"
];

// GET /api/seguimiento/por-estado?situacion=a,b&desde=&hasta=
// Junta en una lista las solicitudes que todavia no son eventos y los eventos,
// cada uno con su situacion. Distingue lo que espera respuesta del cliente
// (presupuesto presentado) de lo ya confirmado. Nada se borra: los cancelados
// y los rechazados siguen apareciendo.
//
// - Una solicitud con evento aparece solo como evento (una solicitud
//   cancelada con su evento cancelado es "cancelado", no dos filas).
// - Las solicitudes pendientes sin presupuesto presentado no estan: son de la
//   pantalla de Solicitudes.
// - conteo respeta desde/hasta pero no situacion: asi el numero de cada
//   pestana no cambia al elegir otra.
export const obtenerPorEstado = async (req, res) => {
  const { desde, hasta } = req.query;

  // Los filtros invalidos se ignoran, como en el resto de la API
  const valores = [req.usuario.id_empresa];
  const condicionesFecha = [];
  if (desde && esFechaValida(desde)) {
    valores.push(desde);
    condicionesFecha.push(`fecha >= $${valores.length}`);
  }
  if (hasta && esFechaValida(hasta)) {
    valores.push(hasta);
    condicionesFecha.push(`fecha <= $${valores.length}`);
  }

  const pedidas = String(req.query.situacion ?? "")
    .split(",")
    .map((valor) => valor.trim())
    .filter((valor) => SITUACIONES.includes(valor));

  try {
    // El presupuesto presentado de cada solicitud (el mas nuevo, por si
    // hubiera dos) va en LATERAL para no duplicar filas.
    const { rows } = await pool.query(
      `WITH items AS (
         SELECT 'evento' AS tipo, s.id_solicitud, e.id_evento,
                e.estado AS situacion,
                CONCAT_WS(' ', c.nombre, NULLIF(c.apellido, '-')) AS nombre_cliente,
                te.nombre AS nombre_tipo_evento,
                e.fecha_evento_confirmada AS fecha,
                NULL::int AS id_presupuesto_presentado
         FROM eventos e
         JOIN solicitudes s ON s.id_solicitud = e.id_solicitud
         JOIN clientes c ON c.id_cliente = s.id_cliente
         JOIN tipos_eventos te ON te.id_tipo_evento = s.id_tipo_evento
         WHERE e.id_empresa = $1
         UNION ALL
         SELECT 'solicitud', s.id_solicitud, NULL,
                CASE s.estado WHEN 'rechazada' THEN 'solicitud_rechazada'
                              WHEN 'cancelada' THEN 'solicitud_cancelada'
                              ELSE 'esperando_respuesta' END,
                CONCAT_WS(' ', c.nombre, NULLIF(c.apellido, '-')),
                te.nombre,
                s.fecha_evento_prevista,
                pp.id_presupuesto
         FROM solicitudes s
         JOIN clientes c ON c.id_cliente = s.id_cliente
         JOIN tipos_eventos te ON te.id_tipo_evento = s.id_tipo_evento
         LEFT JOIN LATERAL (
           SELECT p.id_presupuesto FROM presupuestos p
           WHERE p.id_solicitud = s.id_solicitud AND p.estado = 'presentado'
           ORDER BY p.numero_version DESC LIMIT 1
         ) pp ON TRUE
         WHERE s.id_empresa = $1
           AND NOT EXISTS (SELECT 1 FROM eventos e2 WHERE e2.id_solicitud = s.id_solicitud)
           AND (s.estado IN ('rechazada', 'cancelada')
                OR (s.estado IN ('pendiente', 'presupuestada') AND pp.id_presupuesto IS NOT NULL))
       )
       SELECT * FROM items
       ${condicionesFecha.length ? `WHERE ${condicionesFecha.join(" AND ")}` : ""}
       ORDER BY fecha, tipo, id_solicitud`,
      valores
    );

    const conteo = Object.fromEntries(SITUACIONES.map((situacion) => [situacion, 0]));
    for (const item of rows) conteo[item.situacion] += 1;

    res.json({
      conteo,
      items: pedidas.length ? rows.filter((item) => pedidas.includes(item.situacion)) : rows
    });
  } catch (error) {
    responderError(res, error);
  }
};
