export function mensajeError(error, alternativo = "No se pudo completar la operación.") {
  if (error.response?.data?.mensaje) return error.response.data.mensaje;
  if (!error.response) return "No pudimos conectar con el servidor. Revisá la conexión e intentá nuevamente.";
  return alternativo;
}
