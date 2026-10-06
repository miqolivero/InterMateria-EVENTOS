import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
});

export const obtenerEmpresas = () => api.get("/empresas");

export const obtenerEmpresa = (id) => api.get(`/empresas/${id}`);

export const crearEmpresa = (empresa) => api.post("/empresas", empresa);

export const actualizarEmpresa = (id, empresa) =>
  api.put(`/empresas/${id}`, empresa);

export const eliminarEmpresa = (id) => api.delete(`/empresas/${id}`);