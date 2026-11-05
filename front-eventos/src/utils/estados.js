// Proveedor y tarea tienen estados distintos, según el modelo compartido.
// Los estados neutros van sin color: en antd 6 "default" no es un color
// predefinido y el Tag quedaba sin fondo ni borde.
// ayuda: la explicación que muestra el Tag al pasar el mouse, para los estados
// que a simple vista se confunden (por ejemplo, un presupuesto reemplazado no
// fue rechazado por el cliente: se aceptó otra versión).
export const estados = {
  pendiente: { texto: "Pendiente", color: "gold" },
  presupuestada: { texto: "Presupuestada", color: "blue" },
  aceptada: { texto: "Aceptada", color: "green" },
  rechazada: { texto: "Rechazada", color: "red" },
  cancelada: { texto: "Cancelada" },
  borrador: { texto: "Borrador", ayuda: "Todavía se puede editar. Falta presentarlo al cliente." },
  presentado: { texto: "Presentado", color: "blue", ayuda: "Ya se presentó al cliente y espera su respuesta. Ya no se puede editar." },
  aceptado: { texto: "Aceptado", color: "green", ayuda: "El cliente lo aceptó: de esta versión nació el evento." },
  rechazado: { texto: "Rechazado", color: "red", ayuda: "El cliente lo rechazó." },
  reemplazado: { texto: "Reemplazado", ayuda: "No lo rechazó el cliente: quedó sin efecto porque se aceptó otra versión." },
  confirmado: { texto: "Confirmado", color: "cyan" },
  en_preparacion: { texto: "En preparación", color: "blue" },
  realizado: { texto: "Realizado", color: "green" },
  cancelado: { texto: "Cancelado", ayuda: "Se canceló. Se conserva en el historial." },
  completado: { texto: "Completado", color: "green" },
  acordado: { texto: "Acordado", color: "green" },
  a_revisar: { texto: "A revisar", color: "orange" },
  esperando_respuesta: { texto: "Esperando respuesta", color: "purple" },
  solicitud_rechazada: { texto: "Solicitud rechazada", color: "red" },
  solicitud_cancelada: { texto: "Solicitud cancelada" },
  en_curso: { texto: "En curso", color: "blue" },
  completada: { texto: "Completada", color: "green" },
  vencida: { texto: "Vencida", color: "red" },
  sin_completar: { texto: "Sin completar", color: "gold" },
  sin_realizar: { texto: "No realizada", ayuda: "El evento ya pasó y la tarea no se completó. Ya no se puede modificar." }
};

// Las opciones del filtro de estado de las tareas
export const opcionesEstadoTarea = ({ conVencida = false } = {}) => [
  ...(conVencida ? ["sin_completar"] : []), ...["pendiente", "en_curso", "completada"], ...(conVencida ? ["vencida"] : []), "sin_realizar"
].map((value) => ({ value, label: estados[value].texto }));

// Fase 11: los 4 estados del proveedor. pendiente, confirmado y rechazado
// comparten texto y color con los de otras entidades; completado es nuevo.
export const ESTADOS_PROVEEDOR = ["pendiente", "confirmado", "completado", "rechazado"];

// Los pasos posibles con un proveedor (tipos_tarea, tabla fija del seed). Son
// una guía: se eligen los que hacen falta y se completan en cualquier orden.
export const PASOS_PROVEEDOR = [
  { id_tipo_tarea: 1, nombre: "Contactar al proveedor" },
  { id_tipo_tarea: 2, nombre: "Confirmar asistencia" },
  { id_tipo_tarea: 3, nombre: "Seguimiento previo" },
  { id_tipo_tarea: 4, nombre: "Cierre del servicio" }
];

// Situaciones de "Eventos por estado", en el orden de las pestañas
export const SITUACIONES = ["esperando_respuesta", "confirmado", "en_preparacion", "realizado", "cancelado", "solicitud_rechazada", "solicitud_cancelada"];

// Tipos del historial de cambios
export const TIPOS_CAMBIO = {
  fecha: "Fecha", sede: "Sede", condiciones: "Condiciones", cantidad_asistentes: "Asistentes",
  servicio_agregado: "Servicio agregado", servicio_modificado: "Servicio modificado",
  servicio_cancelado: "Servicio cancelado", proveedor_cambiado: "Proveedor"
};
