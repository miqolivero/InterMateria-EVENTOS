import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Steps, Table, Tag } from "antd";
import dayjs from "dayjs";
import { tareasEvento, crearTarea, editarTarea, cambiarEstadoTarea, eliminarTarea, misTareas, serviciosEvento } from "../servicios/operacionService.js";
import { listarCatalogo } from "../servicios/catalogosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { useSesion } from "../contexto/useSesion.js";
import { fechaAPI, nombreCompleto, opcionesActivos } from "../utils/formularios.js";
import { formatearFecha } from "../utils/formato.js";
import { puedeCambiarTarea } from "../utils/tareas.js";
import EstadoTag from "./EstadoTag";
import ErrorConsulta from "./ErrorConsulta";
import EncabezadoPagina from "./EncabezadoPagina";

function EditorTarea({ id, datos, cerrar, guardado }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  const catalogos = useConsulta(useCallback(async () => {
    const [empleados, servicios] = await Promise.all([listarCatalogo("empleados"), serviciosEvento(id)]);
    return { empleados: empleados.data, servicios: servicios.data };
  }, [id]));
  useEffect(() => { form.setFieldsValue({ ...datos, fecha_prevista: datos.fecha_prevista ? dayjs(datos.fecha_prevista) : null }); }, [datos, form]);
  return <Modal open title={datos.id_tarea ? "Editar tarea" : "Nueva tarea interna"} onCancel={ocupado ? undefined : cerrar} okText="Guardar" cancelText="Cancelar"
    confirmLoading={ocupado} onOk={() => form.submit()} okButtonProps={{ disabled: catalogos.cargando || Boolean(catalogos.error) }}>
    <ErrorConsulta {...catalogos} />
    <Form form={form} layout="vertical" disabled={ocupado || catalogos.cargando || Boolean(catalogos.error)} onFinish={async (v) => {
      const body = { descripcion: v.descripcion.trim(), id_empleado_responsable: v.id_empleado_responsable,
        fecha_prevista: fechaAPI(v.fecha_prevista), observaciones: v.observaciones || null };
      const respuesta = await ejecutar(() => datos.id_tarea ? editarTarea(datos.id_tarea, body) : crearTarea(id, { ...body, id_servicio_x_evento: v.id_servicio_x_evento ?? null }));
      if (respuesta.ok) { cerrar(); guardado(); }
    }}>
      <Form.Item name="descripcion" label="Descripción" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={3} /></Form.Item>
      <Form.Item name="id_empleado_responsable" label="Responsable" rules={[{ required: true }]}><Select showSearch optionFilterProp="label"
        options={opcionesActivos(catalogos.datos?.empleados, "id_empleado", nombreCompleto, datos.id_empleado_responsable)} /></Form.Item>
      <Form.Item name="fecha_prevista" label="Fecha prevista" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" /></Form.Item>
      {!datos.id_tarea && <Form.Item name="id_servicio_x_evento" label="Servicio del evento (opcional)"><Select allowClear
        options={(catalogos.datos?.servicios || []).map((s) => ({ value: s.id_servicio_x_evento, label: s.nombre_servicio }))} /></Form.Item>}
      <Form.Item name="observaciones" label="Observaciones"><Input.TextArea rows={2} /></Form.Item>
    </Form>
  </Modal>;
}

export function TablaTareas({ tareas, editable, actualizar, editar, solicitarCambio, mostrarEvento = false, secuenciaCompleta = tareas }) {
  const { ocupado, ejecutar } = useAccion();
  return <Table rowKey="id_tarea" dataSource={tareas} pagination={false} scroll={{ x: 850 }} columns={[
    { title: "Tarea", dataIndex: "descripcion", render: (v, tarea) => <Space orientation="vertical" size={4}><span>{v}</span>{tarea.vencida && <Tag color="red">Vencida</Tag>}</Space> },
    ...(mostrarEvento ? [{ title: "Evento", key: "evento", render: (_, t) => <Link to={`/eventos/${t.id_evento}`}>{t.nombre_cliente || `Evento #${t.id_evento}`}</Link> }] : []),
    { title: "Responsable", dataIndex: "nombre_responsable", render: (v) => v || "Sin asignar" },
    { title: "Fecha prevista", dataIndex: "fecha_prevista", render: formatearFecha },
    { title: "Finalización", dataIndex: "fecha_finalizacion", render: formatearFecha },
    { title: "Estado", dataIndex: "estado_tarea", render: (valor, tarea) => editable ? <Select value={valor} style={{ width: 150 }} disabled={ocupado}
      aria-label={`Estado de ${tarea.descripcion}`} options={["pendiente", "en_curso", "completada"].map((estado) => ({ value: estado,
        label: <EstadoTag estado={estado} />, disabled: estado !== valor && !puedeCambiarTarea(tarea, estado, secuenciaCompleta) }))}
      onChange={async (estado) => { const resultado = await ejecutar(() => cambiarEstadoTarea(tarea.id_tarea, estado)); if (resultado.ok) actualizar(); }} /> : <EstadoTag estado={valor} /> },
    ...(solicitarCambio ? [{ title: "Acciones", key: "cambiar", render: (_, t) => <Button size="small" onClick={() => solicitarCambio(t)}>Cambiar estado</Button> }] : []),
    ...(editable && editar ? [{ title: "Acciones", key: "acciones", render: (_, t) => <Space><Button size="small" disabled={ocupado} onClick={() => editar(t)}>Editar</Button>
      {!t.id_tipo_tarea && <Popconfirm title="¿Eliminar tarea interna?" okText="Eliminar" cancelText="Volver" onConfirm={async () => {
        const respuesta = await ejecutar(() => eliminarTarea(t.id_tarea)); if (respuesta.ok) actualizar();
      }}><Button size="small" danger disabled={ocupado}>Eliminar</Button></Popconfirm>}
    </Space> }] : [])
  ]} />;
}

