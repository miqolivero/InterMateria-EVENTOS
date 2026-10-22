import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { esEmpleadoActivo } from "../utils/consultas.js";
import {
  esIdValido,
  esFechaValida,
  esImporteValido,
  esVacio
} from "../utils/validaciones.js";
import {
  ESTADOS_EVENTO_ABIERTO,
  MENSAJE_EVENTO_CERRADO,
  SELECT_SERVICIO_EVENTO
} from "./eventos.controller.js";
import { SELECT_TAREA } from "./tareas.controller.js";

// Servicios del evento: lo ACORDADO con cada proveedor (servicios_x_evento) y
// su estado. Es lo que el cliente remarco en el relevamiento: el estado del
// proveedor es independiente de las tareas internas (regla 6), asi que se
// actualiza solo por aca.
//
// servicios_x_evento no tiene id_empresa: es de la empresa de su evento. Todo
// entra por JOIN eventos e ... AND e.id_empresa.

const MENSAJES = {
  noEncontrado: "Servicio del evento no encontrado",
  estadoInvalido: "Estado de proveedor invalido",
  proveedorNoOfrece: "El proveedor no ofrece ese servicio",
  importesNegativos: "Los importes no pueden ser negativos",
  faltanDatosTareas: "Hay que indicar el responsable y 4 fechas",
  fechasDesordenadas: "Las fechas tienen que estar en orden",
  responsableInvalido: "El responsable no es un empleado activo de la empresa",
  yaGeneradas: "Las tareas de este servicio ya fueron generadas"
};

const ESTADOS_PROVEEDOR = [
  "solicitada",
  "confirmada",
  "en_seguimiento",
  "finalizada",
  "rechazada"
];

// Cuantos pasos tiene la secuencia (tipos_tarea es fija, la carga el seed)
const CANTIDAD_PASOS = 4;

// El servicio del evento si es de la empresa, con el estado de su evento
const datosServicio = async (ejecutor, idServicioEvento, idEmpresa, bloquear = false) => {
  const resultado = await ejecutor.query(
    `SELECT sxe.id_servicio_x_evento, sxe.id_evento, sxe.id_servicio,
            e.estado AS estado_evento
     FROM servicios_x_evento sxe
     JOIN eventos e ON e.id_evento = sxe.id_evento
     WHERE sxe.id_servicio_x_evento = $1 AND e.id_empresa = $2
     ${bloquear ? "FOR UPDATE OF sxe" : ""}`,
    [idServicioEvento, idEmpresa]
  );

  return resultado.rows[0] ?? null;
};

const buscarServicioEvento = async (idServicioEvento) => {
  const resultado = await pool.query(
    `${SELECT_SERVICIO_EVENTO} WHERE sxe.id_servicio_x_evento = $1`,
    [idServicioEvento]
  );

  return resultado.rows[0];
};

