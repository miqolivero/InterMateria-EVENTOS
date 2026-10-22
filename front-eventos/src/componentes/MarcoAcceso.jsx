import { ArrowLeftOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import "./MarcoAcceso.css";

export default function MarcoAcceso({ children }) {
  return <main className="marco-acceso">
    <Link className="acceso-marca" to="/">Sistema de Eventos</Link>
    <section className="acceso-panel">
      <div className="acceso-formulario">{children}</div>
    </section>
    <Link className="acceso-volver" to="/"><ArrowLeftOutlined /> Volver a empresas</Link>
  </main>;
}
