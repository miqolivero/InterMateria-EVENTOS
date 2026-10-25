import { useCallback, useEffect } from "react";
import { DatePicker, Form, Input, InputNumber, Modal, Select } from "antd";
import dayjs from "dayjs";
import { listarCatalogo } from "../servicios/catalogosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { fechaAPI, nombreCompleto, opcionesActivos, sinFechasPasadas } from "../utils/formularios.js";
import ErrorConsulta from "./ErrorConsulta";
import { CamposCambio } from "./ModalCambio";

// Lo que se registra en el historial (Fase 11). El coordinador no: es una
// decision interna, por eso cambiar solo el coordinador no pide motivo.
const CAMPOS_REGISTRADOS = ["fecha_evento_confirmada", "sede_acordada", "condiciones_acordadas", "cantidad_asistentes"];

// Sirve para aceptar un presupuesto (crea el evento) y para editarlo. conCambio:
// la edicion despues de confirmar, que es un cambio registrado con motivo,
// asistentes y tareas afectadas.
export default function EditorEvento({ datos, operacion, cerrar, guardado, titulo = "Editar evento", conCambio = false }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  const empleados = useConsulta(useCallback(async () => (await listarCatalogo("empleados")).data, []));
  const coordinador = datos.id_empleado_coordinador ?? datos.coordinador?.id_empleado;
  const valores = Form.useWatch([], form);
  const normalizar = (v) => ({ fecha_evento_confirmada: fechaAPI(v?.fecha_evento_confirmada), sede_acordada: v?.sede_acordada?.trim() || null,
    condiciones_acordadas: v?.condiciones_acordadas?.trim() || null, cantidad_asistentes: v?.cantidad_asistentes ?? null });
  const original = normalizar({ ...datos, fecha_evento_confirmada: datos.fecha_evento_confirmada ? dayjs(datos.fecha_evento_confirmada) : null });
  const cambiaAcuerdo = conCambio && CAMPOS_REGISTRADOS.some((c) => normalizar(valores)[c] !== original[c]);
  useEffect(() => {
    form.setFieldsValue({ sede_acordada: datos.sede_acordada ?? datos.sede_prevista ?? "",
      condiciones_acordadas: datos.condiciones_acordadas ?? "", id_empleado_coordinador: coordinador, cantidad_asistentes: datos.cantidad_asistentes,
      fecha_evento_confirmada: datos.fecha_evento_confirmada || datos.fecha_evento_prevista ? dayjs(datos.fecha_evento_confirmada || datos.fecha_evento_prevista) : null });
  }, [datos, coordinador, form]);
  return <Modal open title={titulo} width={conCambio ? 640 : undefined} onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()}
    okText="Confirmar" cancelText="Cancelar" confirmLoading={ocupado} okButtonProps={{ disabled: empleados.cargando || Boolean(empleados.error) }}>
    <ErrorConsulta {...empleados} />
    <Form form={form} layout="vertical" disabled={ocupado || empleados.cargando || Boolean(empleados.error)} onFinish={async (v) => {
      const body = { fecha_evento_confirmada: fechaAPI(v.fecha_evento_confirmada), sede_acordada: v.sede_acordada?.trim() || null,
        condiciones_acordadas: v.condiciones_acordadas?.trim() || null, id_empleado_coordinador: v.id_empleado_coordinador ?? null };
      const respuesta = await ejecutar(() => operacion(conCambio ? { ...body, cantidad_asistentes: v.cantidad_asistentes,
        motivo: v.motivo?.trim() || undefined, tareas_afectadas: v.tareas_afectadas || [] } : body));
      if (respuesta.ok) { guardado(respuesta.datos); cerrar(); }
    }}>
      <Form.Item name="fecha_evento_confirmada" label="Fecha confirmada" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" disabledDate={sinFechasPasadas} /></Form.Item>
      {conCambio && <Form.Item name="cantidad_asistentes" label="Cantidad de asistentes" rules={[{ required: true }, { type: "number", min: 1, message: "Mayor a 0." }]}>
        <InputNumber min={1} precision={0} /></Form.Item>}
      <Form.Item name="sede_acordada" label="Sede acordada"><Input maxLength={200} /></Form.Item>
      <Form.Item name="id_empleado_coordinador" label="Coordinador"><Select allowClear showSearch optionFilterProp="label" options={opcionesActivos(empleados.datos, "id_empleado", nombreCompleto, coordinador)} /></Form.Item>
      <Form.Item name="condiciones_acordadas" label="Condiciones acordadas"><Input.TextArea rows={3} /></Form.Item>
      {conCambio && <CamposCambio idEvento={datos.id_evento} motivoObligatorio={cambiaAcuerdo}
        ayudaMotivo="Si cambia la fecha o la sede, todos los servicios quedan a revisar." />}
    </Form>
  </Modal>;
}
