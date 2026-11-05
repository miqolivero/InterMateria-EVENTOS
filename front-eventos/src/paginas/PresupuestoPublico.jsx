import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, Button, Card, Descriptions, Form, Input, Modal, Result, Skeleton, Table, Typography } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { obtenerPresupuestoPublico, responderPresupuestoPublico } from "../servicios/publicoService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { formatearFecha, formatearMoneda } from "../utils/formato.js";
import Firma from "../componentes/Firma";
import "./PresupuestoPublico.css";

// Lo que ve el cliente con el link del presupuesto. Sin login y sin menú. La API
// no manda costos, márgenes ni proveedores, así que acá no hay nada que ocultar.
// Su respuesta queda registrada: la empresa es la que confirma el evento.

function Responder({ token, respuesta, cerrar, respondido }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  const acepta = respuesta === "aceptado";
  return <Modal open title={acepta ? "Aceptar el presupuesto" : "Rechazar el presupuesto"} okText={acepta ? "Confirmar aceptación" : "Confirmar rechazo"}
    cancelText="Volver" okButtonProps={{ danger: !acepta }} confirmLoading={ocupado} destroyOnHidden
    onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()}>
    <Typography.Paragraph>{acepta
      ? "Le vamos a avisar a la empresa. Se van a contactar con vos para confirmar el evento."
      : "Le vamos a avisar a la empresa. Si querés, contales el motivo: pueden prepararte otra propuesta."}</Typography.Paragraph>
    <Form form={form} layout="vertical" disabled={ocupado} onFinish={async (v) => {
      const r = await ejecutar(() => responderPresupuestoPublico(token, { respuesta, comentario: v.comentario?.trim() || undefined }), "Recibimos tu respuesta.");
      if (r.ok) { cerrar(); respondido(); }
    }}>
      <Form.Item name="comentario" label="Comentario (opcional)"><Input.TextArea rows={3} maxLength={1000} /></Form.Item>
    </Form>
  </Modal>;
}

// El estado del presupuesto, con palabras para el cliente
function Situacion({ p }) {
  if (p.estado === "aceptado") return <Alert type="success" showIcon title="Este presupuesto está confirmado." />;
  if (p.estado === "rechazado") return <Alert type="info" showIcon title="Este presupuesto fue rechazado. Si querés retomarlo, escribile a la empresa." />;
  if (p.respuesta_cliente) return <Alert type={p.respuesta_cliente === "aceptado" ? "success" : "info"} showIcon
    title={`Ya respondiste: ${p.respuesta_cliente === "aceptado" ? "aceptaste" : "rechazaste"} este presupuesto el ${formatearFecha(p.fecha_respuesta_cliente)}.`}
    description={p.respuesta_cliente === "aceptado" ? "La empresa se va a contactar con vos para confirmar el evento." : undefined} />;
  if (p.vencido) return <Alert type="warning" showIcon title={`Este presupuesto venció el ${formatearFecha(p.vence)}. Escribile a la empresa para actualizarlo.`} />;
  if (!p.puede_responder) return <Alert type="info" showIcon title="Este presupuesto ya no admite respuesta." />;
  return null;
}

export default function PresupuestoPublico() {
  const { token } = useParams();
  const consulta = useConsulta(useCallback(async () => (await obtenerPresupuestoPublico(token)).data, [token]));
  const [respuesta, setRespuesta] = useState(null);
  const p = consulta.datos;
  const contacto = p && [p.empresa.email, p.empresa.telefono].filter(Boolean).join(" · ");

  let contenido;
  if (consulta.cargando) contenido = <Card><Skeleton active /></Card>;
  else if (consulta.error) contenido = <Card><Result status="404" title="No encontramos este presupuesto" subTitle="Revisá el link o pedile a la empresa que te lo vuelva a mandar." /></Card>;
  else if (p.estado === "reemplazado") contenido = <Card><Result status="info" title="Hay una versión más nueva de este presupuesto"
    subTitle={`Pedile a ${p.empresa.nombre} el link de la última versión.`} /></Card>;
  else contenido = <>
    <div className="presupuesto-publico-cabecera">
      <Typography.Title level={2}>{p.empresa.nombre}</Typography.Title>
      {contacto && <Typography.Text type="secondary">{contacto}</Typography.Text>}
    </div>
    <Situacion p={p} />
    <Card title={`Presupuesto para ${p.nombre_cliente}`}>
      <Descriptions column={{ xs: 1, md: 2 }} items={[
        { key: "tipo", label: "Evento", children: p.nombre_tipo_evento },
        { key: "fecha", label: "Fecha prevista", children: formatearFecha(p.fecha_evento_prevista) },
        { key: "asistentes", label: "Asistentes", children: p.cantidad_asistentes },
        { key: "sede", label: "Sede", children: p.sede_prevista || "A definir" },
        { key: "emision", label: "Emitido", children: formatearFecha(p.fecha_emision) },
        { key: "vence", label: "Válido hasta", children: formatearFecha(p.vence) },
        ...(p.observaciones ? [{ key: "nota", label: "Observaciones", span: 2, children: p.observaciones }] : [])
      ]} />
    </Card>
    <Card title="Qué incluye">
      <Table rowKey={(_, i) => i} dataSource={p.detalle} pagination={false} scroll={{ x: 480 }} columns={[
        { title: "Servicio", dataIndex: "nombre_servicio", render: (v, d) => <><div>{v}</div>{d.descripcion && <Typography.Text type="secondary">{d.descripcion}</Typography.Text>}</> },
        { title: "Cantidad", dataIndex: "cantidad" },
        { title: "Importe", dataIndex: "importe_cliente", align: "right", render: formatearMoneda }
      ]} summary={() => <Table.Summary.Row>
        <Table.Summary.Cell index={0} colSpan={2}><strong>Total</strong></Table.Summary.Cell>
        <Table.Summary.Cell index={1} align="right"><strong>{formatearMoneda(p.importe_total)}</strong></Table.Summary.Cell>
      </Table.Summary.Row>} />
    </Card>
    {p.puede_responder && <div className="presupuesto-publico-acciones">
      <Button size="large" icon={<CloseOutlined />} onClick={() => setRespuesta("rechazado")}>Rechazar</Button>
      <Button size="large" type="primary" icon={<CheckOutlined />} onClick={() => setRespuesta("aceptado")}>Aceptar presupuesto</Button>
    </div>}
    {respuesta && <Responder token={token} respuesta={respuesta} cerrar={() => setRespuesta(null)} respondido={consulta.recargar} />}
  </>;

  return <main className="presupuesto-publico">{contenido}<Firma /></main>;
}
