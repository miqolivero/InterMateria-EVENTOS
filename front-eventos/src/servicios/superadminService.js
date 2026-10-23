import api from "./axiosConfig.js";

// Panel de superadmin (Fase 10): empresas, sus métricas y el soporte de sus usuarios.
export const resumenSistema = () => api.get("/superadmin/resumen");
export const listarEmpresas = (params) => api.get("/superadmin/empresas", { params });
export const obtenerEmpresa = (id) => api.get(`/superadmin/empresas/${id}`);
export const crearEmpresa = (empresa, admin) => api.post("/superadmin/empresas", { empresa, admin });
export const editarEmpresa = (id, datos) => api.put(`/superadmin/empresas/${id}`, datos);
export const activarEmpresa = (id, activo) => api.patch(`/superadmin/empresas/${id}/activo`, { activo });
export const eliminarEmpresa = (id) => api.delete(`/superadmin/empresas/${id}`);
export const crearUsuarioEmpresa = (id, datos) => api.post(`/superadmin/empresas/${id}/usuarios`, datos);
export const actualizarUsuarioEmpresa = (id, idUsuario, datos) => api.patch(`/superadmin/empresas/${id}/usuarios/${idUsuario}`, datos);
export const resetearPasswordEmpresa = (id, idUsuario, password_nueva) =>
  api.put(`/superadmin/empresas/${id}/usuarios/${idUsuario}/password`, { password_nueva });
