import { useCallback, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, Card, DatePicker, Descriptions, Input, Popconfirm, Select, Skeleton, Space, Table, Tag } from "antd";
import { listarSolicitudes, obtenerSolicitud, cambiarEstadoSolicitud, crearPresupuesto } from "../servicios/operacionService.js";
import { listarCatalogo } from "../servicios/catalogosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { useFiltros } from "../contexto/useFiltros.js";
import { fechaAPI, nombreCompleto } from "../utils/formularios.js";
import { formatearFecha, formatearMoneda } from "../utils/formato.js";
import { ordenFecha } from "../utils/tablas.js";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import EstadoTag from "../componentes/EstadoTag";
import LimpiarFiltros from "../componentes/LimpiarFiltros";
import ErrorConsulta from "../componentes/ErrorConsulta";
import EditorSolicitud from "../componentes/EditorSolicitud";

const opcionesEstado = ["pendiente", "presupuestada", "aceptada", "rechazada", "cancelada"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));

export default function Solicitudes() {
  // Desde una tarjeta de Seguimiento se entra con el estado y la fecha en la URL
  const [parametros] = useSearchParams();
  const estadoInicial = opcionesEstado.some((o) => o.value === parametros.get("estado")) ? parametros.get("estado") : undefined;
  const { filtros, setFiltros, filtrar, limpiar, hayFiltros, clave } = useFiltros({ estado: estadoInicial, hasta: parametros.get("hasta") || undefined });
  const [editor, setEditor] = useState(false);
  const consulta = useConsulta(useCallback(async () => (await listarSolicitudes(filtros)).data, [filtros]));
  const clientes = useConsulta(useCallback(async () => (await listarCatalogo("clientes")).data, []));
  const navigate = useNavigate();
  return <>
    <EncabezadoPagina titulo="Solicitudes" acciones={<Button type="primary" onClick={() => setEditor(true)}>Nueva solicitud</Button>} />
    <ErrorConsulta {...consulta} /><ErrorConsulta {...clientes} />
    {filtros.hasta && parametros.get("hasta") === filtros.hasta && <Alert type="info" showIcon closable className="aviso-formulario" onClose={() => filtrar("hasta", undefined)}
      title={`Desde Seguimiento: solicitudes con fecha prevista hasta el ${formatearFecha(filtros.hasta)}. Cerrá este aviso para ver todas.`} />}
    <Card><div className="barra-tabla" key={clave}>
      <Input.Search placeholder="Buscar cliente" allowClear onSearch={(v) => filtrar("buscar", v)} style={{ maxWidth: 250 }} />
      <Space wrap><Select placeholder="Estado" allowClear options={opcionesEstado} defaultValue={filtros.estado} onChange={(v) => filtrar("estado", v)} style={{ width: 150 }} />
        <Select placeholder="Cliente" allowClear showSearch optionFilterProp="label" loading={clientes.cargando} style={{ width: 220 }}
          options={(clientes.datos || []).map((c) => ({ value: c.id_cliente, label: nombreCompleto(c) }))} onChange={(v) => filtrar("id_cliente", v)} />
        <DatePicker.RangePicker format="DD/MM/YYYY" onChange={(rango) => setFiltros((v) => ({ ...v, desde: fechaAPI(rango?.[0]), hasta: fechaAPI(rango?.[1]) }))} />
        <LimpiarFiltros activo={hayFiltros} alTocar={limpiar} />
      </Space>
    </div><Table rowKey="id_solicitud" loading={consulta.cargando} dataSource={consulta.datos || []} scroll={{ x: 800 }} columns={[
      { title: "Cliente", dataIndex: "nombre_cliente" }, { title: "Tipo", dataIndex: "nombre_tipo_evento" },
      { title: "Fecha prevista", dataIndex: "fecha_evento_prevista", render: formatearFecha, ...ordenFecha("fecha_evento_prevista") }, { title: "Asistentes", dataIndex: "cantidad_asistentes" },
      { title: "Estado", dataIndex: "estado", render: (v) => <EstadoTag estado={v} /> },
      { title: "", key: "ver", render: (_, fila) => <Link to={`/solicitudes/${fila.id_solicitud}`}>Ver solicitud</Link> }
    ]} /></Card>
    {editor && <EditorSolicitud datos={{}} cerrar={() => setEditor(false)} guardado={(s) => navigate(`/solicitudes/${s.id_solicitud}`)} />}
  </>;
}

