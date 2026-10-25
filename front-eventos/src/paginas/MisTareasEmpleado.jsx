import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Empty, Form, Input, Segmented, Select, Space, Tag, Typography } from "antd";
import { CalendarOutlined, EnvironmentOutlined, MailOutlined, PhoneOutlined, UserOutlined } from "@ant-design/icons";
import { cambiarEstadoTarea, estadoProveedor, misTareas } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { useSesion } from "../contexto/useSesion.js";
import { formatearFecha } from "../utils/formato.js";
import { estados, ESTADOS_PROVEEDOR } from "../utils/estados.js";
import EstadoTag from "../componentes/EstadoTag";
import ErrorConsulta from "../componentes/ErrorConsulta";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import "./MisTareasEmpleado.css";
import "../componentes/Cambios.css";

// Panel de trabajo del rol empleado (Fase 10), pensado para el celular.
// Todo sale de GET /tareas/mias, que ya trae el evento, el proveedor y los
// pasos de cada tarea. El contexto completo del evento (las tareas de los
// demas, los cambios) esta en "Mis eventos" (Fase 11).
// Ninguna parte muestra importes: la API no los manda.

const FILTROS = [
  { value: "todas", label: "Todas" },
  { value: "vencidas", label: "Vencidas" },
  { value: "pendiente", label: "Pendientes" },
  { value: "en_curso", label: "En curso" },
  { value: "completada", label: "Completadas" }
];


// El estado siguiente de una tarea y el texto de su botón
const SIGUIENTE = { pendiente: ["en_curso", "Empezar"], en_curso: ["completada", "Completar"] };
const ANTERIOR = { en_curso: "pendiente", completada: "en_curso" };

const colorDelPaso = (estado) => estado === "completada" ? "green" : estado === "en_curso" ? "blue" : undefined;

function Tarea({ tarea, actualizar }) {
  const { ocupado, ejecutar } = useAccion();
  const siguiente = SIGUIENTE[tarea.estado_tarea];
  const pasos = tarea.servicio?.pasos || [];
  const cambiar = async (estado, exito) => {
    const r = await ejecutar(() => cambiarEstadoTarea(tarea.id_tarea, estado), exito);
    if (r.ok) actualizar();
  };
  // Fase 11: sin secuencia, el boton siempre esta habilitado
  const boton = siguiente && <Button type="primary" block loading={ocupado}
    onClick={() => cambiar(siguiente[0], siguiente[0] === "completada" ? "Tarea completada." : "Tarea en curso.")}>{siguiente[1]}</Button>;
  return <div className={`tarea-empleado${tarea.vencida ? " tarea-vencida" : ""}`}>
    <div className="tarea-cabecera">
      <Typography.Text strong className="tarea-descripcion">{tarea.descripcion}</Typography.Text>
      <Space size={4} wrap>{tarea.vencida && <Tag color="red">Vencida</Tag>}{tarea.a_revisar && <Tag color="orange">A revisar</Tag>}
        <EstadoTag estado={tarea.estado_tarea} /></Space>
    </div>
    <Typography.Text type={tarea.vencida ? "danger" : "secondary"} className="tarea-fecha">
      <CalendarOutlined /> Para el {formatearFecha(tarea.fecha_prevista)}
      {tarea.fecha_finalizacion && ` · completada el ${formatearFecha(tarea.fecha_finalizacion)}`}
    </Typography.Text>
    {tarea.servicio && <Typography.Text type="secondary" className="tarea-servicio">
      {tarea.servicio.nombre_servicio}{tarea.servicio.proveedor ? ` · ${tarea.servicio.proveedor.razon_social}` : ""}</Typography.Text>}
    {tarea.observaciones && <Typography.Paragraph className="tarea-observaciones">{tarea.observaciones}</Typography.Paragraph>}
    {/* Los pasos del servicio como referencia: se completan en cualquier orden */}
    {pasos.length > 1 && <div className="tarea-pasos">{pasos.map((p) => <Tag key={p.orden} color={colorDelPaso(p.estado_tarea)}>{p.nombre_tipo_tarea}</Tag>)}</div>}
    <div className="tarea-acciones">
      {boton}
      {ANTERIOR[tarea.estado_tarea] && <Button type="link" disabled={ocupado}
        onClick={() => cambiar(ANTERIOR[tarea.estado_tarea], "Estado actualizado.")}>
        Volver a {estados[ANTERIOR[tarea.estado_tarea]].texto.toLowerCase()}</Button>}
    </div>
  </div>;
}

