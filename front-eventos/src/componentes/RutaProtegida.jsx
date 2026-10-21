import { Button, Result, Spin } from "antd";
import { Navigate, useLocation } from "react-router-dom";
import { useSesion } from "../contexto/useSesion";

// Si alguien entra sin haber hecho login, lo mandamos al login.
// Esto es experiencia de usuario: la seguridad real esta en el middleware
// del backend. Ocultar una pantalla en React no protege nada.
function RutaProtegida({ children, soloAdmin = false }) {
  const { usuario, cargando, errorSesion, reintentar, salir } = useSesion();
  const location = useLocation();
  if (cargando) return <div className="pantalla-espera"><Spin size="large" /><p>Verificando tu sesión…</p></div>;
  if (errorSesion) return <Result status="warning" title="No pudimos verificar tu sesión" subTitle={errorSesion}
    extra={[<Button key="reintentar" type="primary" onClick={reintentar}>Reintentar</Button>,
      <Button key="salir" onClick={salir}>Cerrar sesión</Button>]} />;
  if (!usuario || !localStorage.getItem("token")) return <Navigate to="/login" state={{ desde: location.pathname + location.search }} replace />;
  if (soloAdmin && usuario.rol !== "admin") return <Result status="403" title="Acceso de administrador"
    subTitle="La creación y edición de empresas requieren un administrador."
    extra={<Button href="/empresas">Volver a empresas</Button>} />;
  return children;
}

export default RutaProtegida;