export function SolicitudDetalle() {
  const { id } = useParams();
  const consulta = useConsulta(useCallback(async () => (await obtenerSolicitud(id)).data, [id]));
  const { ocupado, ejecutar } = useAccion();
  const [editor, setEditor] = useState(false);
  const navigate = useNavigate();
  const solicitud = consulta.datos;
  if (consulta.cargando) return <Skeleton active />;
  if (consulta.error) return <ErrorConsulta {...consulta} />;
  const editable = ["pendiente", "presupuestada"].includes(solicitud.estado);
  return <>
    <Link to="/solicitudes" className="enlace-volver">Volver a solicitudes</Link>
    <EncabezadoPagina titulo={`Solicitud #${id}`} acciones={<Space wrap><EstadoTag estado={solicitud.estado} />
      {editable && <Button onClick={() => setEditor(true)}>Editar solicitud</Button>}
      {solicitud.id_evento && <Link to={`/eventos/${solicitud.id_evento}`}><Button>Ver evento</Button></Link>}
    </Space>} />
    <Card><Descriptions column={{ xs: 1, md: 2 }} items={[
      { key: "cliente", label: "Cliente", children: solicitud.nombre_cliente || nombreCompleto(solicitud.cliente) },
      { key: "tipo", label: "Tipo", children: solicitud.nombre_tipo_evento },
      { key: "fecha", label: "Fecha prevista", children: formatearFecha(solicitud.fecha_evento_prevista) },
      { key: "alta", label: "Solicitud recibida", children: formatearFecha(solicitud.fecha_solicitud) },
      { key: "asistentes", label: "Asistentes", children: solicitud.cantidad_asistentes },
      { key: "sede", label: "Sede prevista", children: solicitud.sede_prevista ? <Space size={4} wrap>{solicitud.sede_prevista}{!solicitud.id_sede && <Tag>Lo reservó el cliente</Tag>}</Space> : "—" },
      { key: "contacto", label: "Contacto", children: [solicitud.cliente?.email, solicitud.cliente?.telefono].filter(Boolean).join(" · ") || "—" },
      { key: "preferencias", label: "Preferencias", children: solicitud.preferencias || "—" }
    ]} /></Card>
    <Card title="Presupuestos" style={{ marginTop: 20 }} extra={editable && !solicitud.presupuestos?.length && <Button type="primary" loading={ocupado} onClick={async () => {
      const respuesta = await ejecutar(() => crearPresupuesto(id), "Presupuesto creado.");
      if (respuesta.ok) navigate(`/presupuestos/${respuesta.datos.id_presupuesto}`);
    }}>Nuevo presupuesto</Button>}>
      {/* La versión aceptada se resalta y las que quedaron sin efecto se atenúan:
          así se ve de un vistazo cuál vale. El Tag explica cada estado. */}
      <Table rowKey="id_presupuesto" dataSource={solicitud.presupuestos || []} pagination={false} scroll={{ x: 550 }}
        rowClassName={(p) => p.estado === "aceptado" ? "fila-destacada" : ["reemplazado", "rechazado"].includes(p.estado) ? "fila-historica" : ""} columns={[
        { title: "Versión", dataIndex: "numero_version", render: (v, p) => p.estado === "aceptado" ? <strong>Versión {v} · la que vale</strong> : `Versión ${v}` }, { title: "Fecha", dataIndex: "fecha_emision", render: formatearFecha, ...ordenFecha("fecha_emision") },
        { title: "Total", dataIndex: "importe_total", render: formatearMoneda },
        { title: "Estado", dataIndex: "estado", render: (v, p) => <Space size={4} wrap><EstadoTag estado={v} />
          {p.estado === "presentado" && p.respuesta_cliente && <Tag color={p.respuesta_cliente === "aceptado" ? "green" : "red"}>El cliente {p.respuesta_cliente === "aceptado" ? "aceptó" : "rechazó"}</Tag>}</Space> },
        { title: "", key: "ver", render: (_, p) => <Link to={`/presupuestos/${p.id_presupuesto}`}>{p.estado === "borrador" ? <Button type="primary" size="small">Editar presupuesto</Button> : "Ver presupuesto"}</Link> }
      ]} />
    </Card>
    {editable && <Space style={{ marginTop: 20 }}>{["rechazada", "cancelada"].map((estado) => <Popconfirm key={estado} title={estado === "rechazada" ? "¿Rechazar solicitud?" : "¿Cancelar solicitud?"} okText="Confirmar" cancelText="Volver" onConfirm={async () => {
      const respuesta = await ejecutar(() => cambiarEstadoSolicitud(id, estado)); if (respuesta.ok) consulta.recargar();
    }}><Button danger disabled={ocupado}>{estado === "rechazada" ? "Rechazar" : "Cancelar solicitud"}</Button></Popconfirm>)}</Space>}
    {editor && <EditorSolicitud datos={solicitud} cerrar={() => setEditor(false)} guardado={consulta.recargar} />}
  </>;
}
