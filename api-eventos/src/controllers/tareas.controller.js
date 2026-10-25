import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { esEmpleadoActivo } from "../utils/consultas.js";
import { esIdValido, esFechaValida, esVacio } from "../utils/validaciones.js";
import {
  ESTADOS_EVENTO_ABIERTO,
  MENSAJE_EVENTO_CERRADO
} from "./eventos.controller.js";
import {
  CONDICION_VENCIDA,
  servicioARevisar,
  tareaARevisar,
  tareaPendientesRevision
} from "../utils/indicadores.js";

// Tareas: el trabajo del personal en cada evento. Hay dos clases:
// - pasos con un proveedor: tienen id_tipo_tarea (contactar, confirmar,
//   seguimiento, cierre). Se crean con "generar tareas" en servicios-evento,
//   eligiendo los pasos que hacen falta;
// - libres: trabajo interno, sin tipo.
//
// La tabla tareas no tiene id_empresa: una tarea es de la empresa de su
// evento. Por eso todo entra por JOIN eventos e ... AND e.id_empresa.
//
// Reglas de CLAUDE.md que se aplican aca:
// - Regla 1: "vencida" no se guarda, se calcula en el SQL.
// - Regla 5 (Fase 11): YA NO hay secuencia. Los pasos se completan en
//   cualquier orden; tipos_tarea es una guia.
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
  noEliminable: "Las tareas de la secuencia del proveedor no se pueden eliminar",
  conRevisiones: "La tarea tiene revisiones registradas y no se puede eliminar"
};

const ESTADOS_TAREA = ["pendiente", "en_curso", "completada"];

// Regla 1: la definicion vive en utils/indicadores.js. Se reexporta porque el
// tablero de seguimiento la importa desde aca.
export { CONDICION_VENCIDA };

