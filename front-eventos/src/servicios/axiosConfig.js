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

// DESPUES de cada respuesta: si es 401, cerrar sesion.
// Cubre el caso del token vencido en cualquier pantalla.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Un 401 en login es un error del formulario, no una sesión vencida.
    const esAcceso = ["/auth/login", "/auth/register"].includes(error.config?.url);
    const tokenActual = localStorage.getItem("token");
    const autorizacionEnviada = error.config?.headers?.Authorization;
    const esSesionActual = !tokenActual || autorizacionEnviada === `Bearer ${tokenActual}`;
    if (error.response?.status === 401 && !esAcceso && esSesionActual) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      window.dispatchEvent(new Event("sesion-expirada"));
    }
    return Promise.reject(error);
  }
);

export default api;
