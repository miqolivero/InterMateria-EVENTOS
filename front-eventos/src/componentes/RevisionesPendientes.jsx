import { useCallback, useState } from "react";
import { Button, Card, Empty, Form, Input, Modal, Segmented, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { marcarRevisado, revisionesEvento } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import ErrorConsulta from "./ErrorConsulta";
import "./Cambios.css";

const fechaHora = (valor) => valor ? dayjs(valor).format("DD/MM/YYYY HH:mm") : "—";

// Revisar solo deja constancia: quién, cuándo y una nota. No cambia la tarea
// ni el proveedor; eso se hace con sus propias acciones.
function ModalRevision({ revision, cerrar, guardado }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  return <Modal open title="Marcar como revisado" okText="Guardar revisión" cancelText="Cancelar" destroyOnHidden confirmLoading={ocupado}
    onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()}>
    <Typography.Paragraph type="secondary">{revision.tipo === "servicio" ? revision.nombre_servicio : revision.descripcion_tarea}
      {" · "}{revision.cambio.descripcion}</Typography.Paragraph>
    <Form form={form} layout="vertical" disabled={ocupado} onFinish={async (v) => {
      const r = await ejecutar(() => marcarRevisado(revision.id_afectado, v.nota_revision.trim()), "Revisión registrada.");
      if (r.ok) { cerrar(); guardado(); }
    }}>
      <Form.Item name="nota_revision" label="Qué se revisó" rules={[{ required: true, whitespace: true, message: "La nota es obligatoria: deja constancia de la revisión." }]}>
        <Input.TextArea rows={3} maxLength={1000} placeholder="Por ejemplo: se avisó a Deco Fiestas, confirma igual para el 22" />
      </Form.Item>
    </Form>
  </Modal>;
}

// Un compromiso afectado por un cambio
export function ItemRevision({ revision, revisar }) {
  return <div className={`revision-item${revision.revisado ? " revisada" : ""}`}>
    <div className="revision-cabecera">
      <span><Tag>{revision.tipo === "servicio" ? "Servicio" : "Tarea"}</Tag>
        <Typography.Text strong>{revision.tipo === "servicio" ? revision.nombre_servicio : revision.descripcion_tarea}</Typography.Text>
        {revision.responsable && <span className="texto-secundario"> · {revision.responsable.nombre}</span>}</span>
      {revision.revisado ? <Tag color="green">Revisado</Tag>
        : revisar && <Button size="small" type="primary" onClick={() => revisar(revision)}>Marcar como revisado</Button>}
    </div>
    <p className="revision-motivo">{revision.cambio.descripcion} · Motivo: {revision.cambio.motivo} · {fechaHora(revision.cambio.fecha_hora)}</p>
    {revision.revisado && <p className="revision-motivo">Revisó {revision.revisado_por?.nombre} el {fechaHora(revision.fecha_revision)}: {revision.nota_revision}</p>}
  </div>;
}

// Los compromisos a revisar del evento. El empleado recibe de la API solo los
// suyos; acá no se filtra nada.
export default function RevisionesPendientes({ idEvento, actualizado, editable = true }) {
  const [filtro, setFiltro] = useState("false");
  const [revision, setRevision] = useState(null);
  const consulta = useConsulta(useCallback(async () => (await revisionesEvento(idEvento, filtro === "todas" ? {} : { revisado: filtro })).data, [idEvento, filtro]));
  const lista = consulta.datos || [];
  return <Card>
    <div className="filtro-segmentado"><Segmented value={filtro} onChange={setFiltro} aria-label="Filtrar revisiones"
      options={[{ value: "false", label: "A revisar" }, { value: "true", label: "Revisadas" }, { value: "todas", label: "Todas" }]} /></div>
    <ErrorConsulta {...consulta} />
    {consulta.cargando ? <Card loading variant="borderless" /> : lista.length === 0
      ? <Empty description={filtro === "false" ? "No hay nada pendiente de revisar." : "Sin revisiones."} />
      : lista.map((r) => <ItemRevision key={r.id_afectado} revision={r} revisar={editable ? setRevision : null} />)}
    {revision && <ModalRevision revision={revision} cerrar={() => setRevision(null)} guardado={() => { consulta.recargar(); actualizado?.(); }} />}
  </Card>;
}

export { ModalRevision };
