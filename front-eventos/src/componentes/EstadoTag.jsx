import { Tag } from "antd";
import { estados } from "../utils/estados";

export default function EstadoTag({ estado }) {
  const configuracion = estados[estado];
  // Los estados neutros (sin color) van con borde: el Tag sin color de antd 6
  // tiene el mismo gris que el fondo de la pagina (colorBgLayout) y no se veia.
  return <Tag color={configuracion?.color} variant={configuracion?.color ? undefined : "outlined"}>
    {configuracion?.texto || estado || "Sin estado"}</Tag>;
}
