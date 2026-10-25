import { useCallback, useState } from "react";
import { Alert, Button, Card, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { serviciosEvento, estadoProveedor, modificarServicio, cambiarProveedor, cancelarServicio, agregarServicio,
  generarTareas } from "../servicios/operacionService.js";
import { listarCatalogo } from "../servicios/catalogosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { nombreCompleto, fechaAPI } from "../utils/formularios.js";
import { formatearFecha, formatearMoneda } from "../utils/formato.js";
import { ESTADOS_PROVEEDOR, PASOS_PROVEEDOR } from "../utils/estados.js";
import EstadoTag from "./EstadoTag";
import ErrorConsulta from "./ErrorConsulta";
import ModalCambio from "./ModalCambio";
import "./Cambios.css";

// Fase 11. Dos clases de acciones sobre un servicio:
// - el seguimiento del proveedor (el Select de estado): sin motivo, no es un
//   cambio del acuerdo;
// - los cambios de lo acordado (modificar, proveedor, cancelar, agregar): con
//   motivo y tareas afectadas, quedan en el historial.

function SelectProveedor({ idServicio, actual }) {
  const proveedores = useConsulta(useCallback(async () => (await listarCatalogo("proveedores", { id_servicio: idServicio, activo: true })).data, [idServicio]));
  return <Form.Item name="id_proveedor" label="Proveedor" extra={actual ? `Actual: ${actual}. El nuevo arranca pendiente.` : "El proveedor arranca pendiente."}>
    <Select allowClear showSearch optionFilterProp="label" loading={proveedores.cargando} placeholder="Sin proveedor"
      options={(proveedores.datos || []).map((p) => ({ value: p.id_proveedor, label: p.razon_social }))} />
  </Form.Item>;
}

const camposImportes = <>
  <Form.Item name="cantidad" label="Cantidad" rules={[{ required: true }, { type: "number", min: 1, message: "Mayor a 0." }]}><InputNumber min={1} precision={0} /></Form.Item>
  <Form.Item name="costo_acordado_proveedor" label="Costo acordado con el proveedor" rules={[{ required: true }, { type: "number", min: 0 }]}><InputNumber min={0} precision={2} prefix="$" /></Form.Item>
  <Form.Item name="importe_acordado_cliente" label="Importe acordado con el cliente" rules={[{ required: true }, { type: "number", min: 0 }]}><InputNumber min={0} precision={2} prefix="$" /></Form.Item>
</>;

// Solo se mandan los campos que cambiaron: la API compara y registra cada uno
function cambiosDe(servicio, v) {
  const body = {};
  if ((v.descripcion?.trim() || null) !== (servicio.descripcion || null)) body.descripcion = v.descripcion?.trim() || null;
  for (const campo of ["cantidad", "costo_acordado_proveedor", "importe_acordado_cliente"]) if (v[campo] !== servicio[campo]) body[campo] = v[campo];
  return body;
}

function AgregarServicio({ idEvento, cerrar, guardado }) {
  const servicios = useConsulta(useCallback(async () => (await listarCatalogo("servicios", { activo: true })).data, []));
  const [idServicio, setIdServicio] = useState(null);
  return <ModalCambio titulo="Agregar servicio" idEvento={idEvento} cerrar={cerrar} guardado={guardado} okText="Agregar"
    valoresIniciales={{ cantidad: 1, costo_acordado_proveedor: 0 }}
    aviso="Nace con el proveedor pendiente, así que ya aparece como “sin confirmar”."
    operacion={(v) => agregarServicio(idEvento, { id_servicio: v.id_servicio, id_proveedor: v.id_proveedor ?? null, descripcion: v.descripcion?.trim() || null,
      cantidad: v.cantidad, costo_acordado_proveedor: v.costo_acordado_proveedor, importe_acordado_cliente: v.importe_acordado_cliente,
      motivo: v.motivo, tareas_afectadas: v.tareas_afectadas })}>
    <ErrorConsulta {...servicios} />
    <Form.Item name="id_servicio" label="Servicio" rules={[{ required: true, message: "Elegí el servicio." }]}>
      <Select showSearch optionFilterProp="label" loading={servicios.cargando} onChange={setIdServicio}
        options={(servicios.datos || []).map((s) => ({ value: s.id_servicio, label: s.nombre }))} /></Form.Item>
    {idServicio && <SelectProveedor key={idServicio} idServicio={idServicio} />}
    <Form.Item name="descripcion" label="Descripción"><Input maxLength={300} /></Form.Item>
    {camposImportes}
  </ModalCambio>;
}

// Elegir qué pasos crear. Sin secuencia: los que hagan falta, en cualquier
// orden de fechas. Los que ya tienen tarea no se ofrecen.
function GenerarPasos({ servicio, cerrar, guardado }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  const empleados = useConsulta(useCallback(async () => (await listarCatalogo("empleados", { activo: true })).data, []));
  const faltan = PASOS_PROVEEDOR.filter((p) => !servicio.tipos_generados.includes(p.id_tipo_tarea));
  const elegidos = Form.useWatch("pasos", form) || [];
  return <Modal open title={`Pasos con el proveedor · ${servicio.nombre_servicio}`} okText="Crear tareas" cancelText="Cancelar" destroyOnHidden
    confirmLoading={ocupado} onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()}>
    <ErrorConsulta {...empleados} />
    <Alert type="info" showIcon className="aviso-formulario" title="Los pasos son una guía: se completan en cualquier orden." />
    <Form form={form} layout="vertical" disabled={ocupado} onFinish={async (v) => {
      const r = await ejecutar(() => generarTareas(servicio.id_servicio_x_evento, { id_empleado_responsable: v.id_empleado_responsable,
        pasos: v.pasos.map((id) => ({ id_tipo_tarea: id, fecha_prevista: fechaAPI(v.fechas[id]) })) }), "Tareas creadas.");
      if (r.ok) { cerrar(); guardado(); }
    }}>
      <Form.Item name="id_empleado_responsable" label="Responsable" rules={[{ required: true, message: "Elegí el responsable." }]}>
        <Select showSearch optionFilterProp="label" loading={empleados.cargando} options={(empleados.datos || []).map((e) => ({ value: e.id_empleado, label: nombreCompleto(e) }))} /></Form.Item>
      <Form.Item name="pasos" label="Pasos" rules={[{ required: true, message: "Elegí al menos un paso." }]}>
        <Checkbox.Group className="lista-tareas-afectadas" options={faltan.map((p) => ({ value: p.id_tipo_tarea, label: p.nombre }))} /></Form.Item>
      {faltan.filter((p) => elegidos.includes(p.id_tipo_tarea)).map((p) => <div className="paso-generar" key={p.id_tipo_tarea}>
        <span>{p.nombre}</span>
        <Form.Item name={["fechas", p.id_tipo_tarea]} noStyle rules={[{ required: true, message: "Fecha" }]}>
          <DatePicker format="DD/MM/YYYY" placeholder="Fecha prevista" aria-label={`Fecha de ${p.nombre}`} /></Form.Item>
      </div>)}
    </Form>
  </Modal>;
}

