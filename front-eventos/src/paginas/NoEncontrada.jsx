import { Link } from "react-router-dom";
import "./NoEncontrada.css";

function NoEncontrada() {
  return (
    <div className="no-encontrada">
      <h1 className="no-encontrada-titulo">404</h1>
      <p className="no-encontrada-texto">Esta pagina no existe.</p>
      <Link className="no-encontrada-volver" to="/">
        Volver al listado
      </Link>
    </div>
  );
}

export default NoEncontrada;
