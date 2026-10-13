import api from "./axiosConfig";

export const login = (email, password) =>
  api.post("/auth/login", { email, password });

export const registrar = (datos) => api.post("/auth/register", datos);

export const obtenerPerfil = () => api.get("/auth/perfil");

// Con JWT el servidor no guarda sesiones: cerrar sesion es borrar el token.
export const cerrarSesion = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
};

export const usuarioGuardado = () => {
  const guardado = localStorage.getItem("usuario");
  return guardado ? JSON.parse(guardado) : null;
};