// PATCH /api/servicios-evento/:id
// Actualizacion PARCIAL: solo se tocan los campos que vienen en el body.
// Regla 6: no modifica ninguna tarea.
export const actualizarServicioEvento = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const body = req.body ?? {};
  const vino = (campo) => Object.hasOwn(body, campo);

  // 1. Formatos (no necesitan la base)
  if (vino("estado_proveedor") && !ESTADOS_PROVEEDOR.includes(body.estado_proveedor)) {
    return res.status(400).json({ mensaje: MENSAJES.estadoInvalido });
  }

  const importeMal = ["costo_acordado_proveedor", "importe_acordado_cliente"].some(
    (campo) => vino(campo) && !esImporteValido(body[campo])
  );
  if (importeMal) {
    return res.status(400).json({ mensaje: MENSAJES.importesNegativos });
  }

  if (vino("id_proveedor") && !esVacio(body.id_proveedor) && !esIdValido(body.id_proveedor)) {
    return res.status(400).json({ mensaje: MENSAJES.proveedorNoOfrece });
  }

  try {
    // 2. Existe y es de la empresa (404), y el evento sigue abierto (409)
    const servicio = await datosServicio(pool, req.params.id, idEmpresa);
    if (!servicio) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }
    if (!ESTADOS_EVENTO_ABIERTO.includes(servicio.estado_evento)) {
      return res.status(409).json({ mensaje: MENSAJE_EVENTO_CERRADO });
    }

    // 3. El proveedor nuevo (si viene y no es null) tiene que ser de la
    //    empresa, estar activo y ofrecer ESE servicio. null lo desasigna.
    if (vino("id_proveedor") && !esVacio(body.id_proveedor)) {
      const ofrece = await pool.query(
        `SELECT 1 FROM proveedores_x_servicio pxs
         JOIN proveedores pr ON pr.id_proveedor = pxs.id_proveedor
         WHERE pxs.id_proveedor = $1 AND pxs.id_servicio = $2
           AND pr.id_empresa = $3 AND pr.activo = TRUE`,
        [body.id_proveedor, servicio.id_servicio, idEmpresa]
      );

      if (ofrece.rows.length === 0) {
        return res.status(400).json({ mensaje: MENSAJES.proveedorNoOfrece });
      }
    }

    // 4. El SET se arma solo con lo que vino. Los nombres de columna salen de
    //    esta lista fija, nunca del request; los valores van parametrizados.
    const sets = [];
    const valores = [];
    const agregar = (columna, valor) => {
      valores.push(valor);
      sets.push(`${columna} = $${valores.length}`);
    };

    if (vino("estado_proveedor")) {
      agregar("estado_proveedor", body.estado_proveedor);
      const indice = valores.length;

      // La fecha de confirmacion se guarda al pasar a 'confirmada' (si ya lo
      // estaba, se conserva la original) y se limpia si vuelve a
      // 'solicitada'. En el SET, estado_proveedor todavia es el valor viejo.
      // El ::varchar evita que PostgreSQL deduzca dos tipos distintos para el
      // mismo parametro (columna por un lado, comparacion por el otro).
      sets.push(`fecha_confirmacion_proveedor = CASE
        WHEN $${indice}::varchar = 'confirmada' AND estado_proveedor <> 'confirmada' THEN CURRENT_DATE
        WHEN $${indice}::varchar = 'solicitada' THEN NULL
        ELSE fecha_confirmacion_proveedor END`);
    }
    if (vino("id_proveedor")) {
      agregar("id_proveedor", esVacio(body.id_proveedor) ? null : body.id_proveedor);
    }
    if (vino("costo_acordado_proveedor")) {
      agregar("costo_acordado_proveedor", body.costo_acordado_proveedor);
    }
    if (vino("importe_acordado_cliente")) {
      agregar("importe_acordado_cliente", body.importe_acordado_cliente);
    }
    if (vino("observaciones")) {
      agregar("observaciones", body.observaciones ?? null);
    }

    // Un body vacio no es un error: devuelve el servicio como esta
    if (sets.length > 0) {
      valores.push(req.params.id);
      await pool.query(
        `UPDATE servicios_x_evento SET ${sets.join(", ")}
         WHERE id_servicio_x_evento = $${valores.length}`,
        valores
      );
    }

    res.json(await buscarServicioEvento(req.params.id));
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/servicios-evento/:id/generar-tareas
// Crea los 4 pasos de la secuencia (tipos_tarea) para este servicio, en una
// transaccion: o se crean los 4, o ninguno. Una secuencia con 2 pasos dejaria
// la regla 5 sin sentido.
export const generarTareas = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const { id_empleado_responsable, fechas } = req.body;

  // 1. Formatos: responsable y exactamente 4 fechas validas
  const fechasOk =
    Array.isArray(fechas) &&
    fechas.length === CANTIDAD_PASOS &&
    fechas.every(esFechaValida);

  if (esVacio(id_empleado_responsable) || !fechasOk) {
    return res.status(400).json({ mensaje: MENSAJES.faltanDatosTareas });
  }

  if (!esIdValido(id_empleado_responsable)) {
    return res.status(400).json({ mensaje: MENSAJES.responsableInvalido });
  }

  // "Sin retroceder": cada paso el mismo dia o despues del anterior. Las
  // fechas YYYY-MM-DD se pueden comparar como texto.
  const enOrden = fechas.every((fecha, i) => i === 0 || fecha >= fechas[i - 1]);
  if (!enOrden) {
    return res.status(400).json({ mensaje: MENSAJES.fechasDesordenadas });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Se bloquea el servicio: dos "generar tareas" a la vez crearian 8 tareas.
    const servicio = await datosServicio(client, req.params.id, idEmpresa, true);

    if (!servicio) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }

    if (!ESTADOS_EVENTO_ABIERTO.includes(servicio.estado_evento)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJE_EVENTO_CERRADO });
    }

    const existentes = await client.query(
      `SELECT 1 FROM tareas
       WHERE id_servicio_x_evento = $1 AND id_tipo_tarea IS NOT NULL
       LIMIT 1`,
      [req.params.id]
    );

    if (existentes.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.yaGeneradas });
    }

    // Regla 9: el responsable trabaja hoy en la empresa
    if (!(await esEmpleadoActivo(client, id_empleado_responsable, idEmpresa))) {
      await client.query("ROLLBACK");
      return res.status(400).json({ mensaje: MENSAJES.responsableInvalido });
    }

    // Las 4 tareas en un solo INSERT ... SELECT sobre tipos_tarea. ROW_NUMBER
    // numera los pasos 1..4 segun su orden, y ese numero elige la fecha del
    // array. La descripcion se arma sola: "<tipo> · <servicio> (<proveedor>)";
    // sin proveedor, el parentesis no va (null || texto = null).
    await client.query(
      `WITH pasos AS (
         SELECT id_tipo_tarea, nombre, ROW_NUMBER() OVER (ORDER BY orden) AS numero
         FROM tipos_tarea
       )
       INSERT INTO tareas (id_evento, id_empleado_responsable, id_servicio_x_evento,
                           id_tipo_tarea, descripcion, fecha_prevista)
       SELECT sxe.id_evento, $2, sxe.id_servicio_x_evento, p.id_tipo_tarea,
              p.nombre || ' · ' || sv.nombre ||
                COALESCE(' (' || pr.razon_social || ')', ''),
              ($3::date[])[p.numero]
       FROM pasos p
       CROSS JOIN servicios_x_evento sxe
       JOIN servicios sv ON sv.id_servicio = sxe.id_servicio
       LEFT JOIN proveedores pr ON pr.id_proveedor = sxe.id_proveedor
       WHERE sxe.id_servicio_x_evento = $1
       ORDER BY p.numero`,
      [req.params.id, id_empleado_responsable, fechas]
    );

    const tareas = await client.query(
      `${SELECT_TAREA}
       WHERE t.id_servicio_x_evento = $1 AND t.id_tipo_tarea IS NOT NULL
       ORDER BY tt.orden`,
      [req.params.id]
    );

    await client.query("COMMIT");

    res.status(201).json(tareas.rows);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error);
  } finally {
    client.release();
  }
};
