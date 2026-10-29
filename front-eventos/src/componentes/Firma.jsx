import isotipo from "../assets/trama-isotipo.svg";
import "./Firma.css";

// La firma de quien desarrolla el sistema. Va al pie del login y de la barra
// lateral. compacta: solo el isotipo, para la barra colapsada.
export default function Firma({ compacta = false, className = "" }) {
  return <p className={`firma ${className}`} title="Desarrollado por Trama Software">
    <img src={isotipo} alt="" className="firma-isotipo" />
    {!compacta && <span>Desarrollado por <strong>Trama Software</strong></span>}
  </p>;
}
