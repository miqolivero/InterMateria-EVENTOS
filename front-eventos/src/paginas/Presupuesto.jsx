import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Select, Skeleton, Space, Table } from "antd";
import { obtenerPresupuesto, editarPresupuesto, agregarRenglon, editarRenglon, quitarRenglon, presentarPresupuesto, rechazarPresupuesto, versionarPresupuesto, aceptarPresupuesto } from "../servicios/operacionService.js";
import { listarCatalogo } from "../servicios/catalogosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { formatearFecha, formatearMoneda } from "../utils/formato.js";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import ErrorConsulta from "../componentes/ErrorConsulta";
import EstadoTag from "../componentes/EstadoTag";
import EditorEvento from "../componentes/EditorEvento";

function EditorRenglon({ presupuesto, datos, cerrar, guardado }) {
  const [form] = Form.useForm();
  const servicio = Form.useWatch("id_servicio", form);
  const { ocupado, ejecutar } = useAccion();
  const servicios = useConsulta(useCallback(async () => (await listarCatalogo("servicios")).data, []));
  const proveedores = useConsulta(useCallback(async () => servicio ? (await listarCatalogo("proveedores", { activo: true, id_servicio: servicio })).data : [], [servicio]));
  useEffect(() => { form.setFieldsValue({ cantidad: 1, costo_proveedor: 0, ...datos }); }, [datos, form]);
  return <Modal open title={datos.id_detalle ? "Editar renglón" : "Agregar servicio"} onCancel={ocupado ? undefined : cerrar}
    okText="Guardar" cancelText="Cancelar" confirmLoading={ocupado} onOk={() => form.submit()}
    okButtonProps={{ disabled: servicios.cargando || proveedores.cargando || Boolean(servicios.error || proveedores.error) }}>
    <ErrorConsulta {...servicios} /><ErrorConsulta {...proveedores} />
    <Form form={form} layout="vertical" disabled={ocupado} onFinish={async (v) => {
      const body = { id_servicio: v.id_servicio, id_proveedor: v.id_proveedor ?? null, descripcion: v.descripcion?.trim() || null,
        cantidad: v.cantidad, costo_proveedor: v.costo_proveedor, importe_cliente: v.importe_cliente };
      const respuesta = await ejecutar(() => datos.id_detalle ? editarRenglon(presupuesto, datos.id_detalle, body) : agregarRenglon(presupuesto, body));
      if (respuesta.ok) { guardado(); cerrar(); }
    }}>
      <Form.Item name="id_servicio" label="Servicio" rules={[{ required: true }]}>
        <Select showSearch optionFilterProp="label" loading={servicios.cargando} onChange={() => form.setFieldValue("id_proveedor", null)}
          options={(servicios.datos || []).filter((s) => s.activo || s.id_servicio === datos.id_servicio).map((s) => ({ value: s.id_servicio, label: s.nombre, disabled: !s.activo }))} />
      </Form.Item>
      <Form.Item name="id_proveedor" label="Proveedor" dependencies={["id_servicio"]} rules={[{ validator: (_, valor) => valor && !proveedores.cargando && !proveedores.datos?.some((p) => p.id_proveedor === valor)
        ? Promise.reject(new Error("Seleccioná un proveedor activo que ofrezca este servicio, o dejalo sin asignar.")) : Promise.resolve() }]}>
        <Select allowClear showSearch optionFilterProp="label" disabled={!servicio || ocupado} loading={proveedores.cargando}
          options={[...(proveedores.datos || []).map((p) => ({ value: p.id_proveedor, label: p.razon_social })),
            ...(servicio === datos.id_servicio && datos.id_proveedor && !proveedores.cargando && !proveedores.datos?.some((p) => p.id_proveedor === datos.id_proveedor)
              ? [{ value: datos.id_proveedor, label: `${datos.nombre_proveedor || "Proveedor"} (no disponible)`, disabled: true }] : [])]} placeholder="Sin proveedor asignado" />
      </Form.Item>
      <Form.Item name="descripcion" label="Descripción"><Input.TextArea rows={2} /></Form.Item>
      <Form.Item name="cantidad" label="Cantidad (informativa)" rules={[{ required: true }, { type: "integer", min: 1 }]}><InputNumber min={1} precision={0} /></Form.Item>
      <Alert type="info" title="Ingresá los importes totales del renglón. La cantidad no los multiplica." className="aviso-formulario" />
      <Form.Item name="costo_proveedor" label="Costo total del proveedor" rules={[{ required: true }, { type: "number", min: 0 }]}><InputNumber prefix="$" min={0} precision={2} style={{ width: "100%" }} /></Form.Item>
      <Form.Item name="importe_cliente" label="Importe total al cliente" rules={[{ required: true }, { type: "number", min: 0 }]}><InputNumber prefix="$" min={0} precision={2} style={{ width: "100%" }} /></Form.Item>
    </Form>
  </Modal>;
}

