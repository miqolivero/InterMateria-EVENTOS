import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { esEnteroPositivo } from "../utils/validaciones.js";
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

// "Sin confirmar" segun el contrato: el proveedor todavia no respondio
// (solicitada) o directamente no hay proveedor asignado.
const CONDICION_SIN_CONFIRMAR = `(sxe.estado_proveedor = 'solicitada'
   OR sxe.id_proveedor IS NULL)`;

// Proximo = abierto y con fecha entre hoy y hoy + dias ($2)
const CONDICION_PROXIMO = `e.fecha_evento_confirmada
   BETWEEN CURRENT_DATE AND CURRENT_DATE + $2::int`;

// GET /api/seguimiento/resumen?dias=30
// Los cinco numeros del tablero en una sola consulta: cada uno es un
// subselect con COUNT(*), filtrado por empresa y por eventos abiertos.
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
          WHERE id_empresa = $1 AND estado = 'pendiente') AS solicitudes_pendientes`,
      [req.usuario.id_empresa, dias, ESTADOS_EVENTO_ABIERTO]
    );

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/seguimiento/proximos-eventos?dias=30
// Una fila por evento proximo con su avance. Las tareas y los servicios se
// cuentan en LATERAL (una vez por evento) en vez de con un doble LEFT JOIN:
// juntar tareas y servicios en el mismo GROUP BY multiplicaria las filas y
// los conteos saldrian inflados.
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
              ta.total_tareas,
              ta.tareas_completadas,
              -- Entero de 0 a 100; NULLIF evita dividir por 0 y COALESCE
              -- deja 0 cuando el evento no tiene tareas
              COALESCE(ROUND(100.0 * ta.tareas_completadas
                             / NULLIF(ta.total_tareas, 0))::int, 0) AS porcentaje_avance,
              ta.tareas_vencidas,
              sv.servicios_sin_confirmar
       FROM eventos e
       JOIN solicitudes s ON s.id_solicitud = e.id_solicitud
       JOIN clientes c ON c.id_cliente = s.id_cliente
       JOIN tipos_eventos te ON te.id_tipo_evento = s.id_tipo_evento
       LEFT JOIN empleados emp ON emp.id_empleado = e.id_empleado_coordinador
       CROSS JOIN LATERAL (
         SELECT COUNT(*)::int AS total_tareas,
                COUNT(*) FILTER (WHERE t.estado_tarea = 'completada')::int AS tareas_completadas,
                COUNT(*) FILTER (WHERE ${CONDICION_VENCIDA})::int AS tareas_vencidas
         FROM tareas t
         WHERE t.id_evento = e.id_evento
       ) ta
       CROSS JOIN LATERAL (
         SELECT COUNT(*)::int AS servicios_sin_confirmar
         FROM servicios_x_evento sxe
         WHERE sxe.id_evento = e.id_evento AND ${CONDICION_SIN_CONFIRMAR}
       ) sv
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
// comprometido, empezando por el evento mas cercano.
export const obtenerServiciosSinConfirmar = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT sxe.id_servicio_x_evento, sxe.id_evento,
              CONCAT_WS(' ', c.nombre, NULLIF(c.apellido, '-')) AS nombre_cliente,
              e.fecha_evento_confirmada,
              e.fecha_evento_confirmada - CURRENT_DATE AS dias_para_evento,
              sv.nombre AS nombre_servicio,
              pr.razon_social AS nombre_proveedor,
              sxe.estado_proveedor
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
