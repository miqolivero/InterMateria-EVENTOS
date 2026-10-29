// Sin respuesta del servidor hay dos casos distintos: tardó demasiado (timeout)
// o directamente no respondió (la API está apagada o no hay red).
function sinRespuesta(error) {
  if (error.code === "ECONNABORTED") return "El servidor tardó demasiado en responder. Intentá nuevamente en unos segundos.";
  return "No pudimos conectar con el servidor. Revisá la conexión o que el sistema esté en funcionamiento e intentá nuevamente.";
}

export function mensajeError(error, alternativo = "No se pudo completar la operación.") {
  if (!error.response) return sinRespuesta(error);
  if (error.response.data?.mensaje) return error.response.data.mensaje;
  if (error.response.status >= 500) return "El servidor tuvo un problema. Intentá nuevamente en unos minutos.";
  return alternativo;
}

// El login dice exactamente qué falló. La API responde "Credenciales invalidas"
// tanto si el email no existe como si la contraseña está mal (así no revela qué
// emails tienen cuenta), por eso el mensaje nombra a los dos.
export function mensajeLogin(error) {
  if (!error.response) return sinRespuesta(error);
  const { status, data } = error.response;
  if (status === 401) return "El email o la contraseña son incorrectos. Revisalos e intentá nuevamente.";
  if (status === 400) return "Completá el email y la contraseña.";
  if (status === 403) return data?.mensaje || "Tu cuenta no tiene acceso en este momento.";
  if (status >= 500) return "El servidor tuvo un problema al iniciar sesión. Intentá nuevamente en unos minutos.";
  return data?.mensaje || "No se pudo iniciar sesión.";
}
