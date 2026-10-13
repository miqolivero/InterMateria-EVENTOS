import { Link, useNavigate, useLocation } from "react-router-dom";
import { cerrarSesion, usuarioGuardado } from "../servicios/authService";
import "./Navbar.css";

// Link no recarga la pagina: cambia la ruta sin volver a pedir el HTML.
function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  // Se lee en cada render, asi la barra se actualiza al navegar despues del login.
  const usuario = usuarioGuardado();

  const manejarCierre = () => {
    cerrarSesion();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <Link className="navbar-marca" to="/">
        Sistema de Eventos
      </Link>

      <nav className="navbar-links" key={location.pathname}>
        <Link className="navbar-link" to="/">
          Empresas
        </Link>

        {usuario ? (
          <>
            <Link
              className="navbar-link navbar-link-accion"
              to="/empresas/nueva"
            >
              Nueva empresa
            </Link>
            <span className="navbar-usuario">
              {usuario.nombre}
              <span className="navbar-rol">{usuario.rol}</span>
            </span>
            <button
              className="navbar-salir"
              type="button"
              onClick={manejarCierre}
            >
              Cerrar sesion
            </button>
          </>
        ) : (
          <Link className="navbar-link navbar-link-accion" to="/login">
            Iniciar sesion
          </Link>
        )}
      </nav>
    </header>
  );
}

export default Navbar;
