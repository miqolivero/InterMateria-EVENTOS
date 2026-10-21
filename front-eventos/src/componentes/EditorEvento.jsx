import { useCallback, useEffect } from "react";
import { DatePicker, Form, Input, Modal, Select } from "antd";
import dayjs from "dayjs";
import { listarCatalogo } from "../servicios/catalogosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { fechaAPI, nombreCompleto, opcionesActivos, sinFechasPasadas } from "../utils/formularios.js";
import ErrorConsulta from "./ErrorConsulta";

export default function EditorEvento({ datos, operacion, cerrar, guardado, titulo = "Editar evento" }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  const empleados = useConsulta(useCallback(async () => (await listarCatalogo("empleados")).data, []));
  const coordinador = datos.id_empleado_coordinador ?? datos.coordinador?.id_empleado;
  useEffect(() => {
    form.setFieldsValue({ sede_acordada: datos.sede_acordada ?? datos.sede_prevista ?? "",
      condiciones_acordadas: datos.condiciones_acordadas ?? "", id_empleado_coordinador: coordinador,
      fecha_evento_confirmada: datos.fecha_evento_confirmada || datos.fecha_evento_prevista ? dayjs(datos.fecha_evento_confirmada || datos.fecha_evento_prevista) : null });
  }, [datos, coordinador, form]);
  return <Modal open title={titulo} onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()}
    okText="Confirmar" cancelText="Cancelar" confirmLoading={ocupado} okButtonProps={{ disabled: empleados.cargando || Boolean(empleados.error) }}>
    <ErrorConsulta {...empleados} />
    <Form form={form} layout="vertical" disabled={ocupado || empleados.cargando || Boolean(empleados.error)} onFinish={async (v) => {
      const respuesta = await ejecutar(() => operacion({ fecha_evento_confirmada: fechaAPI(v.fecha_evento_confirmada), sede_acordada: v.sede_acordada?.trim() || null,
        condiciones_acordadas: v.condiciones_acordadas?.trim() || null, id_empleado_coordinador: v.id_empleado_coordinador ?? null }));
      if (respuesta.ok) { guardado(respuesta.datos); cerrar(); }
    }}>
      <Form.Item name="fecha_evento_confirmada" label="Fecha confirmada" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" disabledDate={sinFechasPasadas} /></Form.Item>
      <Form.Item name="sede_acordada" label="Sede acordada"><Input maxLength={200} /></Form.Item>
      <Form.Item name="id_empleado_coordinador" label="Coordinador"><Select allowClear showSearch optionFilterProp="label" options={opcionesActivos(empleados.datos, "id_empleado", nombreCompleto, coordinador)} /></Form.Item>
      <Form.Item name="condiciones_acordadas" label="Condiciones acordadas"><Input.TextArea rows={3} /></Form.Item>
    </Form>
  </Modal>;
}
