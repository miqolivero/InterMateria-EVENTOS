import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { esEmpleadoActivo } from "../utils/consultas.js";
import { esIdValido, esFechaValida, esVacio } from "../utils/validaciones.js";
import {
  ESTADOS_EVENTO_ABIERTO,
  MENSAJE_EVENTO_CERRADO
} from "./eventos.controller.js";

// Tareas: el trabajo del personal en cada evento. Hay dos clases:
// - de la secuencia del proveedor: tienen id_tipo_tarea y siguen el orden de
//   tipos_tarea (contactar -> confirmar -> seguimiento -> cierre). Se crean
//   con "generar tareas" en servicios-evento;
// - libres: trabajo interno, sin tipo ni secuencia.
//
// La tabla tareas no tiene id_empresa: una tarea es de la empresa de su
// evento. Por eso todo entra por JOIN eventos e ... AND e.id_empresa.
//
// Reglas de CLAUDE.md que se aplican aca:
// - Regla 1: "vencida" no se guarda, se calcula en el SQL.
// - Regla 5: un paso no arranca si el anterior no esta completado.
// - Regla 6: completar una tarea NO cambia el estado del proveedor.
// - Regla 7: completar guarda fecha_finalizacion; reabrir la limpia.
// - Regla 9: el responsable es un empleado activo de la empresa.

const MENSAJES = {
  noEncontrada: "Tarea no encontrada",
  eventoNoEncontrado: "Evento no encontrado",
  obligatorios: "La descripcion, el responsable y la fecha prevista son obligatorios",
  responsableInvalido: "El responsable no es un empleado activo de la empresa",
  servicioAjeno: "El servicio no pertenece a este evento",
  estadoInvalido: "Estado de tarea invalido",
  reabrir: "No se puede reabrir: el paso siguiente ya empezo",
  noEliminable: "Las tareas de la secuencia del proveedor no se pueden eliminar"
};

const ESTADOS_TAREA = ["pendiente", "en_curso", "completada"];

// Regla 1, escrita una sola vez. Una tarea sin fecha prevista nunca esta
// vencida (null < fecha da null, por eso se chequea aparte). Se exporta para
// que el tablero de seguimiento (fase 7) cuente exactamente lo mismo.
export const CONDICION_VENCIDA = `(t.fecha_prevista IS NOT NULL
   AND t.fecha_prevista < CURRENT_DATE
   AND t.estado_tarea <> 'completada')`;

// Objeto Tarea del contrato. Servicio, proveedor, tipo y responsable van con
// LEFT JOIN porque en una tarea libre no existen, y la tarea no puede
// desaparecer del listado por eso.
//
// columnasExtra / joinsExtra: "mis tareas" agrega datos del evento (cliente,
// tipo, fecha) sin repetir toda la consulta.
const selectTarea = (columnasExtra = "", joinsExtra = "") => `
  SELECT t.id_tarea, t.id_evento, t.id_servicio_x_evento,
         sv.nombre AS nombre_servicio,
         pr.razon_social AS nombre_proveedor,
         t.id_tipo_tarea, tt.nombre AS nombre_tipo_tarea, tt.orden,
         t.descripcion, t.id_empleado_responsable,
         emp.nombre || ' ' || emp.apellido AS nombre_responsable,
         t.fecha_prevista, t.fecha_finalizacion, t.estado_tarea,
         t.observaciones,
         ${CONDICION_VENCIDA} AS vencida
         ${columnasExtra}
  FROM tareas t
  JOIN eventos e ON e.id_evento = t.id_evento
  LEFT JOIN servicios_x_evento sxe ON sxe.id_servicio_x_evento = t.id_servicio_x_evento
  LEFT JOIN servicios sv ON sv.id_servicio = sxe.id_servicio
  LEFT JOIN proveedores pr ON pr.id_proveedor = sxe.id_proveedor
  LEFT JOIN tipos_tarea tt ON tt.id_tipo_tarea = t.id_tipo_tarea
  LEFT JOIN empleados emp ON emp.id_empleado = t.id_empleado_responsable
  ${joinsExtra}`;

export const SELECT_TAREA = selectTarea();

// Orden del contrato: primero las tareas con servicio (por servicio y por paso)
// y despues las libres (por fecha prevista).
export const ORDEN_TAREAS = `
  ORDER BY (t.id_servicio_x_evento IS NULL), t.id_servicio_x_evento,
           tt.orden NULLS LAST, t.fecha_prevista NULLS LAST, t.id_tarea`;

