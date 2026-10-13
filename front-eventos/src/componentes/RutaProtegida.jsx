import { Navigate } from "react-router-dom";

// Si alguien entra sin haber hecho login, lo mandamos al login.
// Esto es experiencia de usuario: la seguridad real esta en el middleware
// del backend. Ocultar una pantalla en React no protege nada.
function RutaProtegida({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    // replace evita que el boton "atras" vuelva a la pagina protegida
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default RutaProtegida;
