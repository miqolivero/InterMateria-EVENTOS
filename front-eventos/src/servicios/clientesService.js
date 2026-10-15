import api from "./axiosConfig";

export const obtenerClientes = (idEmpresa) => api.get("/clientes", {
  params: idEmpresa ? { id_empresa: idEmpresa } : {}
});
export const obtenerCliente = (id) => api.get(`/clientes/${id}`);
export const crearCliente = (datos) => api.post("/clientes", datos);
export const actualizarCliente = (id, datos) => api.put(`/clientes/${id}`, datos);
