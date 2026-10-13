import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
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
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
