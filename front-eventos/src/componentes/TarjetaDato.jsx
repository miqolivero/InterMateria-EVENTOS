import { Card } from "antd";
import { Link } from "react-router-dom";
import "./TarjetaDato.css";

// Un número destacado, para las filas de indicadores. El título puede ocupar una o
// dos líneas según el ancho, pero el valor queda siempre abajo: así los números de
// la fila están alineados. El color identifica al dato (franja e ícono); el texto
// queda en el color normal, para que se lea bien sobre cualquier tono.
// orden: la posición en la fila, para que entren una detrás de la otra.
// a: la ruta a la que lleva. alTocar: lo que hace si no cambia de pantalla.
export default function TarjetaDato({ titulo, valor, detalle, icono, tono = "azul", orden = 0, cargando = false, a, alTocar }) {
  const tarjeta = <Card loading={cargando} className={`tarjeta-dato tono-${tono}`} style={{ "--orden": orden }}>
    <span className="tarjeta-dato-titulo">{titulo}</span>
    <div className="tarjeta-dato-fila">
      <span className="tarjeta-dato-valor">{valor}</span>
      {icono && <span className="tarjeta-dato-icono" aria-hidden="true">{icono}</span>}
    </div>
    {detalle && <span className="tarjeta-dato-detalle">{detalle}</span>}
  </Card>;
  const nombre = `${titulo}: ${valor}. Ver el detalle`;
  if (a) return <Link to={a} className="tarjeta-dato-enlace" aria-label={nombre}>{tarjeta}</Link>;
  if (alTocar) return <button type="button" onClick={alTocar} className="tarjeta-dato-enlace" aria-label={nombre}>{tarjeta}</button>;
  return tarjeta;
}
