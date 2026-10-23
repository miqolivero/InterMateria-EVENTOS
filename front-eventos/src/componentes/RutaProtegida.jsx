import { Button, Result, Spin } from "antd";
import { Navigate, useLocation } from "react-router-dom";
import { useSesion } from "../contexto/useSesion";
import { inicioDeRol, puedeEntrar } from "../utils/menu";

// Si alguien entra sin haber hecho login, lo mandamos al login.
// Esto es experiencia de usuario: la seguridad real esta en el middleware
// del backend. Ocultar una pantalla en React no protege nada.
//
// Fase 10, dos guardas mas:
// 1. Si la contrasena la puso otra persona (debe_cambiar_password), antes de
//    cualquier pantalla va la de cambio de contrasena.
// 2. Si el rol entra a una ruta que no es suya (un empleado en /clientes), se
//    lo lleva a su inicio. Los roles de cada ruta salen de utils/menu.jsx.
function RutaProtegida({ children }) {
  const { usuario, cargando, errorSesion, reintentar, salir } = useSesion();
  const location = useLocation();
  const login = <Navigate to="/login" state={{ desde: location.pathname + location.search + location.hash }} replace />;
  if (!localStorage.getItem("token")) return login;
  if (cargando) return <div className="pantalla-espera"><Spin size="large" /><p>Verificando tu sesión…</p></div>;
  if (errorSesion) return <Result status="warning" title="No pudimos verificar tu sesión" subTitle={errorSesion}
    extra={[<Button key="reintentar" type="primary" onClick={reintentar}>Reintentar</Button>,
      <Button key="salir" onClick={salir}>Cerrar sesión</Button>]} />;
  if (!usuario) return login;
  if (usuario.debe_cambiar_password && location.pathname !== "/cambiar-password") {
    return <Navigate to="/cambiar-password" replace />;
  }
  if (location.pathname === "/" || !puedeEntrar(usuario.rol, location.pathname)) {
    return <Navigate to={inicioDeRol(usuario.rol)} replace />;
  }
  return children;
}

export default RutaProtegida;
