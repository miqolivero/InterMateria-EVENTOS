import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";

// El presupuesto que ve el cliente, por un link. Es la UNICA parte de la API sin
// login: quien tiene el link puede leer ese presupuesto y nada mas. El token es
// un UUID aleatorio, asi que no se puede adivinar ni recorrer como un id.
//
// Las columnas se nombran una por una y NUNCA incluyen el costo, el margen ni el
// proveedor: son la informacion comercial de la empresa. Un campo nuevo de la
// tabla no se cuela solo.
//
// El cliente responde, pero el sistema no decide: su respuesta queda registrada y
// avisada, y es la empresa la que confirma el evento (hace falta elegir fecha,
// sede y coordinador) o da el presupuesto por rechazado.

const MENSAJES = {
  noEncontrado: "Presupuesto no encontrado",
  respuestaInvalida: "La respuesta tiene que ser aceptado o rechazado",
  comentarioLargo: "El comentario no puede superar los 1000 caracteres",
  yaRespondido: "Ya registramos tu respuesta a este presupuesto",
  vencido: "El presupuesto esta vencido",
  noVigente: "Este presupuesto ya no admite respuesta"
};

const RESPUESTAS = ["aceptado", "rechazado"];
const LARGO_MAXIMO_COMENTARIO = 1000;
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Vencido: paso la fecha de emision mas los dias de validez. Sin validez cargada
// no vence. Calculado, igual que "vencida" en las tareas.
const VENCIDO = "COALESCE(p.fecha_emision + p.validez_dias < CURRENT_DATE, FALSE)";

// Si se puede responder: presentado, con la solicitud abierta, sin respuesta
// previa y sin vencer. Se usa en la lectura y en el UPDATE, asi dicen lo mismo.
const PUEDE_RESPONDER = `(p.estado = 'presentado'
   AND s.estado IN ('pendiente', 'presupuestada')
   AND p.respuesta_cliente IS NULL
   AND NOT ${VENCIDO})`;

// Un borrador todavia no se presento, y de una empresa suspendida no se muestra
// nada: los dos responden 404, como si el link no existiera.
const SELECT_PUBLICO = `
  SELECT p.estado, p.numero_version, p.fecha_emision, p.validez_dias,
         p.fecha_emision + p.validez_dias AS vence,
         ${VENCIDO} AS vencido,
         ${PUEDE_RESPONDER} AS puede_responder,
         p.observaciones, p.importe_total,
         p.respuesta_cliente, p.fecha_respuesta_cliente,
         json_build_object('nombre', em.nombre, 'email', em.email, 'telefono', em.telefono) AS empresa,
         CONCAT_WS(' ', c.nombre, NULLIF(c.apellido, '-')) AS nombre_cliente,
         te.nombre AS nombre_tipo_evento,
         s.fecha_evento_prevista, s.cantidad_asistentes, s.sede_prevista,
         COALESCE(
           (SELECT json_agg(json_build_object(
                     'nombre_servicio', sv.nombre,
                     'descripcion', d.descripcion,
                     'cantidad', d.cantidad,
                     'importe_cliente', d.importe_cliente)
                   ORDER BY d.id_detalle)
            FROM detalle_presupuesto d
            JOIN servicios sv ON sv.id_servicio = d.id_servicio
            WHERE d.id_presupuesto = p.id_presupuesto),
           '[]'
         ) AS detalle
  FROM presupuestos p
  JOIN solicitudes s ON s.id_solicitud = p.id_solicitud
  JOIN clientes c ON c.id_cliente = s.id_cliente
  JOIN tipos_eventos te ON te.id_tipo_evento = s.id_tipo_evento
  JOIN empresas em ON em.id_empresa = s.id_empresa
  WHERE p.token_publico = $1 AND p.estado <> 'borrador' AND em.activo = TRUE`;

const buscarPublico = async (token) => {
  if (!FORMATO_UUID.test(token)) return null;
  const { rows } = await pool.query(SELECT_PUBLICO, [token]);
  const presupuesto = rows[0];
  if (!presupuesto) return null;

  // Una version reemplazada ya no vale: se avisa, pero sin mostrar precios viejos
  if (presupuesto.estado === "reemplazado") {
    return { estado: "reemplazado", empresa: presupuesto.empresa, puede_responder: false };
  }
  return presupuesto;
};

// GET /api/publico/presupuestos/:token
export const obtenerPresupuestoPublico = async (req, res) => {
  try {
    const presupuesto = await buscarPublico(req.params.token);
    if (!presupuesto) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }
    res.json(presupuesto);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/publico/presupuestos/:token/respuesta
// Registra lo que respondio el cliente, una sola vez. Las condiciones van en el
// WHERE: si dos pedidos llegan a la vez, el segundo no modifica nada.
export const responderPresupuesto = async (req, res) => {
  const { respuesta, comentario } = req.body ?? {};

  if (!RESPUESTAS.includes(respuesta)) {
    return res.status(400).json({ mensaje: MENSAJES.respuestaInvalida });
  }
  const texto = typeof comentario === "string" ? comentario.trim() : "";
  if (texto.length > LARGO_MAXIMO_COMENTARIO) {
    return res.status(400).json({ mensaje: MENSAJES.comentarioLargo });
  }

  try {
    const actual = await buscarPublico(req.params.token);
    if (!actual) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }

    const { rowCount } = await pool.query(
      `UPDATE presupuestos p
       SET respuesta_cliente = $1, fecha_respuesta_cliente = NOW(), comentario_cliente = $2
       FROM solicitudes s
       WHERE s.id_solicitud = p.id_solicitud AND p.token_publico = $3
         AND ${PUEDE_RESPONDER}`,
      [respuesta, texto || null, req.params.token]
    );

    if (rowCount === 0) {
      const mensaje = actual.respuesta_cliente ? MENSAJES.yaRespondido
        : actual.vencido ? MENSAJES.vencido : MENSAJES.noVigente;
      return res.status(409).json({ mensaje });
    }

    res.json(await buscarPublico(req.params.token));
  } catch (error) {
    responderError(res, error);
  }
};
