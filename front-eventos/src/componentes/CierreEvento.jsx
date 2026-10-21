import { useCallback, useState } from "react";
import { Alert, Button, Card, Descriptions, Form, Input, Modal, Radio, Result } from "antd";
import { cerrarEvento, guardarFeedback, tareasEvento, serviciosEvento } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { formatearFecha } from "../utils/formato.js";
import ErrorConsulta from "./ErrorConsulta";

export default function CierreEvento({ evento, actualizado }) {
  const [form] = Form.useForm();
  const [feedback] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  const [confirmar, setConfirmar] = useState(null);
  const pendientes = useConsulta(useCallback(async () => {
    const [tareas, servicios] = await Promise.all([tareasEvento(evento.id_evento), serviciosEvento(evento.id_evento)]);
    return { tareas: tareas.data.filter((t) => t.estado_tarea !== "completada").length,
      servicios: servicios.data.filter((s) => !s.id_proveedor || !["confirmada", "en_seguimiento", "finalizada"].includes(s.estado_proveedor)).length };
  }, [evento.id_evento]));
  const abierto = evento.editable === true && ["confirmado", "en_preparacion"].includes(evento.estado);
  if (!abierto) return <Card><Result status={evento.estado === "realizado" ? "success" : "info"} title={evento.estado === "realizado" ? "Evento realizado" : "Evento cancelado"}
    subTitle={formatearFecha(evento.fecha_cierre)} />
    <Descriptions column={1} items={[{ key: "obs", label: "Observaciones de cierre", children: evento.observaciones_cierre || "—" }]} />
    {evento.estado === "realizado" && <Form form={feedback} layout="vertical" disabled={ocupado} initialValues={{ feedback_cliente: evento.feedback_cliente || "", observaciones_cierre: evento.observaciones_cierre || "" }}
      onFinish={async (v) => { const respuesta = await ejecutar(() => guardarFeedback(evento.id_evento, {
        observaciones_cierre: v.observaciones_cierre?.trim() || null, feedback_cliente: v.feedback_cliente?.trim() || null
      })); if (respuesta.ok) actualizado(); }}>
      <Form.Item name="observaciones_cierre" label="Actualizar observaciones"><Input.TextArea rows={3} /></Form.Item>
      <Form.Item name="feedback_cliente" label="Feedback del cliente" dependencies={["observaciones_cierre"]} rules={[({ getFieldValue }) => ({
        validator: (_, valor) => valor?.trim() || getFieldValue("observaciones_cierre")?.trim() ? Promise.resolve() : Promise.reject(new Error("Ingresá feedback u observaciones."))
      })]}><Input.TextArea rows={3} /></Form.Item>
      <Button type="primary" htmlType="submit" loading={ocupado}>Guardar feedback</Button>
    </Form>}
  </Card>;
  return <Card title="Cerrar evento">
    <ErrorConsulta {...pendientes} />
    {!!(pendientes.datos?.tareas || pendientes.datos?.servicios) && <Alert type="warning" showIcon className="aviso-formulario"
      title={`Quedan ${pendientes.datos.tareas} tareas pendientes y ${pendientes.datos.servicios} servicios sin confirmar.`} />}
    <Form form={form} layout="vertical" disabled={ocupado} onFinish={setConfirmar}>
      <Form.Item name="estado" label="Resultado" rules={[{ required: true }]}><Radio.Group options={[{ value: "realizado", label: "Realizado" }, { value: "cancelado", label: "Cancelado" }]} /></Form.Item>
      <Form.Item name="observaciones_cierre" label="Observaciones" dependencies={["estado"]} rules={[({ getFieldValue }) => ({
        validator: (_, valor) => getFieldValue("estado") === "cancelado" && !valor?.trim() ? Promise.reject(new Error("Indicá el motivo de cancelación.")) : Promise.resolve()
      })]}><Input.TextArea rows={4} /></Form.Item>
      <Button type="primary" htmlType="submit" disabled={pendientes.cargando} loading={ocupado}>Cerrar evento</Button>
    </Form>
    <Modal open={confirmar !== null} title="¿Cerrar este evento?" okText="Confirmar cierre" cancelText="Volver" confirmLoading={ocupado}
      onCancel={ocupado ? undefined : () => setConfirmar(null)} onOk={async () => {
        const respuesta = await ejecutar(() => cerrarEvento(evento.id_evento, { estado: confirmar.estado, observaciones_cierre: confirmar.observaciones_cierre?.trim() || null }));
        if (respuesta.ok) { setConfirmar(null); actualizado(); }
      }}><p>Después del cierre no se podrán modificar los servicios ni las tareas.</p></Modal>
  </Card>;
}
