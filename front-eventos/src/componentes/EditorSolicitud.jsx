import { useCallback, useEffect, useState } from "react";
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select } from "antd";
import dayjs from "dayjs";
import { listarCatalogo, crearCatalogo } from "../servicios/catalogosService.js";
import { crearSolicitud, editarSolicitud } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { camposPermitidos, fechaAPI, nombreCompleto, opcionesActivos, sinFechasPasadas } from "../utils/formularios.js";
import ErrorConsulta from "./ErrorConsulta";
import FormularioCatalogo from "./FormularioCatalogo";

export default function EditorSolicitud({ datos, cerrar, guardado }) {
  const [form] = Form.useForm();
  const [clienteForm] = Form.useForm();
  const [crearRapido, setCrearRapido] = useState(false);
  const { ocupado, ejecutar } = useAccion();
  const catalogos = useConsulta(useCallback(async () => {
    const [clientes, tipos] = await Promise.all([listarCatalogo("clientes"), listarCatalogo("tipos")]);
    return { clientes: clientes.data, tipos: tipos.data };
  }, []));
  useEffect(() => { form.setFieldsValue({ ...datos, fecha_evento_prevista: datos.fecha_evento_prevista ? dayjs(datos.fecha_evento_prevista) : null }); }, [datos, form]);
  async function guardar(valores) {
    const body = { ...camposPermitidos(valores, ["id_cliente", "id_tipo_evento", "cantidad_asistentes", "sede_prevista", "preferencias"]), fecha_evento_prevista: fechaAPI(valores.fecha_evento_prevista) };
    const respuesta = await ejecutar(() => datos.id_solicitud ? editarSolicitud(datos.id_solicitud, body) : crearSolicitud(body));
    if (respuesta.ok) { guardado(respuesta.datos); cerrar(); }
  }
  return <>
    <Modal open title={datos.id_solicitud ? "Editar solicitud" : "Nueva solicitud"} onCancel={ocupado ? undefined : cerrar}
      okText="Guardar" cancelText="Cancelar" confirmLoading={ocupado} onOk={() => form.submit()}
      okButtonProps={{ disabled: catalogos.cargando || Boolean(catalogos.error) }}>
      <ErrorConsulta {...catalogos} />
      <Form form={form} layout="vertical" onFinish={guardar} disabled={ocupado || catalogos.cargando || Boolean(catalogos.error)}>
        <Form.Item label="Cliente" name="id_cliente" rules={[{ required: true, message: "Seleccioná un cliente." }]}>
          <Select showSearch optionFilterProp="label" options={opcionesActivos(catalogos.datos?.clientes, "id_cliente", nombreCompleto, datos.id_cliente)} />
        </Form.Item>
        <Button size="small" disabled={ocupado} onClick={() => setCrearRapido(true)} style={{ marginBottom: 20 }}>Crear cliente</Button>
        <Form.Item label="Tipo de evento" name="id_tipo_evento" rules={[{ required: true }]}>
          <Select showSearch optionFilterProp="label" options={opcionesActivos(catalogos.datos?.tipos, "id_tipo_evento", "nombre", datos.id_tipo_evento)} />
        </Form.Item>
        <Form.Item label="Fecha prevista" name="fecha_evento_prevista" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" disabledDate={sinFechasPasadas} /></Form.Item>
        <Form.Item label="Asistentes" name="cantidad_asistentes" rules={[{ required: true }, { type: "integer", min: 1 }]}><InputNumber min={1} precision={0} /></Form.Item>
        <Form.Item label="Sede prevista" name="sede_prevista"><Input maxLength={200} /></Form.Item>
        <Form.Item label="Preferencias" name="preferencias"><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
    <Modal open={crearRapido} title="Nuevo cliente" onCancel={ocupado ? undefined : () => setCrearRapido(false)}
      okText="Guardar cliente" cancelText="Cancelar" confirmLoading={ocupado} onOk={() => clienteForm.submit()} destroyOnHidden>
      {crearRapido && <FormularioCatalogo recurso="clientes" form={clienteForm} ocupado={ocupado} guardar={async (valores) => {
        const respuesta = await ejecutar(() => crearCatalogo("clientes", camposPermitidos(valores, ["nombre", "apellido", "dni_cuit", "email", "telefono", "direccion"])));
        if (respuesta.ok) { catalogos.recargar(); form.setFieldValue("id_cliente", respuesta.datos.id_cliente); setCrearRapido(false); }
      }} />}
    </Modal>
  </>;
}
