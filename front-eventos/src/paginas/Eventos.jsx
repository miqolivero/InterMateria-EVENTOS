import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Calendar, Card, DatePicker, Descriptions, Input, Select, Skeleton, Space, Table, Tabs } from "antd";
import { listarEventos, obtenerEvento, editarEvento, iniciarPreparacion, resumenEvento } from "../servicios/operacionService.js";
import { listarCatalogo } from "../servicios/catalogosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { fechaAPI, nombreCompleto } from "../utils/formularios.js";
import { formatearFecha, formatearMoneda } from "../utils/formato.js";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import ErrorConsulta from "../componentes/ErrorConsulta";
import EstadoTag from "../componentes/EstadoTag";
import EditorEvento from "../componentes/EditorEvento";
import ServiciosEvento from "../componentes/ServiciosEvento";
import TareasEvento from "../componentes/TareasEvento";
import CierreEvento from "../componentes/CierreEvento";
import Indicadores from "../componentes/Indicadores";
import RevisionesPendientes from "../componentes/RevisionesPendientes";
import HistorialCambios from "../componentes/HistorialCambios";

export default function Eventos() {
  const [filtros, setFiltros] = useState({});
  const consulta = useConsulta(useCallback(async () => (await listarEventos(filtros)).data, [filtros]));
  const empleados = useConsulta(useCallback(async () => (await listarCatalogo("empleados")).data, []));
  const filtrar = (clave, valor) => setFiltros((v) => ({ ...v, [clave]: valor }));
  const tabla = <Table rowKey="id_evento" dataSource={consulta.datos || []} loading={consulta.cargando} scroll={{ x: 900 }} columns={[
    { title: "Cliente", dataIndex: "nombre_cliente" }, { title: "Tipo", dataIndex: "nombre_tipo_evento" },
    { title: "Fecha", dataIndex: "fecha_evento_confirmada", render: formatearFecha }, { title: "Sede", dataIndex: "sede_acordada" },
    { title: "Coordinador", dataIndex: "nombre_coordinador", render: (v) => v || "Sin asignar" },
    { title: "Estado", dataIndex: "estado", render: (v) => <EstadoTag estado={v} /> },
    { title: "", key: "ver", render: (_, e) => <Link to={`/eventos/${e.id_evento}`}>Ver evento</Link> }
  ]} />;
  return <>
    <EncabezadoPagina titulo="Eventos" /><ErrorConsulta {...consulta} /><ErrorConsulta {...empleados} />
    <Card><div className="barra-tabla"><Input.Search allowClear placeholder="Buscar cliente" style={{ maxWidth: 250 }} onSearch={(v) => filtrar("buscar", v)} />
      <Space wrap><Select placeholder="Estado" allowClear style={{ width: 180 }} onChange={(v) => filtrar("estado", v)}
        options={["confirmado", "en_preparacion", "realizado", "cancelado"].map((value) => ({ value, label: <EstadoTag estado={value} /> }))} />
        <Select placeholder="Coordinador" allowClear showSearch optionFilterProp="label" style={{ width: 210 }} loading={empleados.cargando}
          options={(empleados.datos || []).map((e) => ({ value: e.id_empleado, label: nombreCompleto(e) }))} onChange={(v) => filtrar("id_coordinador", v)} />
        <DatePicker.RangePicker format="DD/MM/YYYY" onChange={(r) => setFiltros((v) => ({ ...v, desde: fechaAPI(r?.[0]), hasta: fechaAPI(r?.[1]) }))} />
      </Space></div>
      <Tabs type="card" items={[{ key: "lista", label: "Listado", children: tabla }, { key: "calendario", label: "Calendario", children: <>
        {consulta.cargando ? <Skeleton active /> : <Calendar cellRender={(fecha, info) => info.type === "date" ?
          <div>{(consulta.datos || []).filter((e) => e.fecha_evento_confirmada === fecha.format("YYYY-MM-DD")).map((e) => <div key={e.id_evento}><Link to={`/eventos/${e.id_evento}`}>{e.nombre_cliente}</Link></div>)}</div> : info.originNode} />}
      </> }]} />
    </Card>
  </>;
}

