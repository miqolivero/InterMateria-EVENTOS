import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL,
  timeout: 15000
});

// ANTES de cada peticion: agregar el token.
// Es como un middleware, pero del lado del cliente. Ningun componente
// tiene que acordarse de mandar el token.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config; // obligatorio: sin esto la peticion no sale
});

// DESPUES de cada respuesta: si la sesion ya no sirve, cerrarla.
// - 401: token vencido, invalido o de un usuario desactivado.
// - 403 con codigo "empresa_suspendida": la empresa fue suspendida mientras
//   la persona trabajaba. Es el UNICO 403 que cierra la sesion; el resto de
//   los 403 ("no tenes permiso") solo se muestran. Se decide por el codigo, no
//   comparando el texto del mensaje.
export const esEmpresaSuspendida = (error) =>
  error.response?.status === 403 && error.response.data?.codigo === "empresa_suspendida";

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Un 401 o 403 en login es un error del formulario, no una sesión vencida.
    const esAcceso = error.config?.url === "/auth/login";
    const tokenActual = localStorage.getItem("token");
    const autorizacionEnviada = error.config?.headers?.Authorization;
    const esSesionActual = !tokenActual || autorizacionEnviada === `Bearer ${tokenActual}`;
    const suspendida = esEmpresaSuspendida(error);
    if ((error.response?.status === 401 || suspendida) && !esAcceso && esSesionActual) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      // El login muestra el motivo al volver
      if (suspendida) {
        try { sessionStorage.setItem("avisoSesion", error.response.data.mensaje); } catch { /* sin aviso */ }
      }
      window.dispatchEvent(new Event("sesion-expirada"));
    }
    return Promise.reject(error);
  }
);

export default api;
