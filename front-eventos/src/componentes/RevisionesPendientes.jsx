import { useCallback, useState } from "react";
import { Alert, Button, Card, DatePicker, Empty, Form, Input, Modal, Segmented, Select, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { marcarRevisado, revisionesEvento } from "../servicios/operacionService.js";
import { listarCatalogo } from "../servicios/catalogosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { useSesion } from "../contexto/useSesion.js";
import { fechaAPI, nombreCompleto } from "../utils/formularios.js";
import { estados, ESTADOS_PROVEEDOR } from "../utils/estados.js";
import { EMPLEADO } from "../utils/menu.jsx";
import ErrorConsulta from "./ErrorConsulta";
import "./Cambios.css";

const fechaHora = (valor) => valor ? dayjs(valor).format("DD/MM/YYYY HH:mm") : "—";

const opcionesEstado = (lista) => lista.map((value) => ({ value, label: estados[value].texto }));

// Solo lo que la persona cambió: lo demás no viaja y queda como está
function cambiosDe(revision, v) {
  if (revision.tipo === "servicio") return v.estado_proveedor !== revision.estado_proveedor ? { estado_proveedor: v.estado_proveedor } : {};
  const cambios = {};
  const fecha = fechaAPI(v.fecha_prevista);
  if (fecha && fecha !== revision.fecha_prevista?.slice(0, 10)) cambios.fecha_prevista = fecha;
  if (v.id_empleado_responsable && v.id_empleado_responsable !== revision.responsable?.id_empleado) cambios.id_empleado_responsable = v.id_empleado_responsable;
  if (v.estado_tarea !== revision.estado_tarea) cambios.estado_tarea = v.estado_tarea;
  return cambios;
}

// Los datos de la tarea que se pueden actualizar. El empleado, solo el estado.
function CamposTarea({ esEmpleado }) {
  const empleados = useConsulta(useCallback(async () => esEmpleado ? [] : (await listarCatalogo("empleados", { activo: true })).data, [esEmpleado]));
  return <>
    <ErrorConsulta {...empleados} />
    {!esEmpleado && <Form.Item name="fecha_prevista" label="Fecha prevista"><DatePicker format="DD/MM/YYYY" allowClear={false} /></Form.Item>}
    {!esEmpleado && <Form.Item name="id_empleado_responsable" label="Responsable">
      <Select showSearch optionFilterProp="label" loading={empleados.cargando} options={(empleados.datos || []).map((e) => ({ value: e.id_empleado, label: nombreCompleto(e) }))} /></Form.Item>}
    <Form.Item name="estado_tarea" label="Estado"><Select options={opcionesEstado(["pendiente", "en_curso", "completada"])} /></Form.Item>
  </>;
}

// Revisar deja constancia (quién, cuándo y una nota) y permite actualizar el
// compromiso. Nada cambia solo: lo que no se toca queda como está.
function ModalRevision({ revision, cerrar, guardado }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  const { usuario } = useSesion();
  const esTarea = revision.tipo === "tarea";
  const bloqueada = esTarea && revision.plazo_terminado;
  const inicial = esTarea ? { fecha_prevista: revision.fecha_prevista ? dayjs(revision.fecha_prevista) : null,
    id_empleado_responsable: revision.responsable?.id_empleado, estado_tarea: revision.estado_tarea } : { estado_proveedor: revision.estado_proveedor };
  return <Modal open title="Revisar" okText="Guardar revisión" cancelText="Cancelar" destroyOnHidden confirmLoading={ocupado}
    onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()}>
    <Typography.Paragraph type="secondary">{revision.tipo === "servicio" ? revision.nombre_servicio : revision.descripcion_tarea}
      {" · "}{revision.cambio.descripcion}</Typography.Paragraph>
    {bloqueada ? <Alert type="warning" showIcon className="aviso-formulario" title="El evento ya pasó: la tarea no se puede modificar, solo dejar la nota." />
      : <Alert type="info" showIcon className="aviso-formulario" title="Actualizá lo que haga falta. Lo que no toques queda como está." />}
    <Form form={form} layout="vertical" disabled={ocupado} initialValues={inicial} onFinish={async (v) => {
      const r = await ejecutar(() => marcarRevisado(revision.id_afectado, v.nota_revision.trim(), bloqueada ? {} : cambiosDe(revision, v)), "Revisión registrada.");
      if (r.ok) { cerrar(); guardado(); }
    }}>
      {esTarea && !bloqueada && <CamposTarea esEmpleado={usuario?.rol === EMPLEADO} />}
      {!esTarea && revision.estado_servicio !== "cancelado" && <Form.Item name="estado_proveedor" label="Estado del proveedor">
        <Select options={opcionesEstado(ESTADOS_PROVEEDOR).map((o) => ({ ...o, disabled: !revision.id_proveedor && ["confirmado", "completado"].includes(o.value) }))} /></Form.Item>}
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
        : revisar && <Button size="small" type="primary" onClick={() => revisar(revision)}>Revisar</Button>}
    </div>
    <p className="revision-motivo">{revision.cambio.descripcion} · Motivo: {revision.cambio.motivo} · {fechaHora(revision.cambio.fecha_hora)}</p>
    {revision.revisado && <p className="revision-motivo">Revisó {revision.revisado_por?.nombre} el {fechaHora(revision.fecha_revision)}: {revision.nota_revision}</p>}
    {revision.cambios_revision && <p className="revision-motivo">Se actualizó: {revision.cambios_revision}</p>}
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
