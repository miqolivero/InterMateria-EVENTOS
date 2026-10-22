import api from "./axiosConfig.js";

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
  try {
    const guardado = localStorage.getItem("usuario");
    const usuario = guardado ? JSON.parse(guardado) : null;
    return usuario && typeof usuario === "object" && !Array.isArray(usuario) ? usuario : null;
  } catch { return null; }
};
