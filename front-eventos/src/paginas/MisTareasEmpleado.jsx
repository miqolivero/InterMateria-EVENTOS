import { useCallback, useEffect, useState } from "react";
import { Button, Card, Empty, Form, Input, Segmented, Select, Space, Steps, Tag, Tooltip, Typography } from "antd";
import { CalendarOutlined, EnvironmentOutlined, MailOutlined, PhoneOutlined, UserOutlined } from "@ant-design/icons";
import { cambiarEstadoTarea, editarServicioEvento, misTareas } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { useSesion } from "../contexto/useSesion.js";
import { formatearFecha } from "../utils/formato.js";
import { estados } from "../utils/estados.js";
import EstadoTag from "../componentes/EstadoTag";
import ErrorConsulta from "../componentes/ErrorConsulta";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import "./MisTareasEmpleado.css";

// Panel de trabajo del rol empleado (Fase 10), pensado para el celular.
// Todo sale de GET /tareas/mias, que ya trae el evento, el proveedor y los
// pasos de cada tarea: el empleado no tiene acceso a la pantalla del evento.
// Ninguna parte muestra importes: la API no los manda.

const FILTROS = [
  { value: "todas", label: "Todas" },
  { value: "vencidas", label: "Vencidas" },
  { value: "pendiente", label: "Pendientes" },
  { value: "en_curso", label: "En curso" },
  { value: "completada", label: "Completadas" }
];

const ESTADOS_PROVEEDOR = ["solicitada", "confirmada", "en_seguimiento", "finalizada", "rechazada"];

// El estado siguiente de una tarea y el texto de su botón
const SIGUIENTE = { pendiente: ["en_curso", "Empezar"], en_curso: ["completada", "Completar"] };
const ANTERIOR = { en_curso: "pendiente", completada: "en_curso" };

const estadoDelPaso = (estado) => estado === "completada" ? "finish" : estado === "en_curso" ? "process" : "wait";

function Tarea({ tarea, actualizar }) {
  const { ocupado, ejecutar } = useAccion();
  const siguiente = SIGUIENTE[tarea.estado_tarea];
  const pasos = tarea.servicio?.pasos || [];
  const cambiar = async (estado, exito) => {
    const r = await ejecutar(() => cambiarEstadoTarea(tarea.id_tarea, estado), exito);
    if (r.ok) actualizar();
  };
  const boton = siguiente && <Button type="primary" block loading={ocupado} disabled={!tarea.puede_avanzar}
    onClick={() => cambiar(siguiente[0], siguiente[0] === "completada" ? "Tarea completada." : "Tarea en curso.")}>{siguiente[1]}</Button>;
  return <div className={`tarea-empleado${tarea.vencida ? " tarea-vencida" : ""}`}>
    <div className="tarea-cabecera">
      <Typography.Text strong className="tarea-descripcion">{tarea.descripcion}</Typography.Text>
      <Space size={4} wrap>{tarea.vencida && <Tag color="red">Vencida</Tag>}<EstadoTag estado={tarea.estado_tarea} /></Space>
    </div>
    <Typography.Text type={tarea.vencida ? "danger" : "secondary"} className="tarea-fecha">
      <CalendarOutlined /> Para el {formatearFecha(tarea.fecha_prevista)}
      {tarea.fecha_finalizacion && ` · completada el ${formatearFecha(tarea.fecha_finalizacion)}`}
    </Typography.Text>
    {tarea.servicio && <Typography.Text type="secondary" className="tarea-servicio">
      {tarea.servicio.nombre_servicio}{tarea.servicio.proveedor ? ` · ${tarea.servicio.proveedor.razon_social}` : ""}</Typography.Text>}
    {tarea.observaciones && <Typography.Paragraph className="tarea-observaciones">{tarea.observaciones}</Typography.Paragraph>}
    {pasos.length > 0 && <Steps type="dot" size="small" className="tarea-pasos" responsive={false}
      current={Math.max(0, pasos.findIndex((p) => p.orden === tarea.orden))}
      items={pasos.map((p) => ({ title: p.nombre_tipo_tarea, status: estadoDelPaso(p.estado_tarea) }))} />}
    <div className="tarea-acciones">
      {boton && (tarea.puede_avanzar ? boton
        : <Tooltip title="Primero hay que completar el paso anterior de la secuencia, aunque sea de otra persona.">
          <span className="envoltorio-deshabilitado">{boton}</span></Tooltip>)}
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
  useEffect(() => { form.setFieldsValue({ estado_proveedor: servicio.estado_proveedor, observaciones: servicio.observaciones || "" }); }, [servicio, form]);
  return <div className="bloque-proveedor">
    <div className="tarea-cabecera">
      <Typography.Text strong>{servicio.nombre_servicio}</Typography.Text>
      <EstadoTag estado={servicio.estado_proveedor} />
    </div>
    {proveedor ? <div className="contacto-proveedor">
      <Typography.Text><UserOutlined /> {proveedor.razon_social}</Typography.Text>
      {proveedor.telefono && <a href={`tel:${proveedor.telefono}`}><PhoneOutlined /> {proveedor.telefono}</a>}
      {proveedor.email && <a href={`mailto:${proveedor.email}`}><MailOutlined /> {proveedor.email}</a>}
    </div> : <Typography.Text type="secondary">Sin proveedor asignado: lo resuelve el personal propio.</Typography.Text>}
    <Form form={form} layout="vertical" disabled={ocupado} className="formulario-proveedor" onFinish={async (v) => {
      const r = await ejecutar(() => editarServicioEvento(servicio.id_servicio_x_evento,
        { estado_proveedor: v.estado_proveedor, observaciones: v.observaciones?.trim() || null }), "Proveedor actualizado.");
      if (r.ok) actualizar();
    }}>
      <Form.Item name="estado_proveedor" label="Estado del proveedor">
        <Select options={ESTADOS_PROVEEDOR.map((e) => ({ value: e, label: estados[e].texto }))} />
      </Form.Item>
      <Form.Item name="observaciones" label="Observaciones">
        <Input.TextArea rows={2} maxLength={2000} placeholder="Por ejemplo: confirmó que llega a las 18 h" />
      </Form.Item>
      <Button htmlType="submit" block loading={ocupado}>Guardar proveedor</Button>
    </Form>
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
      </div>
      {tareas.map((tarea) => <Tarea key={tarea.id_tarea} tarea={tarea} actualizar={consulta.recargar} />)}
      {servicios.size > 0 && <>
        <Typography.Title level={5} className="titulo-proveedores">{servicios.size === 1 ? "Proveedor" : "Proveedores"}</Typography.Title>
        {[...servicios.values()].map((servicio) => <Proveedor key={servicio.id_servicio_x_evento} servicio={servicio} actualizar={consulta.recargar} />)}
      </>}
    </Card>)}
  </>;
}