export default function Presupuesto() {
  const { id } = useParams();
  const consulta = useConsulta(useCallback(async () => (await obtenerPresupuesto(id)).data, [id]));
  const [renglon, setRenglon] = useState(null);
  const [cabecera, setCabecera] = useState(false);
  const [aceptar, setAceptar] = useState(false);
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  const navigate = useNavigate();
  if (consulta.cargando) return <Skeleton active />;
  if (consulta.error) return <ErrorConsulta {...consulta} />;
  const p = consulta.datos;
  const editable = p.estado === "borrador" && p.editable === true;
  const solicitudAbierta = ["pendiente", "presupuestada"].includes(p.solicitud?.estado);
  const ultimaVersion = !p.versiones?.some((v) => v.numero_version > p.numero_version);
  const hayBorrador = p.versiones?.some((v) => v.estado === "borrador");
  const columnas = [
    { title: "Servicio", dataIndex: "nombre_servicio" }, { title: "Proveedor", dataIndex: "nombre_proveedor", render: (v) => v || "Sin asignar" },
    { title: "Descripción", dataIndex: "descripcion" }, { title: "Cantidad", dataIndex: "cantidad" },
    { title: "Costo", dataIndex: "costo_proveedor", render: formatearMoneda },
    { title: "Importe cliente", dataIndex: "importe_cliente", render: formatearMoneda }, { title: "Margen", dataIndex: "margen", render: formatearMoneda }
  ];
  if (editable) columnas.push({ title: "Acciones", key: "acciones", render: (_, d) => <Space>
    <Button size="small" disabled={ocupado} onClick={() => setRenglon(d)}>Editar</Button>
    <Popconfirm title="¿Quitar este servicio?" okText="Quitar" cancelText="Volver" onConfirm={async () => {
      const respuesta = await ejecutar(() => quitarRenglon(id, d.id_detalle)); if (respuesta.ok) consulta.recargar();
    }}><Button size="small" danger disabled={ocupado}>Quitar</Button></Popconfirm>
  </Space> });
  async function transicion(operacion) { const respuesta = await ejecutar(operacion); if (respuesta.ok) consulta.recargar(); }
  return <>
    <Link to={`/solicitudes/${p.id_solicitud}`} className="enlace-volver">Volver a solicitud #{p.id_solicitud}</Link>
    <EncabezadoPagina titulo={`Presupuesto · versión ${p.numero_version}`} acciones={<EstadoTag estado={p.estado} />} />
    <Space wrap style={{ marginBottom: 20 }}>
      <Select aria-label="Versión de presupuesto" value={p.id_presupuesto} style={{ minWidth: 240 }}
        options={(p.versiones || []).map((v) => ({ value: v.id_presupuesto, label: `Versión ${v.numero_version} · ${v.estado}` }))}
        onChange={(v) => { setRenglon(null); setAceptar(false); setCabecera(false); navigate(`/presupuestos/${v}`); }} />
      {editable && <Button onClick={() => { form.setFieldsValue({ validez_dias: p.validez_dias, observaciones: p.observaciones }); setCabecera(true); }}>Editar cabecera</Button>}
      {editable && solicitudAbierta && <Popconfirm title="¿Presentar presupuesto al cliente?" okText="Presentar" cancelText="Volver" onConfirm={() => transicion(() => presentarPresupuesto(id))}>
        <Button type="primary" disabled={ocupado || !p.detalle?.length}>Presentar</Button></Popconfirm>}
      {solicitudAbierta && ultimaVersion && !hayBorrador && ["presentado", "rechazado"].includes(p.estado) && <Button loading={ocupado} onClick={async () => {
        const respuesta = await ejecutar(() => versionarPresupuesto(id), "Versión creada."); if (respuesta.ok) navigate(`/presupuestos/${respuesta.datos.id_presupuesto}`);
      }}>Nueva versión</Button>}
      {p.estado === "presentado" && <>{solicitudAbierta && <Button type="primary" disabled={ocupado} onClick={() => setAceptar(true)}>Aceptar y confirmar evento</Button>}
        <Popconfirm title="¿Rechazar presupuesto?" okText="Rechazar" cancelText="Volver" onConfirm={() => transicion(() => rechazarPresupuesto(id))}><Button danger disabled={ocupado}>Rechazar</Button></Popconfirm></>}
    </Space>
    <Card><Descriptions column={{ xs: 1, md: 2 }} items={[
      { key: "cliente", label: "Cliente", children: p.solicitud?.nombre_cliente }, { key: "tipo", label: "Tipo", children: p.solicitud?.nombre_tipo_evento },
      { key: "fecha", label: "Evento previsto", children: formatearFecha(p.solicitud?.fecha_evento_prevista) }, { key: "emision", label: "Emisión", children: formatearFecha(p.fecha_emision) },
      { key: "validez", label: "Validez", children: `${p.validez_dias ?? "—"} días` }, { key: "nota", label: "Observaciones", children: p.observaciones || "—" }
    ]} /></Card>
    <Card title="Detalle" style={{ marginTop: 20 }} extra={editable && <Button onClick={() => setRenglon({})}>Agregar servicio</Button>}>
      <Table rowKey="id_detalle" columns={columnas} dataSource={p.detalle || []} pagination={false} scroll={{ x: 1000 }} summary={() => <Table.Summary.Row>
        <Table.Summary.Cell index={0} colSpan={4}>Totales</Table.Summary.Cell>
        <Table.Summary.Cell index={4}>{formatearMoneda(p.total_costo)}</Table.Summary.Cell>
        <Table.Summary.Cell index={5}>{formatearMoneda(p.importe_total)}</Table.Summary.Cell>
        <Table.Summary.Cell index={6}>{formatearMoneda(p.total_margen)}</Table.Summary.Cell>
        {editable && <Table.Summary.Cell index={7} />}
      </Table.Summary.Row>} />
    </Card>
    {renglon !== null && <EditorRenglon presupuesto={id} datos={renglon} cerrar={() => setRenglon(null)} guardado={consulta.recargar} />}
    <Modal open={cabecera} title="Cabecera del presupuesto" onCancel={ocupado ? undefined : () => setCabecera(false)} onOk={() => form.submit()}
      okText="Guardar" cancelText="Cancelar" confirmLoading={ocupado} forceRender>
      <Form form={form} layout="vertical" disabled={ocupado} onFinish={async (v) => {
        const respuesta = await ejecutar(() => editarPresupuesto(id, { validez_dias: v.validez_dias, observaciones: v.observaciones || null }));
        if (respuesta.ok) { setCabecera(false); consulta.recargar(); }
      }}>
        <Form.Item name="validez_dias" label="Validez en días" rules={[{ required: true }, { type: "integer", min: 1 }]}><InputNumber min={1} precision={0} /></Form.Item>
        <Form.Item name="observaciones" label="Observaciones"><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
    {aceptar && <EditorEvento titulo="Confirmar evento" datos={p.solicitud || {}} operacion={(body) => aceptarPresupuesto(id, body)} cerrar={() => setAceptar(false)}
      guardado={(evento) => navigate(`/eventos/${evento.id_evento}`)} />}
  </>;
}
