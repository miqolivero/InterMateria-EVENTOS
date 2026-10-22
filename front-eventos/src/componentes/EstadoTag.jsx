import { Tag } from "antd";
import { estados } from "../utils/estados";

export default function EstadoTag({ estado }) {
  const configuracion = estados[estado];
  return <Tag color={configuracion?.color}>{configuracion?.texto || estado || "Sin estado"}</Tag>;
}
