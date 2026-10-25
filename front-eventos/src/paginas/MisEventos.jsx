import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, Descriptions, Empty, List, Skeleton, Table, Tag, Timeline } from "antd";
import { misTareas, resumenEvento } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { formatearFecha } from "../utils/formato.js";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import ErrorConsulta from "../componentes/ErrorConsulta";
import EstadoTag from "../componentes/EstadoTag";
import Indicadores from "../componentes/Indicadores";
import { ItemRevision, ModalRevision } from "../componentes/RevisionesPendientes";
import { ItemCambio } from "../componentes/HistorialCambios";
import "../componentes/Cambios.css";

// Fase 11: el empleado ve el contexto completo de los eventos donde trabaja.
// Todo sale de GET /eventos/:id/resumen con su alcance: sin importes, el
// cliente solo con el nombre, las tareas de todos y sus revisiones. La API ya
// recorta los datos; acá no se esconde nada a mano.

// Los eventos salen de sus tareas: son los mismos que ve en "Mis tareas"
export default function MisEventos() {
  const consulta = useConsulta(useCallback(async () => (await misTareas()).data, []));
  const eventos = [...new Map((consulta.datos || []).map((t) => [t.evento.id_evento, t.evento])).values()]
    .sort((a, b) => a.fecha_evento_confirmada.localeCompare(b.fecha_evento_confirmada));
  return <><EncabezadoPagina titulo="Mis eventos" descripcion="Los eventos donde tenés tareas." />
    <ErrorConsulta {...consulta} />
    <Card loading={consulta.cargando}>{eventos.length === 0 ? <Empty description="No tenés tareas en eventos abiertos." />
      : <List dataSource={eventos} renderItem={(e) => <List.Item extra={<EstadoTag estado={e.estado} />}>
        <List.Item.Meta title={<Link to={`/mis-eventos/${e.id_evento}`}>{e.nombre_cliente}</Link>}
          description={`${e.nombre_tipo_evento} · ${formatearFecha(e.fecha_evento_confirmada)}${e.sede_acordada ? ` · ${e.sede_acordada}` : ""}`} />
      </List.Item>} />}</Card>
  </>;
}

export function MiEventoDetalle() {
  const { id } = useParams();
  const consulta = useConsulta(useCallback(async () => (await resumenEvento(id)).data, [id]));
  const [revision, setRevision] = useState(null);
  if (consulta.cargando) return <Skeleton active />;
  if (consulta.error) return <><Link className="enlace-volver" to="/mis-eventos">Volver a mis eventos</Link><ErrorConsulta {...consulta} /></>;
  const { evento, cliente, indicadores, servicios, tareas, revisiones_pendientes: revisiones, ultimos_cambios: cambios } = consulta.datos;
  return <>
    <Link className="enlace-volver" to="/mis-eventos">Volver a mis eventos</Link>
    <EncabezadoPagina titulo={cliente.nombre} descripcion={evento.nombre_tipo_evento} acciones={<EstadoTag estado={evento.estado} />} />
    <Card className="aviso-formulario"><Indicadores indicadores={indicadores} /></Card>
    {revisiones.length > 0 && <Card title="Tenés que revisar" className="aviso-formulario">
      {revisiones.map((r) => <ItemRevision key={r.id_afectado} revision={r} revisar={setRevision} />)}</Card>}
    <Card title="El evento" className="aviso-formulario"><Descriptions column={{ xs: 1, md: 2 }} items={[
      { key: "fecha", label: "Fecha", children: formatearFecha(evento.fecha_evento_confirmada) },
      { key: "sede", label: "Sede", children: evento.sede_acordada || "—" },
      { key: "asistentes", label: "Asistentes", children: evento.cantidad_asistentes },
      { key: "coordinador", label: "Coordina", children: evento.coordinador?.nombre || "Sin asignar" },
      { key: "condiciones", label: "Condiciones", children: evento.condiciones_acordadas || "—" }
    ]} /></Card>
    <Card title="Servicios" className="aviso-formulario"><Table rowKey="id_servicio_x_evento" dataSource={servicios} pagination={false} scroll={{ x: 560 }}
      rowClassName={(s) => s.estado_servicio === "cancelado" ? "servicio-cancelado" : ""} columns={[
        { title: "Servicio", dataIndex: "nombre_servicio", render: (v, s) => <div className="servicio-nombre"><span>{v}</span>
          <span>{s.estado_servicio === "cancelado" && <EstadoTag estado="cancelado" />}{s.a_revisar && <Tag color="orange">A revisar</Tag>}</span></div> },
        { title: "Proveedor", dataIndex: "nombre_proveedor", render: (v) => v || "Sin asignar" },
        { title: "Estado", dataIndex: "estado_proveedor", render: (v) => <EstadoTag estado={v} /> }
      ]} /></Card>
    <Card title="Tareas de todo el equipo" className="aviso-formulario"><Table rowKey="id_tarea" dataSource={tareas} pagination={false} scroll={{ x: 640 }} columns={[
      { title: "Tarea", dataIndex: "descripcion", render: (v, t) => <div className="servicio-nombre"><span>{v}</span>
        <span>{t.vencida && <Tag color="red">Vencida</Tag>}{t.a_revisar && <Tag color="orange">A revisar</Tag>}</span></div> },
      { title: "Responsable", dataIndex: "nombre_responsable", render: (v) => v || "Sin asignar" },
      { title: "Fecha prevista", dataIndex: "fecha_prevista", render: formatearFecha },
      { title: "Estado", dataIndex: "estado_tarea", render: (v) => <EstadoTag estado={v} /> }
    ]} /></Card>
    <Card title="Últimos cambios">{cambios.length === 0 ? <Empty description="Sin cambios después de confirmar." />
      : <Timeline items={cambios.map((c) => ({ key: c.id_cambio, content: <ItemCambio cambio={c} /> }))} />}</Card>
    {revision && <ModalRevision revision={revision} cerrar={() => setRevision(null)} guardado={consulta.recargar} />}
  </>;
}