// Gestión del proveedor de un servicio: contacto, estado y observaciones.
// Solo esos dos campos: el proveedor asignado y los importes los decide el
// coordinador (la API responde 403 si se manda otra cosa).
function Proveedor({ servicio, actualizar }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  const { proveedor } = servicio;
  const cancelado = servicio.estado_servicio === "cancelado";
  useEffect(() => { form.setFieldsValue({ estado_proveedor: servicio.estado_proveedor, observaciones: servicio.observaciones || "" }); }, [servicio, form]);
  return <div className={`bloque-proveedor${cancelado ? " servicio-cancelado" : ""}`}>
    <div className="tarea-cabecera">
      <Typography.Text strong>{servicio.nombre_servicio}</Typography.Text>
      <Space size={4} wrap>{servicio.a_revisar && <Tag color="orange">A revisar</Tag>}
        <EstadoTag estado={cancelado ? "cancelado" : servicio.estado_proveedor} /></Space>
    </div>
    {proveedor ? <div className="contacto-proveedor">
      <Typography.Text><UserOutlined /> {proveedor.razon_social}</Typography.Text>
      {proveedor.telefono && <a href={`tel:${proveedor.telefono}`}><PhoneOutlined /> {proveedor.telefono}</a>}
      {proveedor.email && <a href={`mailto:${proveedor.email}`}><MailOutlined /> {proveedor.email}</a>}
    </div> : <Typography.Text type="secondary">Sin proveedor asignado: lo resuelve el personal propio.</Typography.Text>}
    {cancelado ? <Typography.Text type="secondary">El servicio se canceló. Sus tareas siguen hasta que el coordinador decida.</Typography.Text>
    : <Form form={form} layout="vertical" disabled={ocupado} className="formulario-proveedor" onFinish={async (v) => {
      const r = await ejecutar(() => estadoProveedor(servicio.id_servicio_x_evento,
        { estado_proveedor: v.estado_proveedor, observaciones: v.observaciones?.trim() || null }), "Proveedor actualizado.");
      if (r.ok) actualizar();
    }}>
      <Form.Item name="estado_proveedor" label="Estado del proveedor">
        <Select options={ESTADOS_PROVEEDOR.map((e) => ({ value: e, label: estados[e].texto,
          disabled: !proveedor && ["confirmado", "completado"].includes(e) }))} />
      </Form.Item>
      <Form.Item name="observaciones" label="Observaciones">
        <Input.TextArea rows={2} maxLength={2000} placeholder="Por ejemplo: confirmó que llega a las 18 h" />
      </Form.Item>
      <Button htmlType="submit" block loading={ocupado}>Guardar proveedor</Button>
    </Form>}
  </div>;
}

// Agrupa por evento. Primero los eventos con tareas vencidas, después por fecha.
// Dentro de cada evento quedan en el orden de la API: vencidas arriba.
function agruparPorEvento(tareas) {
  const grupos = new Map();
  for (const tarea of tareas) {
    const id = tarea.evento.id_evento;
    if (!grupos.has(id)) grupos.set(id, { evento: tarea.evento, tareas: [], servicios: new Map() });
    const grupo = grupos.get(id);
    grupo.tareas.push(tarea);
    if (tarea.servicio) grupo.servicios.set(tarea.servicio.id_servicio_x_evento, tarea.servicio);
  }
  const conVencidas = (g) => g.tareas.some((t) => t.vencida) ? 0 : 1;
  return [...grupos.values()].sort((a, b) => conVencidas(a) - conVencidas(b)
    || a.evento.fecha_evento_confirmada.localeCompare(b.evento.fecha_evento_confirmada));
}

export default function MisTareasEmpleado() {
  const { usuario } = useSesion();
  const [filtro, setFiltro] = useState("todas");
  const consulta = useConsulta(useCallback(async () => (await misTareas(
    filtro === "vencidas" ? { vencidas: true } : filtro === "todas" ? {} : { estado_tarea: filtro })).data, [filtro]));
  const grupos = agruparPorEvento(consulta.datos || []);
  // El aviso de vencidas solo tiene sentido mirando todas las tareas
  const vencidas = filtro === "todas" ? (consulta.datos || []).filter((t) => t.vencida).length : 0;
  return <>
    <EncabezadoPagina titulo="Mis tareas" descripcion={`Hola, ${usuario.nombre.split(" ")[0]}.${vencidas ? ` Tenés ${vencidas} ${vencidas === 1 ? "tarea vencida" : "tareas vencidas"}.` : ""}`} />
    {/* Sin ancho fijo: en el celular se desliza en lugar de cortar los textos */}
    <div className="filtro-tareas"><Segmented options={FILTROS} value={filtro} onChange={setFiltro} aria-label="Filtrar por estado" /></div>
    <ErrorConsulta {...consulta} />
    {consulta.cargando && <Card loading />}
    {!consulta.cargando && !consulta.error && grupos.length === 0 && <Card><Empty
      description={filtro === "todas" ? "No tenés tareas en eventos abiertos." : "No hay tareas con este filtro."} /></Card>}
    {!consulta.cargando && grupos.map(({ evento, tareas, servicios }) => <Card key={evento.id_evento} className="evento-empleado"
      title={<div className="evento-titulo">
        <Typography.Text strong ellipsis>{evento.nombre_cliente}</Typography.Text>
        <Typography.Text type="secondary" className="evento-tipo">{evento.nombre_tipo_evento}</Typography.Text>
      </div>} extra={<EstadoTag estado={evento.estado} />}>
      <div className="evento-datos">
        <span><CalendarOutlined /> {formatearFecha(evento.fecha_evento_confirmada)}</span>
        {evento.sede_acordada && <span><EnvironmentOutlined /> {evento.sede_acordada}</span>}
        {evento.nombre_coordinador && <span><UserOutlined /> Coordina {evento.nombre_coordinador}</span>}
        <Link to={`/mis-eventos/${evento.id_evento}`}>Ver el evento completo</Link>
      </div>
      {tareas.map((tarea) => <Tarea key={tarea.id_tarea} tarea={tarea} actualizar={consulta.recargar} />)}
      {servicios.size > 0 && <>
        <Typography.Title level={5} className="titulo-proveedores">{servicios.size === 1 ? "Proveedor" : "Proveedores"}</Typography.Title>
        {[...servicios.values()].map((servicio) => <Proveedor key={servicio.id_servicio_x_evento} servicio={servicio} actualizar={consulta.recargar} />)}
      </>}
    </Card>)}
  </>;
}
