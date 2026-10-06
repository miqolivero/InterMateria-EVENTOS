import { Link } from "react-router-dom";
import "./Navbar.css";

// Link no recarga la pagina: cambia la ruta sin volver a pedir el HTML.
function Navbar() {
  return (
    <header className="navbar">
      <Link className="navbar-marca" to="/">
        Sistema de Eventos
      </Link>

      <nav className="navbar-links">
        <Link className="navbar-link" to="/">
          Empresas
        </Link>
        <Link className="navbar-link navbar-link-accion" to="/empresas/nueva">
          Nueva empresa
        </Link>
      </nav>
    </header>
  );
}

export default Navbar;
