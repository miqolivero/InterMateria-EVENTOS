import { useCallback, useState } from "react";
import { Card, Empty, Select, Space, Tag, Timeline } from "antd";
import dayjs from "dayjs";
import { cambiosEvento } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { TIPOS_CAMBIO } from "../utils/estados.js";
import ErrorConsulta from "./ErrorConsulta";
import LimpiarFiltros from "./LimpiarFiltros";
import "./Cambios.css";

const contar = (tareas, servicios) => [tareas > 0 && `${tareas} ${tareas === 1 ? "tarea" : "tareas"}`,
  servicios > 0 && `${servicios} ${servicios === 1 ? "servicio" : "servicios"}`].filter(Boolean).join(" y ");

// Un cambio del historial. Mientras le quede algo a revisar, no está revisado. El empleado lo recibe sin valor anterior ni nuevo
// (la API no los manda), así que esa línea simplemente no aparece.
export function ItemCambio({ cambio }) {
  const conValores = cambio.valor_anterior != null || cambio.valor_nuevo != null;
  return <div className="cambio-item">
    <span><Tag>{TIPOS_CAMBIO[cambio.tipo] || cambio.tipo}</Tag><strong>{cambio.descripcion}</strong>
      {cambio.revision_completa === true && <Tag color="green" className="cambio-revision">Revisado</Tag>}
      {cambio.revision_completa === false && <Tag color="orange" className="cambio-revision">Falta revisar</Tag>}</span>
    {conValores && <span className="cambio-valores">{cambio.valor_anterior ?? "—"} → {cambio.valor_nuevo ?? "—"}</span>}
    <span>Motivo: {cambio.motivo}</span>
    <span className="cambio-meta">{cambio.usuario?.nombre} · {dayjs(cambio.fecha_hora).format("DD/MM/YYYY HH:mm")}
      {cambio.afectados > 0 && ` · Afectó: ${contar(cambio.tareas_afectadas, cambio.servicios_afectados)}`}
      {cambio.pendientes_revision > 0 && ` · Falta revisar: ${contar(cambio.tareas_sin_revisar, cambio.servicios_sin_revisar)}`}</span>
  </div>;
}

const itemsTimeline = (cambios) => cambios.map((c) => ({ key: c.id_cambio,
  color: c.pendientes_revision > 0 ? "orange" : "gray", content: <ItemCambio cambio={c} /> }));

// Historial completo del evento, del más nuevo al más viejo. Nada se borra.
export default function HistorialCambios({ idEvento }) {
  const [tipo, setTipo] = useState(null);
  const [orden, setOrden] = useState("nuevos");
  const consulta = useConsulta(useCallback(async () => (await cambiosEvento(idEvento, tipo ? { tipo } : {})).data, [idEvento, tipo]));
  // La API los manda del más nuevo al más viejo
  const cambios = orden === "nuevos" ? consulta.datos || [] : [...(consulta.datos || [])].reverse();
  return <Card>
    <div className="barra-tabla"><Space wrap><Select placeholder="Todos los cambios" allowClear value={tipo} onChange={setTipo} className="selector-estado"
      popupMatchSelectWidth={false} options={Object.entries(TIPOS_CAMBIO).map(([value, label]) => ({ value, label }))} aria-label="Tipo de cambio" />
      <Select value={orden} onChange={setOrden} aria-label="Ordenar por fecha" className="selector-estado" popupMatchSelectWidth={false}
        options={[{ value: "nuevos", label: "Más nuevos primero" }, { value: "viejos", label: "Más viejos primero" }]} />
      <LimpiarFiltros activo={Boolean(tipo)} alTocar={() => setTipo(null)} /></Space></div>
    <ErrorConsulta {...consulta} />
    {consulta.cargando ? <Card loading variant="borderless" /> : cambios.length === 0
      ? <Empty description="Todavía no hubo cambios después de confirmar." />
      : <Timeline items={itemsTimeline(cambios)} />}
  </Card>;
}
