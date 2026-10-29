import logo from "../assets/trama-logo.svg";
import Firma from "./Firma";
import "./MarcoAcceso.css";

// Marco de las pantallas sin menú: el login y el cambio de contraseña.
// Fase 10: ya no hay listado público de empresas, así que no hay a dónde volver.
export default function MarcoAcceso({ children, pie }) {
  return <main className="marco-acceso">
    <div className="acceso-cabecera">
      <img src={logo} alt="Trama" className="acceso-logo" />
      <span className="acceso-marca">Sistema de Gestión de Eventos</span>
    </div>
    <section className="acceso-panel">
      <div className="acceso-formulario">{children}</div>
    </section>
    {pie}
    <Firma />
  </main>;
}
