import { useCallback } from "react";
import { Link } from "react-router-dom";
import { DatePicker, Segmented, Space, Table, Tag } from "antd";
import { eventosPorEstado } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useFiltros } from "../contexto/useFiltros.js";
import { fechaAPI } from "../utils/formularios.js";
import { formatearFecha } from "../utils/formato.js";
import { ordenFecha } from "../utils/tablas.js";
import { estados, SITUACIONES } from "../utils/estados.js";
import ErrorConsulta from "./ErrorConsulta";
import EstadoTag from "./EstadoTag";
import LimpiarFiltros from "./LimpiarFiltros";
import "./Cambios.css";

// La consulta "eventos por estado" del cliente, como pestaña de Eventos. Junta las
// solicitudes que esperan respuesta (presupuesto presentado) con los eventos, y
// deja a la vista lo rechazado y lo cancelado: nada se borra.
export default function EventosPorEstado() {
  const { filtros, setFiltros, filtrar, limpiar, hayFiltros, clave } = useFiltros({ situacion: "todas" }, { situacion: "todas" });
  const { situacion } = filtros;
  const consulta = useConsulta(useCallback(async () => (await eventosPorEstado({ ...(filtros.desde ? { desde: filtros.desde, hasta: filtros.hasta } : {}),
    ...(filtros.situacion === "todas" ? {} : { situacion: filtros.situacion }) })).data, [filtros]));
  const conteo = consulta.datos?.conteo || {};
  const total = Object.values(conteo).reduce((a, b) => a + b, 0);
  return <>
    <ErrorConsulta {...consulta} />
    <div className="barra-tabla" key={clave}>
      <span className="texto-secundario">Lo que espera respuesta del cliente, lo confirmado y lo que quedó en el camino.</span>
      <Space wrap><DatePicker.RangePicker format="DD/MM/YYYY" aria-label="Rango de fechas"
        onChange={(r) => setFiltros((f) => ({ situacion: f.situacion, ...(r ? { desde: fechaAPI(r[0]), hasta: fechaAPI(r[1]) } : {}) }))} />
        <LimpiarFiltros activo={hayFiltros} alTocar={limpiar} /></Space>
    </div>
    <div className="filtro-segmentado"><Segmented value={situacion} onChange={(v) => filtrar("situacion", v)} aria-label="Situación"
      options={[{ value: "todas", label: `Todas (${total})` }, ...SITUACIONES.map((s) => ({ value: s, label: `${estados[s].texto} (${conteo[s] ?? 0})` }))]} /></div>
    <Table rowKey={(fila) => `${fila.tipo}-${fila.id_evento ?? fila.id_solicitud}`} dataSource={consulta.datos?.items || []} loading={consulta.cargando}
      scroll={{ x: 760 }} columns={[
        { title: "Fecha", dataIndex: "fecha", render: formatearFecha, ...ordenFecha("fecha") },
        { title: "Cliente", dataIndex: "nombre_cliente" },
        { title: "Tipo de evento", dataIndex: "nombre_tipo_evento" },
        { title: "Situación", dataIndex: "situacion", render: (v, f) => <Space size={4} wrap><EstadoTag estado={v} />
          {f.respuesta_cliente && <Tag color={f.respuesta_cliente === "aceptado" ? "green" : "red"}>El cliente {f.respuesta_cliente === "aceptado" ? "aceptó" : "rechazó"}</Tag>}</Space> },
        { title: "", key: "ver", render: (_, f) => f.tipo === "evento" ? <Link to={`/eventos/${f.id_evento}`}>Ver evento</Link>
          : f.id_presupuesto_presentado ? <Link to={`/presupuestos/${f.id_presupuesto_presentado}`}>Ver presupuesto</Link>
            : <Link to={`/solicitudes/${f.id_solicitud}`}>Ver solicitud</Link> }
      ]} />
  </>;
}