export function EventoDetalle() {
  const { id } = useParams();
  const consulta = useConsulta(useCallback(async () => (await obtenerEvento(id)).data, [id]));
  const [editor, setEditor] = useState(false);
  const [pestana, setPestana] = useState("resumen");
  const { ocupado, ejecutar } = useAccion();
  // Los indicadores salen de /resumen y se recargan con cada cambio del
  // evento. version vuelve a montar las pestañas que muestran "a revisar".
  const [version, setVersion] = useState(0);
  const indicadores = useConsulta(useCallback(async () => (await resumenEvento(id)).data.indicadores, [id]));
  const actualizar = () => { consulta.recargar(); indicadores.recargar(); setVersion((v) => v + 1); };
  if (consulta.cargando) return <Skeleton active />;
  if (consulta.error) return <ErrorConsulta {...consulta} />;
  const e = consulta.datos;
  const editable = e.editable === true && ["confirmado", "en_preparacion"].includes(e.estado);
  const resumen = <><Card title="Avance" className="aviso-formulario" loading={indicadores.cargando}><ErrorConsulta {...indicadores} />
    <Indicadores indicadores={indicadores.datos} /></Card><Card><Descriptions column={{ xs: 1, md: 2 }} items={[
    { key: "cliente", label: "Cliente", children: nombreCompleto(e.cliente) },
    { key: "contacto", label: "Contacto", children: [e.cliente?.email, e.cliente?.telefono].filter(Boolean).join(" · ") || "—" },
    { key: "tipo", label: "Tipo", children: e.solicitud?.nombre_tipo_evento },
    { key: "fecha", label: "Fecha", children: formatearFecha(e.fecha_evento_confirmada) },
    { key: "sede", label: "Sede", children: e.sede_acordada || "—" },
    { key: "asistentes", label: "Asistentes", children: e.cantidad_asistentes },
    { key: "coordinador", label: "Coordinador", children: nombreCompleto(e.coordinador) },
    { key: "condiciones", label: "Condiciones", children: e.condiciones_acordadas || "—" },
    { key: "preferencias", label: "Preferencias", children: e.solicitud?.preferencias || "—" },
    { key: "solicitud", label: "Solicitud", children: e.solicitud && <Link to={`/solicitudes/${e.solicitud.id_solicitud}`}>Ver solicitud</Link> },
    { key: "presupuesto", label: "Presupuesto aceptado", children: e.presupuesto_aceptado && <Link to={`/presupuestos/${e.presupuesto_aceptado.id_presupuesto}`}>
      Versión {e.presupuesto_aceptado.numero_version} · {formatearMoneda(e.presupuesto_aceptado.importe_total)}</Link> }
  ]} /></Card></>;
  const pendientes = indicadores.datos?.pendientes_revision || 0;
  return <>
    <Link className="enlace-volver" to="/eventos">Volver a eventos</Link>
    <EncabezadoPagina titulo={`Evento #${id}`} acciones={<Space wrap><EstadoTag estado={e.estado} />
      {indicadores.datos?.alerta && <Badge status="error" text="Atención" />}
      {editable && <Button onClick={() => setEditor(true)}>Cambiar lo acordado</Button>}
      {editable && e.estado === "confirmado" && <Button type="primary" loading={ocupado} onClick={async () => {
        const respuesta = await ejecutar(() => iniciarPreparacion(id)); if (respuesta.ok) consulta.recargar();
      }}>Iniciar preparación</Button>}
    </Space>} />
    <Tabs type="card" activeKey={pestana} onChange={setPestana} items={[
      { key: "resumen", label: "Resumen", children: resumen },
      { key: "servicios", label: "Servicios", children: <ServiciosEvento id={id} editable={editable} actualizado={actualizar} /> },
      { key: "tareas", label: "Tareas", children: <TareasEvento key={version} id={id} editable={editable} /> },
      { key: "revisiones", label: <Badge count={pendientes} size="small" offset={[8, -2]}>A revisar</Badge>,
        children: <RevisionesPendientes key={version} idEvento={id} editable={editable} actualizado={actualizar} /> },
      { key: "historial", label: "Historial", children: <HistorialCambios key={version} idEvento={id} /> },
      { key: "cierre", label: "Cierre", children: <CierreEvento evento={e} actualizado={actualizar} /> }
    ]} />
    {editor && <EditorEvento datos={e} conCambio titulo="Cambiar lo acordado" operacion={(body) => editarEvento(id, body)} cerrar={() => setEditor(false)} guardado={actualizar} />}
  </>;
}