export default function TareasEvento({ id, editable }) {
  const consulta = useConsulta(useCallback(async () => (await tareasEvento(id)).data, [id]));
  const [editor, setEditor] = useState(null);
  const [estado, setEstado] = useState(null);
  const [vencidas, setVencidas] = useState(false);
  const tareas = consulta.datos || [];
  const grupos = [...new Set(tareas.filter((t) => t.id_tipo_tarea).map((t) => t.id_servicio_x_evento))];
  const filtrar = (lista) => lista.filter((t) => (!estado || t.estado_tarea === estado) && (!vencidas || t.vencida));
  return <>
    <div className="barra-tabla"><Space wrap>
      <Select placeholder="Todos los estados" allowClear value={estado} onChange={setEstado} style={{ width: 180 }} options={["pendiente", "en_curso", "completada"].map((value) => ({ value, label: <EstadoTag estado={value} /> }))} />
      <Button type={vencidas ? "primary" : "default"} onClick={() => setVencidas(!vencidas)}>Solo vencidas</Button>
    </Space>{editable && <Button type="primary" onClick={() => setEditor({})}>Nueva tarea interna</Button>}</div>
    <ErrorConsulta {...consulta} />
    {consulta.cargando && <Card loading />}
    {!consulta.cargando && !consulta.error && grupos.map((servicio) => {
      const grupo = tareas.filter((t) => t.id_servicio_x_evento === servicio && t.id_tipo_tarea).sort((a, b) => a.orden - b.orden);
      const visibles = filtrar(grupo);
      if (!visibles.length) return null;
      // Sin `current`, antd marca siempre el paso 1 como el actual aunque ya
      // este completo. El actual es el primero sin completar (o el ultimo si
      // la secuencia termino).
      const primeroAbierto = grupo.findIndex((t) => t.estado_tarea !== "completada");
      const pasoActual = primeroAbierto === -1 ? grupo.length - 1 : primeroAbierto;
      return <Card key={servicio} title={`${grupo[0].nombre_servicio} · ${grupo[0].nombre_proveedor || "Sin proveedor"}`} style={{ marginBottom: 20 }}>
        <Steps size="small" responsive current={pasoActual} style={{ marginBottom: 24 }} items={grupo.map((t) => ({ title: t.nombre_tipo_tarea || `Paso ${t.orden}`,
          status: t.estado_tarea === "completada" ? "finish" : t.estado_tarea === "en_curso" ? "process" : "wait" }))} />
        <TablaTareas tareas={visibles} secuenciaCompleta={grupo} editable={editable} editar={setEditor} actualizar={consulta.recargar} />
      </Card>;
    })}
    {!consulta.cargando && !consulta.error && <Card title="Tareas internas">
      <TablaTareas tareas={filtrar(tareas.filter((t) => !t.id_tipo_tarea))} editable={editable} editar={setEditor} actualizar={consulta.recargar} />
    </Card>}
    {editor !== null && <EditorTarea id={id} datos={editor} cerrar={() => setEditor(null)} guardado={consulta.recargar} />}
  </>;
}

export function MisTareas() {
  const { usuario } = useSesion();
  const [estado, setEstado] = useState(null);
  const [seleccion, setSeleccion] = useState(null);
  const consulta = useConsulta(useCallback(async () => (await misTareas(estado ? { estado_tarea: estado } : {})).data, [estado]));
  return <><EncabezadoPagina titulo="Mis tareas" />
    {!usuario.id_empleado && <Alert title="Tu cuenta no está vinculada a un empleado." type="info" className="aviso-formulario" />}
    <ErrorConsulta {...consulta} />
    <Card loading={consulta.cargando}><Select placeholder="Todos los estados" allowClear onChange={setEstado} style={{ width: 180, marginBottom: 20 }}
      options={["pendiente", "en_curso", "completada"].map((value) => ({ value, label: <EstadoTag estado={value} /> }))} />
      <TablaTareas tareas={consulta.datos || []} mostrarEvento editable={false} solicitarCambio={setSeleccion} />
    </Card>
    {seleccion && <CambioEstado tarea={seleccion} cerrar={() => setSeleccion(null)} actualizado={consulta.recargar} />}
  </>;
}

function CambioEstado({ tarea, cerrar, actualizado }) {
  // Los pasos previos pueden pertenecer a otro empleado. Se consulta la secuencia
  // completa antes de ofrecer estados, en lugar de inferirla de "Mis tareas".
  const consulta = useConsulta(useCallback(async () => (await tareasEvento(tarea.id_evento)).data, [tarea.id_evento]));
  const actual = consulta.datos?.find((t) => t.id_tarea === tarea.id_tarea);
  return <Modal open title="Cambiar estado de tarea" footer={null} onCancel={cerrar} width={950}>
    <ErrorConsulta {...consulta} />
    {consulta.cargando && <Card loading />}
    {actual && <TablaTareas tareas={[actual]} editable secuenciaCompleta={consulta.datos}
      actualizar={() => { actualizado(); cerrar(); }} />}
    {!consulta.cargando && !consulta.error && !actual && <Alert type="info" title="La tarea ya no está disponible." />}
  </Modal>;
}