function EstadoProveedor({ servicio, editable, actualizado }) {
  const { ocupado, ejecutar } = useAccion();
  if (!editable || servicio.estado_servicio === "cancelado") return <EstadoTag estado={servicio.estado_proveedor} />;
  return <Select value={servicio.estado_proveedor} className="selector-estado" disabled={ocupado} aria-label={`Estado del proveedor de ${servicio.nombre_servicio}`}
    options={ESTADOS_PROVEEDOR.map((value) => ({ value, label: <EstadoTag estado={value} />,
      disabled: !servicio.id_proveedor && ["confirmado", "completado"].includes(value) }))}
    onChange={async (estado) => { const r = await ejecutar(() => estadoProveedor(servicio.id_servicio_x_evento, { estado_proveedor: estado }), "Estado del proveedor actualizado."); if (r.ok) actualizado(); }} />;
}

export default function ServiciosEvento({ id, editable, actualizado }) {
  const consulta = useConsulta(useCallback(async () => (await serviciosEvento(id)).data, [id]));
  const [accion, setAccion] = useState(null);
  const recargar = () => { consulta.recargar(); actualizado?.(); };
  const cerrar = () => setAccion(null);
  const columnas = [
    { title: "Servicio", dataIndex: "nombre_servicio", render: (v, s) => <div className="servicio-nombre"><span>{v}</span>
      {s.descripcion && <span className="texto-secundario">{s.descripcion}</span>}
      <Space size={4} wrap>{s.estado_servicio === "cancelado" && <EstadoTag estado="cancelado" />}
        {s.a_revisar && <Tag color="orange">A revisar ({s.pendientes_revision})</Tag>}</Space></div> },
    { title: "Proveedor", dataIndex: "nombre_proveedor", render: (v) => v || "Sin asignar" },
    { title: "Estado proveedor", dataIndex: "estado_proveedor", render: (_, s) => <EstadoProveedor servicio={s} editable={editable} actualizado={recargar} /> },
    { title: "Confirmación", dataIndex: "fecha_confirmacion_proveedor", render: formatearFecha },
    { title: "Cantidad", dataIndex: "cantidad" },
    { title: "Costo", dataIndex: "costo_acordado_proveedor", render: formatearMoneda },
    { title: "Importe cliente", dataIndex: "importe_acordado_cliente", render: formatearMoneda }
  ];
  if (editable) columnas.push({ title: "Acciones", key: "acciones", render: (_, s) => s.estado_servicio === "cancelado" ? null : <Space wrap>
    <Button size="small" onClick={() => setAccion({ tipo: "modificar", servicio: s })}>Modificar</Button>
    <Button size="small" onClick={() => setAccion({ tipo: "proveedor", servicio: s })}>{s.id_proveedor ? "Cambiar proveedor" : "Asignar proveedor"}</Button>
    <Button size="small" disabled={s.tipos_generados.length === PASOS_PROVEEDOR.length} onClick={() => setAccion({ tipo: "pasos", servicio: s })}>Pasos</Button>
    <Button size="small" danger onClick={() => setAccion({ tipo: "cancelar", servicio: s })}>Cancelar</Button>
  </Space> });
  const s = accion?.servicio;
  return <><ErrorConsulta {...consulta} />
    <Alert type="info" showIcon className="aviso-formulario" title="El estado del proveedor es seguimiento: se cambia sin motivo. Modificar lo acordado, cambiar el proveedor o cancelar queda en el historial con su motivo." />
    <Card extra={editable && <Button type="primary" icon={<PlusOutlined />} onClick={() => setAccion({ tipo: "agregar" })}>Agregar servicio</Button>}>
      <Table rowKey="id_servicio_x_evento" dataSource={consulta.datos || []} loading={consulta.cargando} columns={columnas} scroll={{ x: 1100 }}
        pagination={false} rowClassName={(fila) => fila.estado_servicio === "cancelado" ? "servicio-cancelado" : ""} /></Card>
    {accion?.tipo === "agregar" && <AgregarServicio idEvento={id} cerrar={cerrar} guardado={recargar} />}
    {accion?.tipo === "pasos" && <GenerarPasos servicio={s} cerrar={cerrar} guardado={recargar} />}
    {accion?.tipo === "modificar" && <ModalCambio titulo={`Modificar lo acordado · ${s.nombre_servicio}`} idEvento={id} cerrar={cerrar} guardado={recargar}
      valoresIniciales={s} aviso="El servicio va a quedar a revisar."
      operacion={(v) => modificarServicio(s.id_servicio_x_evento, { ...cambiosDe(s, v), motivo: v.motivo, tareas_afectadas: v.tareas_afectadas })}>
      <Form.Item name="descripcion" label="Descripción"><Input maxLength={300} /></Form.Item>{camposImportes}
    </ModalCambio>}
    {accion?.tipo === "proveedor" && <ModalCambio titulo={`Proveedor · ${s.nombre_servicio}`} idEvento={id} cerrar={cerrar} guardado={recargar}
      valoresIniciales={{ id_proveedor: s.id_proveedor }} motivoObligatorio={Boolean(s.id_proveedor)}
      ayudaMotivo={s.id_proveedor ? "Queda en el historial quién estuvo a cargo." : "Opcional en la primera asignación."}
      operacion={(v) => cambiarProveedor(s.id_servicio_x_evento, { id_proveedor: v.id_proveedor ?? null, motivo: v.motivo, tareas_afectadas: v.tareas_afectadas })}>
      <SelectProveedor idServicio={s.id_servicio} actual={s.nombre_proveedor} />
    </ModalCambio>}
    {accion?.tipo === "cancelar" && <ModalCambio titulo={`Cancelar ${s.nombre_servicio}`} idEvento={id} cerrar={cerrar} guardado={recargar} okText="Cancelar servicio"
      aviso="El servicio no se borra: sigue a la vista y en el historial. Sus tareas no se cancelan solas; marcá las que haya que revisar."
      operacion={(v) => cancelarServicio(s.id_servicio_x_evento, { motivo: v.motivo, tareas_afectadas: v.tareas_afectadas })} />}
  </>;
}
