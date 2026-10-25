import { useCallback } from "react";
import { Alert, Checkbox, Form, Input, Modal } from "antd";
import { tareasEvento } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { formatearFecha } from "../utils/formato.js";
import ErrorConsulta from "./ErrorConsulta";
import "./Cambios.css";

// Fase 11: todo cambio de lo acordado después de confirmar lleva un motivo y,
// si corresponde, las tareas que el usuario elige como afectadas. El sistema
// no adivina cuáles se corren ni las reprograma: solo las marca "a revisar".

// El motivo y la lista de tareas para tildar. Va dentro de un Form; lo usan
// ModalCambio y el editor del evento.
export function CamposCambio({ idEvento, motivoObligatorio = true, ayudaMotivo }) {
  const tareas = useConsulta(useCallback(async () => (await tareasEvento(idEvento)).data, [idEvento]));
  return <>
    <Form.Item name="motivo" label="Motivo del cambio" extra={ayudaMotivo}
      rules={motivoObligatorio ? [{ required: true, whitespace: true, message: "El motivo es obligatorio." }] : []}>
      <Input.TextArea rows={3} maxLength={1000} placeholder="Por ejemplo: el cliente consiguió el salón recién para el 22" />
    </Form.Item>
    <ErrorConsulta {...tareas} />
    <Form.Item name="tareas_afectadas" label="Tareas afectadas (opcional)"
      extra="Las que elijas quedan a revisar. No se cambian solas.">
      {(tareas.datos || []).length === 0
        ? <span className="texto-secundario">{tareas.cargando ? "Cargando tareas…" : "El evento no tiene tareas."}</span>
        : <Checkbox.Group className="lista-tareas-afectadas" options={tareas.datos.map((t) => ({ value: t.id_tarea,
          label: <span>{t.descripcion} <span className="texto-secundario">· {t.nombre_responsable || "Sin responsable"} · {formatearFecha(t.fecha_prevista)}</span></span> }))} />}
    </Form.Item>
  </>;
}

// Modal genérico de un cambio: los campos propios van como children y
// operacion recibe los valores del form con motivo y tareas_afectadas.
export default function ModalCambio({ titulo, idEvento, operacion, cerrar, guardado, children, aviso, valoresIniciales,
  okText = "Registrar cambio", motivoObligatorio = true, ayudaMotivo }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  return <Modal open title={titulo} okText={okText} cancelText="Volver" width={640} destroyOnHidden confirmLoading={ocupado}
    onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()}>
    {aviso && <Alert type="info" showIcon className="aviso-formulario" title={aviso} />}
    <Form form={form} layout="vertical" disabled={ocupado} initialValues={valoresIniciales} onFinish={async (v) => {
      const respuesta = await ejecutar(() => operacion({ ...v, motivo: v.motivo?.trim() || undefined, tareas_afectadas: v.tareas_afectadas || [] }));
      if (respuesta.ok) { cerrar(); guardado?.(respuesta.datos); }
    }}>
      {children}
      <CamposCambio idEvento={idEvento} motivoObligatorio={motivoObligatorio} ayudaMotivo={ayudaMotivo} />
    </Form>
  </Modal>;
}
