import api from "./axiosConfig.js";

// Fase 10: no hay registro público. Las cuentas las crean el superadmin
// (empresa y su admin) y el admin de cada empresa (su personal).
export const login = (email, password) =>
  api.post("/auth/login", { email, password });

export const obtenerPerfil = () => api.get("/auth/perfil");

export const cambiarPassword = (password_actual, password_nueva) =>
  api.put("/auth/password", { password_actual, password_nueva });

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

// Aviso que el login muestra despues de un cierre de sesion forzado (lo guarda
// el interceptor de axiosConfig.js, por ejemplo con la empresa suspendida).
// sessionStorage puede fallar en modo privado: el aviso es una ayuda, no tiene
// que romper nada.
export const leerAvisoSesion = () => {
  try {
    const aviso = sessionStorage.getItem("avisoSesion");
    sessionStorage.removeItem("avisoSesion");
    return aviso || "";
  } catch { return ""; }
};
