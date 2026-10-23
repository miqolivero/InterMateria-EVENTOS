import { useCallback, useEffect, useState } from "react";
import { SesionContexto } from "./SesionContexto";
import { cerrarSesion, obtenerPerfil, usuarioGuardado } from "../servicios/authService";
import { mensajeError } from "../utils/errores";
import { esEmpresaSuspendida } from "../servicios/axiosConfig";

export default function SesionProvider({ children }) {
  const [usuario, setUsuario] = useState(() => localStorage.getItem("token") ? usuarioGuardado() : null);
  const [cargando, setCargando] = useState(Boolean(localStorage.getItem("token")));
  const [errorSesion, setErrorSesion] = useState("");
  const [revision, setRevision] = useState(0);
  const salir = useCallback(() => {
    cerrarSesion(); setUsuario(null); setErrorSesion(""); setCargando(false);
    setRevision((actual) => actual + 1);
  }, []);

  useEffect(() => {
    let vigente = true;
    const token = localStorage.getItem("token");
    if (!token) return;
    obtenerPerfil().then(({ data }) => {
      if (!vigente || localStorage.getItem("token") !== token) return;
      localStorage.setItem("usuario", JSON.stringify(data)); setUsuario(data);
    }).catch((error) => {
      if (!vigente || localStorage.getItem("token") !== token) return;
      // 401/404: la sesion ya no existe. Empresa suspendida: el interceptor ya
      // borro el token y dejo el aviso para el login.
      if ([401, 404].includes(error.response?.status) || esEmpresaSuspendida(error)) salir();
      else setErrorSesion(mensajeError(error, "No se pudo verificar tu sesión."));
    }).finally(() => { if (vigente && localStorage.getItem("token") === token) setCargando(false); });
    return () => { vigente = false; };
  }, [revision, salir]);

  useEffect(() => {
    const sincronizar = (evento) => {
      if (evento.key && !["token", "usuario"].includes(evento.key)) return;
      if (!localStorage.getItem("token")) { salir(); return; }
      setUsuario(usuarioGuardado()); setCargando(true); setErrorSesion("");
      setRevision((actual) => actual + 1);
    };
    window.addEventListener("sesion-expirada", salir);
    window.addEventListener("storage", sincronizar);
    return () => {
      window.removeEventListener("sesion-expirada", salir);
      window.removeEventListener("storage", sincronizar);
    };
  }, [salir]);

  function iniciarSesion({ token, usuario: datos }) {
    localStorage.setItem("token", token);
    localStorage.setItem("usuario", JSON.stringify(datos));
    setUsuario(datos); setErrorSesion(""); setCargando(true);
    setRevision((actual) => actual + 1);
  }
  // Despues de cambiar la contrasena, por ejemplo: el perfil cambia sin
  // volver a loguearse.
  const actualizarUsuario = useCallback((cambios) => {
    setUsuario((actual) => {
      const nuevo = { ...actual, ...cambios };
      localStorage.setItem("usuario", JSON.stringify(nuevo));
      return nuevo;
    });
  }, []);
  return <SesionContexto.Provider value={{ usuario, cargando, errorSesion, iniciarSesion,
    salir, actualizarUsuario, reintentar: () => { setCargando(true); setErrorSesion(""); setRevision((actual) => actual + 1); } }}>{children}</SesionContexto.Provider>;
}