const buscarTarea = async (ejecutor, idTarea, idEmpresa) => {
  const resultado = await ejecutor.query(
    `${SELECT_TAREA} WHERE t.id_tarea = $1 AND e.id_empresa = $2`,
    [idTarea, idEmpresa]
  );

  return resultado.rows[0] ?? null;
};

// Estado del evento si es de la empresa, o null. Sirve para el 404 y el 409.
const estadoEvento = async (ejecutor, idEvento, idEmpresa) => {
  const resultado = await ejecutor.query(
    "SELECT estado FROM eventos WHERE id_evento = $1 AND id_empresa = $2",
    [idEvento, idEmpresa]
  );

  return resultado.rows[0]?.estado ?? null;
};

// Datos de la tarea que hacen falta para validar un cambio: su evento (y si
// esta abierto) y si es de la secuencia.
const datosTarea = async (ejecutor, idTarea, idEmpresa) => {
  const resultado = await ejecutor.query(
    `SELECT t.id_tarea, t.id_evento, t.id_servicio_x_evento, t.id_tipo_tarea,
            t.estado_tarea, tt.orden, e.estado AS estado_evento
     FROM tareas t
     JOIN eventos e ON e.id_evento = t.id_evento
     LEFT JOIN tipos_tarea tt ON tt.id_tipo_tarea = t.id_tipo_tarea
     WHERE t.id_tarea = $1 AND e.id_empresa = $2`,
    [idTarea, idEmpresa]
  );

  return resultado.rows[0] ?? null;
};

// Validaciones del body del POST y del PUT que no necesitan la base
const validarFormatoTarea = (body) => {
  const { descripcion, id_empleado_responsable, fecha_prevista } = body;

  if (
    esVacio(descripcion) ||
    esVacio(id_empleado_responsable) ||
    !esFechaValida(fecha_prevista)
  ) {
    return MENSAJES.obligatorios;
  }

  if (!esIdValido(id_empleado_responsable)) {
    return MENSAJES.responsableInvalido;
  }

  return null;
};

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// GET /api/eventos/:id/tareas?estado_tarea=&vencidas=true
export const obtenerTareasDelEvento = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const { estado_tarea, vencidas } = req.query;

  try {
    // Un evento ajeno da 404, no []: no se revela que el id existe
    if (!(await estadoEvento(pool, req.params.id, idEmpresa))) {
      return res.status(404).json({ mensaje: MENSAJES.eventoNoEncontrado });
    }

    const condiciones = ["t.id_evento = $1"];
    const valores = [req.params.id];

    if (estado_tarea) {
      valores.push(estado_tarea);
      condiciones.push(`t.estado_tarea = $${valores.length}`);
    }

    // El filtro usa la misma condicion que el campo calculado
    if (vencidas === "true") {
      condiciones.push(CONDICION_VENCIDA);
    }

    const resultado = await pool.query(
      `${SELECT_TAREA} WHERE ${condiciones.join(" AND ")} ${ORDEN_TAREAS}`,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/eventos/:id/tareas
// Tarea libre: sin tipo, fuera de la secuencia. Opcionalmente asociada a un
// servicio del mismo evento.
export const crearTarea = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const {
    descripcion,
    id_empleado_responsable,
    fecha_prevista,
    id_servicio_x_evento,
    observaciones
  } = req.body;

  const errorFormato = validarFormatoTarea(req.body);
  if (errorFormato) {
    return res.status(400).json({ mensaje: errorFormato });
  }

  try {
    const estado = await estadoEvento(pool, req.params.id, idEmpresa);
    if (!estado) {
      return res.status(404).json({ mensaje: MENSAJES.eventoNoEncontrado });
    }
    if (!ESTADOS_EVENTO_ABIERTO.includes(estado)) {
      return res.status(409).json({ mensaje: MENSAJE_EVENTO_CERRADO });
    }

    if (!(await esEmpleadoActivo(pool, id_empleado_responsable, idEmpresa))) {
      return res.status(400).json({ mensaje: MENSAJES.responsableInvalido });
    }

    // El servicio tiene que ser de ESTE evento: si no, una tarea quedaria
    // colgando de un servicio de otro evento (o de otra empresa).
    if (!esVacio(id_servicio_x_evento)) {
      const servicio = esIdValido(id_servicio_x_evento)
        ? await pool.query(
            `SELECT 1 FROM servicios_x_evento
             WHERE id_servicio_x_evento = $1 AND id_evento = $2`,
            [id_servicio_x_evento, req.params.id]
          )
        : { rows: [] };

      if (servicio.rows.length === 0) {
        return res.status(400).json({ mensaje: MENSAJES.servicioAjeno });
      }
    }

    // estado_tarea ('pendiente') lo pone el DEFAULT. id_tipo_tarea queda null:
    // por eso es libre y no entra en la secuencia.
    const resultado = await pool.query(
      `INSERT INTO tareas (id_evento, id_empleado_responsable, id_servicio_x_evento,
                           descripcion, fecha_prevista, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_tarea`,
      [
        req.params.id,
        id_empleado_responsable,
        esVacio(id_servicio_x_evento) ? null : id_servicio_x_evento,
        descripcion,
        fecha_prevista,
        observaciones ?? null
      ]
    );

    res
      .status(201)
      .json(await buscarTarea(pool, resultado.rows[0].id_tarea, idEmpresa));
  } catch (error) {
    responderError(res, error);
  }
};

// PUT /api/tareas/:id
// Edita descripcion, responsable, fecha prevista y observaciones. El estado
// se cambia con el PATCH, que es donde se controla la secuencia.
export const editarTarea = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const { descripcion, id_empleado_responsable, fecha_prevista, observaciones } =
    req.body;

  const errorFormato = validarFormatoTarea(req.body);
  if (errorFormato) {
    return res.status(400).json({ mensaje: errorFormato });
  }

  try {
    const tarea = await datosTarea(pool, req.params.id, idEmpresa);
    if (!tarea) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrada });
    }
    if (!ESTADOS_EVENTO_ABIERTO.includes(tarea.estado_evento)) {
      return res.status(409).json({ mensaje: MENSAJE_EVENTO_CERRADO });
    }

    if (!(await esEmpleadoActivo(pool, id_empleado_responsable, idEmpresa))) {
      return res.status(400).json({ mensaje: MENSAJES.responsableInvalido });
    }

    await pool.query(
      `UPDATE tareas
       SET descripcion = $1,
           id_empleado_responsable = $2,
           fecha_prevista = $3,
           observaciones = $4
       WHERE id_tarea = $5`,
      [descripcion, id_empleado_responsable, fecha_prevista, observaciones ?? null, req.params.id]
    );

    res.json(await buscarTarea(pool, req.params.id, idEmpresa));
  } catch (error) {
    responderError(res, error);
  }
};

