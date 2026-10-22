// Proveedor y tarea tienen estados distintos, según el modelo compartido.
// Los estados neutros van sin color: en antd 6 "default" no es un color
// predefinido y el Tag quedaba sin fondo ni borde.
export const estados = {
  pendiente: { texto: "Pendiente", color: "gold" },
  presupuestada: { texto: "Presupuestada", color: "blue" },
  aceptada: { texto: "Aceptada", color: "green" },
  rechazada: { texto: "Rechazada", color: "red" },
  cancelada: { texto: "Cancelada" },
  borrador: { texto: "Borrador" },
  presentado: { texto: "Presentado", color: "blue" },
  aceptado: { texto: "Aceptado", color: "green" },
  rechazado: { texto: "Rechazado", color: "red" },
  reemplazado: { texto: "Reemplazado" },
  confirmado: { texto: "Confirmado", color: "cyan" },
  en_preparacion: { texto: "En preparación", color: "blue" },
  realizado: { texto: "Realizado", color: "green" },
  cancelado: { texto: "Cancelado" },
  solicitada: { texto: "Solicitada", color: "gold" },
  confirmada: { texto: "Confirmada", color: "cyan" },
  en_seguimiento: { texto: "En seguimiento", color: "blue" },
  finalizada: { texto: "Finalizada", color: "green" },
  en_curso: { texto: "En curso", color: "blue" },
  completada: { texto: "Completada", color: "green" },
  vencida: { texto: "Vencida", color: "red" }
};
