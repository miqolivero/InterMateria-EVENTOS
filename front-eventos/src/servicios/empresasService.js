import api from "./axiosConfig";

// Una funcion por endpoint: las cinco filas del contrato.
// Usan la instancia api, asi heredan el token del interceptor.
export const obtenerEmpresas = () => api.get("/empresas");

export const obtenerEmpresa = (id) => api.get(`/empresas/${id}`);

export const crearEmpresa = (empresa) => api.post("/empresas", empresa);

export const actualizarEmpresa = (id, empresa) =>
  api.put(`/empresas/${id}`, empresa);

export const eliminarEmpresa = (id) => api.delete(`/empresas/${id}`);
