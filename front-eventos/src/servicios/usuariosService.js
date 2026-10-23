import api from "./axiosConfig.js";

// Usuarios de mi empresa (solo admin) y Mi empresa (Fase 10).
export const listarUsuarios = (params) => api.get("/usuarios", { params });
export const crearUsuario = (datos) => api.post("/usuarios", datos);
export const editarUsuario = (id, datos) => api.put(`/usuarios/${id}`, datos);
export const activarUsuario = (id, activo) => api.patch(`/usuarios/${id}/activo`, { activo });
export const resetearPassword = (id, password_nueva) => api.put(`/usuarios/${id}/password`, { password_nueva });

export const obtenerMiEmpresa = () => api.get("/mi-empresa");
export const editarMiEmpresa = (datos) => api.put("/mi-empresa", datos);