// PATCH /api/tareas/:id/estado
// Aca viven las reglas 5 y 7. Va en una transaccion con las tareas del
// servicio bloqueadas: si dos personas cambian el paso 1 y el paso 2 a la vez,
// una espera a la otra y la secuencia no se puede romper.
export const cambiarEstadoTarea = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const { estado_tarea } = req.body;

  if (!ESTADOS_TAREA.includes(estado_tarea)) {
    return res.status(400).json({ mensaje: MENSAJES.estadoInvalido });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tarea = await datosTarea(client, req.params.id, idEmpresa);

    if (!tarea) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.noEncontrada });
    }

    if (!ESTADOS_EVENTO_ABIERTO.includes(tarea.estado_evento)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJE_EVENTO_CERRADO });
    }

    // Solo las tareas de la secuencia tienen pasos vecinos. Las libres pasan
    // a cualquier estado.
    if (tarea.id_tipo_tarea && tarea.id_servicio_x_evento) {
      // Se bloquean TODAS las tareas del servicio, siempre en el mismo orden.
      // Si se bloqueara primero la tarea y despues el resto, dos pedidos sobre
      // el paso 1 y el paso 2 podrian quedar esperandose entre si (deadlock).
      // El estado actual se lee de aca, ya con las filas tomadas.
      const pasos = await client.query(
        `SELECT t.id_tarea, t.estado_tarea, tt.orden, tt.nombre
         FROM tareas t
         JOIN tipos_tarea tt ON tt.id_tipo_tarea = t.id_tipo_tarea
         WHERE t.id_servicio_x_evento = $1
         ORDER BY tt.orden
         FOR UPDATE OF t`,
        [tarea.id_servicio_x_evento]
      );

      // "Anterior" y "siguiente" son los pasos vecinos en el orden de
      // tipos_tarea, no necesariamente orden - 1 y orden + 1.
      const indice = pasos.rows.findIndex((p) => p.id_tarea === tarea.id_tarea);
      const actual = pasos.rows[indice];
      const anterior = pasos.rows[indice - 1];
      const siguiente = pasos.rows[indice + 1];

      // Regla 5: para arrancar (o terminar) un paso, el anterior tiene que
      // estar completado
      if (
        anterior &&
        estado_tarea !== "pendiente" &&
        anterior.estado_tarea !== "completada"
      ) {
        await client.query("ROLLBACK");
        return res
          .status(409)
          .json({ mensaje: `Primero hay que completar: ${anterior.nombre}` });
      }

      // Al reves: si el paso siguiente ya arranco, este no puede dejar de
      // estar completado. Si no, quedaria un paso en curso con el anterior
      // abierto, que es justo lo que la regla 5 prohibe.
      if (
        siguiente &&
        actual.estado_tarea === "completada" &&
        estado_tarea !== "completada" &&
        siguiente.estado_tarea !== "pendiente"
      ) {
        await client.query("ROLLBACK");
        return res.status(409).json({ mensaje: MENSAJES.reabrir });
      }
    }

    // Regla 7: completar guarda la fecha (si ya estaba completada, conserva la
    // original). Cualquier otro estado la limpia.
    // Regla 6: aca NO se toca servicios_x_evento. Que la tarea "Confirmar
    // asistencia" este completada no significa que el proveedor confirmo.
    // $1 va con ::varchar en los dos lugares: se usa como valor de la columna
    // y dentro del CASE, y sin el cast PostgreSQL deduce un tipo distinto
    // para cada uso y rechaza la consulta.
    await client.query(
      `UPDATE tareas
       SET estado_tarea = $1::varchar,
           fecha_finalizacion = CASE WHEN $1::varchar = 'completada'
                                     THEN COALESCE(fecha_finalizacion, CURRENT_DATE)
                                     ELSE NULL END
       WHERE id_tarea = $2`,
      [estado_tarea, req.params.id]
    );

    const respuesta = await buscarTarea(client, req.params.id, idEmpresa);

    await client.query("COMMIT");

    res.json(respuesta);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error);
  } finally {
    client.release();
  }
};

