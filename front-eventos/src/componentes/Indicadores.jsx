import { Tag } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import "./Cambios.css";

// Fase 11: dos indicadores y una alerta en lugar de un porcentaje. Los números
// los calcula la API (una sola definición para el evento y el tablero): acá
// solo se muestran. La alerta no se apaga por terminar las tareas.
function Avisos({ i }) {
  return <div className="indicadores-avisos">
    {i.alerta && <Tag color="red" icon={<ExclamationCircleOutlined />}>Atención</Tag>}
    {i.servicios_sin_confirmar > 0 && <Tag color="gold">{i.servicios_sin_confirmar} sin confirmar</Tag>}
    {i.pendientes_revision > 0 && <Tag color="orange">{i.pendientes_revision} a revisar</Tag>}
    {i.tareas_vencidas > 0 && <Tag color="red">{i.tareas_vencidas} vencidas</Tag>}
  </div>;
}

export default function Indicadores({ indicadores: i, compacto = false }) {
  if (!i) return null;
  if (compacto) return <div className="indicadores-compactos">
    <span>Tareas {i.tareas_completadas} de {i.tareas_total} · Servicios {i.servicios_confirmados} de {i.servicios_total}</span>
    <Avisos i={i} />
  </div>;
  return <div className="indicadores-evento">
    <div className="indicador-evento"><strong>{i.tareas_completadas} de {i.tareas_total}</strong><span>Tareas completadas</span></div>
    <div className="indicador-evento"><strong>{i.servicios_confirmados} de {i.servicios_total}</strong><span>Servicios confirmados</span></div>
    <Avisos i={i} />
  </div>;
}
