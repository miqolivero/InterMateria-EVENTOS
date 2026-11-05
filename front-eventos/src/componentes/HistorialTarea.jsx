import { useCallback } from "react";
import { Button, Empty, Modal, Skeleton, Timeline } from "antd";
import dayjs from "dayjs";
import { historialTarea } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { formatearFecha } from "../utils/formato.js";
import ErrorConsulta from "./ErrorConsulta";
import EstadoTag from "./EstadoTag";
import "./Cambios.css";

// Por qué estados pasó una tarea: quién la cambió y cuándo.
export default function HistorialTarea({ tarea, cerrar }) {
  const consulta = useConsulta(useCallback(async () => (await historialTarea(tarea.id_tarea)).data, [tarea.id_tarea]));
  const cambios = consulta.datos || [];
  return <Modal open title={`Historial · ${tarea.descripcion}`} onCancel={cerrar} footer={<Button onClick={cerrar}>Cerrar</Button>}>
    {tarea.fecha_primera_finalizacion && <p className="cambio-meta">Se terminó por primera vez el {formatearFecha(tarea.fecha_primera_finalizacion)}.</p>}
    <ErrorConsulta {...consulta} />
    {consulta.cargando ? <Skeleton active /> : cambios.length === 0
      ? <Empty description="Todavía no cambió de estado." />
      : <Timeline items={cambios.map((c) => ({ key: c.id_cambio_estado, content: <div className="cambio-item">
        <span><EstadoTag estado={c.estado_anterior} /> → <EstadoTag estado={c.estado_nuevo} /></span>
        <span className="cambio-meta">{c.usuario?.nombre} · {dayjs(c.fecha_hora).format("DD/MM/YYYY HH:mm")}</span>
      </div> }))} />}
  </Modal>;
}
