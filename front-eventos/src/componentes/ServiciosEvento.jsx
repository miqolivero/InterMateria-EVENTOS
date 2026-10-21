import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table } from "antd";
import { serviciosEvento, editarServicioEvento, generarTareas } from "../servicios/operacionService.js";
import { listarCatalogo } from "../servicios/catalogosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { nombreCompleto, fechaAPI } from "../utils/formularios.js";
import { formatearFecha, formatearMoneda } from "../utils/formato.js";
import EstadoTag from "./EstadoTag";
import ErrorConsulta from "./ErrorConsulta";

function EditorServicio({ servicio, cerrar, guardado }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  const proveedores = useConsulta(useCallback(async () => (await listarCatalogo("proveedores", { id_servicio: servicio.id_servicio, activo: true })).data, [servicio.id_servicio]));
  useEffect(() => { form.setFieldsValue(servicio); }, [servicio, form]);
  return <Modal open title={servicio.nombre_servicio} onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()}
    okText="Guardar" cancelText="Cancelar" confirmLoading={ocupado} okButtonProps={{ disabled: proveedores.cargando || Boolean(proveedores.error) }}>
    <ErrorConsulta {...proveedores} />
    <Form form={form} layout="vertical" disabled={ocupado} onFinish={async (v) => {
      const respuesta = await ejecutar(() => editarServicioEvento(servicio.id_servicio_x_evento, {
        estado_proveedor: v.estado_proveedor, id_proveedor: v.id_proveedor ?? null, costo_acordado_proveedor: v.costo_acordado_proveedor,
        importe_acordado_cliente: v.importe_acordado_cliente, observaciones: v.observaciones || null
      })); if (respuesta.ok) { cerrar(); guardado(); }
    }}>
      <Form.Item name="id_proveedor" label="Proveedor"><Select allowClear showSearch optionFilterProp="label" loading={proveedores.cargando}
        options={(proveedores.datos || []).map((p) => ({ value: p.id_proveedor, label: p.razon_social }))} /></Form.Item>
      <Form.Item name="estado_proveedor" label="Estado del proveedor" rules={[{ required: true }]}><Select options={["solicitada", "confirmada", "en_seguimiento", "finalizada", "rechazada"].map((value) => ({ value, label: <EstadoTag estado={value} /> }))} /></Form.Item>
      <Form.Item name="costo_acordado_proveedor" label="Costo acordado" rules={[{ required: true }, { type: "number", min: 0 }]}><InputNumber min={0} precision={2} prefix="$" /></Form.Item>
      <Form.Item name="importe_acordado_cliente" label="Importe acordado al cliente" rules={[{ required: true }, { type: "number", min: 0 }]}><InputNumber min={0} precision={2} prefix="$" /></Form.Item>
      <Form.Item name="observaciones" label="Observaciones"><Input.TextArea rows={3} /></Form.Item>
    </Form>
  </Modal>;
}

function GeneradorTareas({ servicio, cerrar, guardado }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  const empleados = useConsulta(useCallback(async () => (await listarCatalogo("empleados", { activo: true })).data, []));
  const pasos = ["Contacto y solicitud", "Confirmación de asistencia", "Seguimiento del estado", "Confirmación de finalización"];
  return <Modal open title={`Generar tareas · ${servicio.nombre_servicio}`} onCancel={ocupado ? undefined : cerrar} okText="Generar" cancelText="Cancelar"
    confirmLoading={ocupado} onOk={() => form.submit()} okButtonProps={{ disabled: empleados.cargando || Boolean(empleados.error) }}>
    <ErrorConsulta {...empleados} />
    <Form form={form} layout="vertical" disabled={ocupado} onFinish={async (v) => {
      const respuesta = await ejecutar(() => generarTareas(servicio.id_servicio_x_evento, { id_empleado_responsable: v.id_empleado_responsable, fechas: v.fechas.map(fechaAPI) }));
      if (respuesta.ok) { cerrar(); guardado(); }
    }}>
      <Form.Item name="id_empleado_responsable" label="Responsable interno" rules={[{ required: true }]}><Select showSearch optionFilterProp="label"
        options={(empleados.datos || []).map((e) => ({ value: e.id_empleado, label: nombreCompleto(e) }))} /></Form.Item>
      {pasos.map((paso, indice) => <Form.Item key={paso} name={["fechas", indice]} label={`${indice + 1}. ${paso}`} dependencies={indice ? [["fechas", indice - 1]] : []}
        rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, valor) => {
          const anterior = indice ? getFieldValue(["fechas", indice - 1]) : null;
          return valor && anterior && valor.isBefore(anterior, "day") ? Promise.reject(new Error("La fecha no puede ser anterior al paso previo.")) : Promise.resolve();
        } })]}><DatePicker format="DD/MM/YYYY" /></Form.Item>)}
    </Form>
  </Modal>;
}

export default function ServiciosEvento({ id, editable, actualizado }) {
  const consulta = useConsulta(useCallback(async () => (await serviciosEvento(id)).data, [id]));
  const [editor, setEditor] = useState(null);
  const [generar, setGenerar] = useState(null);
  const columnas = [
    { title: "Servicio", dataIndex: "nombre_servicio" }, { title: "Proveedor", dataIndex: "nombre_proveedor", render: (v) => v || "Sin asignar" },
    { title: "Estado proveedor", dataIndex: "estado_proveedor", render: (v) => <EstadoTag estado={v} /> },
    { title: "Confirmación", dataIndex: "fecha_confirmacion_proveedor", render: formatearFecha },
    { title: "Costo", dataIndex: "costo_acordado_proveedor", render: formatearMoneda },
    { title: "Importe cliente", dataIndex: "importe_acordado_cliente", render: formatearMoneda }
  ];
  if (editable) columnas.push({ title: "Acciones", key: "acciones", render: (_, s) => <Space wrap>
    <Button size="small" onClick={() => setEditor(s)}>Editar</Button>
    <Button size="small" disabled={s.tareas_generadas} onClick={() => setGenerar(s)}>{s.tareas_generadas ? "Tareas generadas" : "Generar tareas"}</Button>
  </Space> });
  return <><ErrorConsulta {...consulta} /><Alert type="info" title="El estado del proveedor se actualiza por separado de las tareas internas." className="aviso-formulario" />
    <Card><Table rowKey="id_servicio_x_evento" dataSource={consulta.datos || []} loading={consulta.cargando} columns={columnas} scroll={{ x: 1000 }} /></Card>
    {editor && <EditorServicio servicio={editor} cerrar={() => setEditor(null)} guardado={actualizado} />}
    {generar && <GeneradorTareas servicio={generar} cerrar={() => setGenerar(null)} guardado={actualizado} />}
  </>;
}