// DELETE /api/tareas/:id
// Solo tareas libres. Las de la secuencia son el registro de lo que se hizo
// con el proveedor: si se borrara una, la secuencia quedaria con un hueco.
export const eliminarTarea = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;

  try {
    const tarea = await datosTarea(pool, req.params.id, idEmpresa);
    if (!tarea) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrada });
    }
    if (!ESTADOS_EVENTO_ABIERTO.includes(tarea.estado_evento)) {
      return res.status(409).json({ mensaje: MENSAJE_EVENTO_CERRADO });
    }
    if (tarea.id_tipo_tarea) {
      return res.status(409).json({ mensaje: MENSAJES.noEliminable });
    }

    // id_tipo_tarea IS NULL se repite en el WHERE como red de seguridad
    await pool.query(
      "DELETE FROM tareas WHERE id_tarea = $1 AND id_tipo_tarea IS NULL",
      [req.params.id]
    );

    res.status(204).send();
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/tareas/mias?estado_tarea=
// Las tareas del empleado vinculado al usuario logueado, de eventos abiertos.
// El id_empleado no viaja en el token: se busca en usuarios con el id del
// token, asi un cambio de vinculo se ve sin tener que volver a loguearse.
export const obtenerMisTareas = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;

  try {
    const usuario = await pool.query(
      "SELECT id_empleado FROM usuarios WHERE id_usuario = $1 AND id_empresa = $2",
      [req.usuario.id, idEmpresa]
    );

    const idEmpleado = usuario.rows[0]?.id_empleado;

    // Un usuario sin empleado vinculado no tiene tareas: 200 con []
    if (!idEmpleado) {
      return res.json([]);
    }

    const condiciones = [
      "t.id_empleado_responsable = $1",
      "e.id_empresa = $2",
      "e.estado = ANY($3)"
    ];
    const valores = [idEmpleado, idEmpresa, ESTADOS_EVENTO_ABIERTO];

    if (req.query.estado_tarea) {
      valores.push(req.query.estado_tarea);
      condiciones.push(`t.estado_tarea = $${valores.length}`);
    }

    // Tres datos del evento mas, para que la persona sepa de que evento es
    // cada tarea sin abrirlo
    const consulta = selectTarea(
      `, c.nombre || ' ' || c.apellido AS nombre_cliente,
         te.nombre AS nombre_tipo_evento,
         e.fecha_evento_confirmada`,
      `JOIN solicitudes s ON s.id_solicitud = e.id_solicitud
       JOIN clientes c ON c.id_cliente = s.id_cliente
       JOIN tipos_eventos te ON te.id_tipo_evento = s.id_tipo_evento`
    );

    // Primero las vencidas (true va antes con DESC), despues por fecha
    const resultado = await pool.query(
      `${consulta}
       WHERE ${condiciones.join(" AND ")}
       ORDER BY ${CONDICION_VENCIDA} DESC, t.fecha_prevista NULLS LAST, t.id_tarea`,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};