// Objeto Tarea del contrato. Servicio, proveedor, tipo y responsable van con
// LEFT JOIN porque en una tarea libre no existen, y la tarea no puede
// desaparecer del listado por eso. a_revisar y pendientes_revision (Fase 11)
// se calculan, igual que vencida.
//
// columnasExtra / joinsExtra: "mis tareas" agrega datos del evento (cliente,
// tipo, fecha) sin repetir toda la consulta.
export const selectTarea = (columnasExtra = "", joinsExtra = "") => `
  SELECT t.id_tarea, t.id_evento, t.id_servicio_x_evento,
         sv.nombre AS nombre_servicio,
         pr.razon_social AS nombre_proveedor,
         t.id_tipo_tarea, tt.nombre AS nombre_tipo_tarea, tt.orden,
         t.descripcion, t.id_empleado_responsable,
         emp.nombre || ' ' || emp.apellido AS nombre_responsable,
         t.fecha_prevista, t.fecha_finalizacion, t.estado_tarea,
         t.observaciones,
         ${CONDICION_VENCIDA} AS vencida,
         ${tareaARevisar("t")} AS a_revisar,
         ${tareaPendientesRevision("t")} AS pendientes_revision
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

// Los tres datos del evento que agregan "mis tareas" y las tareas vencidas del
// tablero, para que la persona sepa de que evento es cada tarea sin abrirlo.
export const COLUMNAS_EVENTO_DE_TAREA = `,
  CONCAT_WS(' ', c.nombre, NULLIF(c.apellido, '-')) AS nombre_cliente,
  te.nombre AS nombre_tipo_evento,
  e.fecha_evento_confirmada`;

export const JOINS_EVENTO_DE_TAREA = `
  JOIN solicitudes s ON s.id_solicitud = e.id_solicitud
  JOIN clientes c ON c.id_cliente = s.id_cliente
  JOIN tipos_eventos te ON te.id_tipo_evento = s.id_tipo_evento`;

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

// Regla 11: el rol empleado solo trabaja sobre SUS tareas. Devuelve su
// id_empleado (que soloEmpresa leyo de la base) o null para admin y
// coordinador, que ven todas las de la empresa. Se usa como filtro en el
// WHERE: una tarea de otro no aparece y responde 404, igual que una de otra
// empresa, sin revelar que existe.
export const responsableObligatorio = (usuario) =>
  usuario.rol === "empleado" ? usuario.id_empleado : null;

// Datos de la tarea que hacen falta para validar un cambio: su evento (y si
// esta abierto) y si es un paso con el proveedor.
// idResponsable: si viene (rol empleado), la tarea tiene que ser suya.
const datosTarea = async (ejecutor, idTarea, idEmpresa, idResponsable = null) => {
  const resultado = await ejecutor.query(
    `SELECT t.id_tarea, t.id_evento, t.id_servicio_x_evento, t.id_tipo_tarea,
            t.estado_tarea, e.estado AS estado_evento
     FROM tareas t
     JOIN eventos e ON e.id_evento = t.id_evento
     WHERE t.id_tarea = $1 AND e.id_empresa = $2
       AND ($3::int IS NULL OR t.id_empleado_responsable = $3::int)`,
    [idTarea, idEmpresa, idResponsable]
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
// Tarea libre: sin tipo. Opcionalmente asociada a un servicio del mismo evento.
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
    // por eso es libre.
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
// se cambia con el PATCH. Reprogramar una tarea a revisar es una decision del
// usuario: se hace aca, nunca sola.
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
// Regla 7. Desde la Fase 11 no hay secuencia: cualquier paso pasa a cualquier
// estado, en cualquier orden. El estado del evento y el responsable (para el
// empleado) van en el WHERE del UPDATE, asi el chequeo y el cambio son una
// sola operacion y no hace falta bloquear nada.
export const cambiarEstadoTarea = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const { estado_tarea } = req.body;

  if (!ESTADOS_TAREA.includes(estado_tarea)) {
    return res.status(400).json({ mensaje: MENSAJES.estadoInvalido });
  }

  try {
    // Regla 11: el empleado solo encuentra SUS tareas (filtro en el WHERE)
    const tarea = await datosTarea(
      pool,
      req.params.id,
      idEmpresa,
      responsableObligatorio(req.usuario)
    );

    if (!tarea) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrada });
    }

    if (!ESTADOS_EVENTO_ABIERTO.includes(tarea.estado_evento)) {
      return res.status(409).json({ mensaje: MENSAJE_EVENTO_CERRADO });
    }

    // Regla 7: completar guarda la fecha (si ya estaba completada, conserva la
    // original). Cualquier otro estado la limpia.
    // Regla 6: aca NO se toca servicios_x_evento. Que la tarea "Confirmar
    // asistencia" este completada no significa que el proveedor confirmo.
    // Tampoco se toca afectados_cambio: completar una tarea a revisar no la
    // da por revisada (eso se hace con PATCH /revisiones/:id y una nota).
    // $1 va con ::varchar en los dos lugares: se usa como valor de la columna
    // y dentro del CASE, y sin el cast PostgreSQL deduce un tipo distinto
    // para cada uso y rechaza la consulta.
    const resultado = await pool.query(
      `UPDATE tareas t
       SET estado_tarea = $1::varchar,
           fecha_finalizacion = CASE WHEN $1::varchar = 'completada'
                                     THEN COALESCE(t.fecha_finalizacion, CURRENT_DATE)
                                     ELSE NULL END
       FROM eventos e
       WHERE t.id_tarea = $2 AND e.id_evento = t.id_evento
         AND e.estado = ANY($3)
       RETURNING t.id_tarea`,
      [estado_tarea, req.params.id, ESTADOS_EVENTO_ABIERTO]
    );

    // El evento se cerro entre la lectura y el UPDATE
    if (resultado.rows.length === 0) {
      return res.status(409).json({ mensaje: MENSAJE_EVENTO_CERRADO });
    }

    res.json(await buscarTarea(pool, req.params.id, idEmpresa));
  } catch (error) {
    responderError(res, error);
  }
};

// DELETE /api/tareas/:id
// Solo tareas libres. Las de los pasos con el proveedor son el registro de lo
// que se hizo con el. Una tarea que quedo en afectados_cambio tampoco se
// borra: la FK lo impide y el historial no pierde nada (409).
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
    responderError(res, error, { asociado: MENSAJES.conRevisiones });
  }
};

// GET /api/tareas/mias?estado_tarea=&vencidas=true
// Las tareas del empleado vinculado al usuario logueado, de eventos abiertos.
// Es la pantalla de trabajo del rol empleado (Fase 10), pero la usan los tres
// roles. El id_empleado no viaja en el token: lo lee soloEmpresa de la base en
// cada pedido, asi un cambio de vinculo se ve sin volver a loguearse.
//
// Ademas de los campos de siempre, cada tarea trae lo que el empleado necesita
// para trabajar sin abrir el evento:
//   - evento: los datos basicos del evento;
//   - servicio: el servicio, su proveedor, si esta cancelado o a revisar, y
//     los pasos que tiene (como referencia: ya no bloquean nada).
// Regla 11: NINGUNA columna de importes o costos. Los objetos se arman con
// json_build_object campo por campo, nunca con un SELECT *, asi un campo nuevo
// en la tabla no se cuela en la respuesta.

// El objeto "servicio" del panel del empleado, o NULL en las tareas libres.
// Lo usan /tareas/mias y la respuesta de PATCH /servicios-evento/:id/estado
// para el empleado, asi los dos devuelven exactamente lo mismo. Recibe los
// alias de servicios_x_evento, servicios y proveedores de la consulta que lo usa.
export function objetoServicioEmpleado(sxe, sv, pr) {
  return `CASE WHEN ${sxe}.id_servicio_x_evento IS NULL THEN NULL ELSE json_build_object(
    'id_servicio_x_evento', ${sxe}.id_servicio_x_evento,
    'nombre_servicio', ${sv}.nombre,
    'descripcion', ${sxe}.descripcion,
    'estado_proveedor', ${sxe}.estado_proveedor,
    'fecha_confirmacion_proveedor', ${sxe}.fecha_confirmacion_proveedor,
    'observaciones', ${sxe}.observaciones,
    'estado_servicio', ${sxe}.estado_servicio,
    'a_revisar', ${servicioARevisar(sxe)},
    'proveedor', CASE WHEN ${pr}.id_proveedor IS NULL THEN NULL ELSE json_build_object(
      'id_proveedor', ${pr}.id_proveedor,
      'razon_social', ${pr}.razon_social,
      'telefono', ${pr}.telefono,
      'email', ${pr}.email) END,
    'pasos', COALESCE((
      SELECT json_agg(json_build_object(
               'orden', ttx.orden,
               'nombre_tipo_tarea', ttx.nombre,
               'estado_tarea', tx.estado_tarea) ORDER BY ttx.orden)
      FROM tareas tx
      JOIN tipos_tarea ttx ON ttx.id_tipo_tarea = tx.id_tipo_tarea
      WHERE tx.id_servicio_x_evento = ${sxe}.id_servicio_x_evento), '[]'::json)
  ) END`;
}

const COLUMNAS_PANEL_EMPLEADO = `,
  json_build_object(
    'id_evento', e.id_evento,
    'nombre_tipo_evento', te.nombre,
    'nombre_cliente', CONCAT_WS(' ', c.nombre, NULLIF(c.apellido, '-')),
    'fecha_evento_confirmada', e.fecha_evento_confirmada,
    'sede_acordada', e.sede_acordada,
    'estado', e.estado,
    'nombre_coordinador', CASE WHEN coord.id_empleado IS NULL THEN NULL
                               ELSE coord.nombre || ' ' || coord.apellido END
  ) AS evento,
  ${objetoServicioEmpleado("sxe", "sv", "pr")} AS servicio`;

const JOINS_PANEL_EMPLEADO = `${JOINS_EVENTO_DE_TAREA}
  LEFT JOIN empleados coord ON coord.id_empleado = e.id_empleado_coordinador`;

export const obtenerMisTareas = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const idEmpleado = req.usuario.id_empleado;

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

  // Un estado que no existe se ignora, como los demas filtros invalidos
  if (ESTADOS_TAREA.includes(req.query.estado_tarea)) {
    valores.push(req.query.estado_tarea);
    condiciones.push(`t.estado_tarea = $${valores.length}`);
  }
  if (req.query.vencidas === "true") {
    condiciones.push(CONDICION_VENCIDA);
  }

  try {
    const consulta = selectTarea(
      `${COLUMNAS_EVENTO_DE_TAREA}${COLUMNAS_PANEL_EMPLEADO}`,
      JOINS_PANEL_EMPLEADO
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
