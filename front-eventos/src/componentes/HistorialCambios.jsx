import { useCallback, useState } from "react";
import { Card, Empty, Select, Tag, Timeline } from "antd";
import dayjs from "dayjs";
import { cambiosEvento } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { TIPOS_CAMBIO } from "../utils/estados.js";
import ErrorConsulta from "./ErrorConsulta";
import "./Cambios.css";

// Un cambio del historial. El empleado lo recibe sin valor anterior ni nuevo
// (la API no los manda), así que esa línea simplemente no aparece.
export function ItemCambio({ cambio }) {
  const conValores = cambio.valor_anterior != null || cambio.valor_nuevo != null;
  return <div className="cambio-item">
    <span><Tag>{TIPOS_CAMBIO[cambio.tipo] || cambio.tipo}</Tag><strong>{cambio.descripcion}</strong></span>
    {conValores && <span className="cambio-valores">{cambio.valor_anterior ?? "—"} → {cambio.valor_nuevo ?? "—"}</span>}
    <span>Motivo: {cambio.motivo}</span>
    <span className="cambio-meta">{cambio.usuario?.nombre} · {dayjs(cambio.fecha_hora).format("DD/MM/YYYY HH:mm")}
      {cambio.afectados > 0 && ` · ${cambio.afectados} afectados, ${cambio.pendientes_revision} sin revisar`}</span>
  </div>;
}

const itemsTimeline = (cambios) => cambios.map((c) => ({ key: c.id_cambio,
  color: c.pendientes_revision > 0 ? "orange" : "gray", content: <ItemCambio cambio={c} /> }));

// Historial completo del evento, del más nuevo al más viejo. Nada se borra.
export default function HistorialCambios({ idEvento }) {
  const [tipo, setTipo] = useState(null);
  const consulta = useConsulta(useCallback(async () => (await cambiosEvento(idEvento, tipo ? { tipo } : {})).data, [idEvento, tipo]));
  const cambios = consulta.datos || [];
  return <Card>
    <div className="barra-tabla"><Select placeholder="Todos los cambios" allowClear value={tipo} onChange={setTipo} className="selector-estado"
      popupMatchSelectWidth={false} options={Object.entries(TIPOS_CAMBIO).map(([value, label]) => ({ value, label }))} aria-label="Tipo de cambio" /></div>
    <ErrorConsulta {...consulta} />
    {consulta.cargando ? <Card loading variant="borderless" /> : cambios.length === 0
      ? <Empty description="Todavía no hubo cambios después de confirmar." />
      : <Timeline items={itemsTimeline(cambios)} />}
  </Card>;
}
