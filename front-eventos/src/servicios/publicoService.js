import api from "./axiosConfig.js";

// Lo que usa la página del cliente. No necesita sesión.
export const obtenerPresupuestoPublico = (token) => api.get(`/publico/presupuestos/${encodeURIComponent(token)}`);
export const responderPresupuestoPublico = (token, datos) => api.post(`/publico/presupuestos/${encodeURIComponent(token)}/respuesta`, datos);
