import api from "./axiosConfig.js";

// Lista cerrada: los componentes no construyen rutas a partir de datos del usuario.
const rutas = { clientes: "/clientes", tipos: "/tipos-eventos", servicios: "/servicios", proveedores: "/proveedores", empleados: "/empleados" };
export const listarCatalogo = (recurso, params = {}) => api.get(rutas[recurso], { params });
export const obtenerCatalogo = (recurso, id) => api.get(`${rutas[recurso]}/${id}`);
export const crearCatalogo = (recurso, datos) => api.post(rutas[recurso], datos);
export const editarCatalogo = (recurso, id, datos) => api.put(`${rutas[recurso]}/${id}`, datos);
export const activarCatalogo = (recurso, id, activo) => api.patch(`${rutas[recurso]}/${id}/activo`, { activo });
export const obtenerServiciosProveedor = (id) => api.get(`/proveedores/${id}/servicios`);
export const guardarServiciosProveedor = (id, ids_servicios) => api.put(`/proveedores/${id}/servicios`, { ids_servicios });
