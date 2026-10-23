import { useCallback, useState } from "react";
import { Button, Card, Divider, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, Typography } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { listarCatalogo, obtenerCatalogo, crearCatalogo, editarCatalogo, activarCatalogo, obtenerServiciosProveedor, guardarServiciosProveedor, darAcceso } from "../servicios/catalogosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { catalogos } from "../utils/catalogos.js";
import { camposPermitidos, fechaAPI, nombreCompleto } from "../utils/formularios.js";
import { formatearFecha } from "../utils/formato.js";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import ErrorConsulta from "../componentes/ErrorConsulta";
import FormularioCatalogo from "../componentes/FormularioCatalogo";
import { EtiquetaRol } from "../componentes/TablaUsuarios";
import { opcionesRol, reglasPassword } from "../utils/usuarios.js";

// Acceso al sistema de un empleado (Fase 10). Los mismos campos sirven en el
// alta de Personal (dentro del bloque "acceso") y en "Dar acceso".
// El rol de acá es el PERMISO en el sistema; el "Rol laboral" de la ficha es
// el puesto, en texto libre. Son cosas distintas.
function CamposAcceso({ grupo }) {
  const nombre = (campo) => grupo ? [grupo, campo] : campo;
  return <>
    <Form.Item name={nombre("email")} label="Email para entrar" rules={[{ required: true, message: "Completá el email." }, { type: "email", message: "Email inválido." }]}>
      <Input type="email" autoComplete="off" /></Form.Item>
    <Form.Item name={nombre("password")} label="Contraseña temporal" extra="Al entrar por primera vez va a tener que cambiarla." rules={reglasPassword}>
      <Input.Password autoComplete="new-password" /></Form.Item>
    <Form.Item name={nombre("rol")} label="Permiso en el sistema" rules={[{ required: true, message: "Elegí el rol." }]}>
      <Select options={opcionesRol()} /></Form.Item>
  </>;
}

function DarAcceso({ empleado, cerrar, actualizado }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  return <Modal open title={`Dar acceso a ${nombreCompleto(empleado)}`} okText="Dar acceso" cancelText="Cancelar" destroyOnHidden
    onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()} confirmLoading={ocupado}>
    <Form form={form} layout="vertical" disabled={ocupado} initialValues={{ email: empleado.email || "", rol: "empleado" }}
      onFinish={async (v) => {
        const r = await ejecutar(() => darAcceso(empleado.id_empleado, { email: v.email.trim(), password: v.password, rol: v.rol }), "Acceso creado.");
        if (r.ok) { cerrar(); actualizado(); }
      }}><CamposAcceso /></Form>
  </Modal>;
}

function ServiciosProveedor({ proveedor, cerrar, actualizado }) {
  const [seleccion, setSeleccion] = useState(null);
  const consulta = useConsulta(useCallback(async () => {
    const [oferta, servicios] = await Promise.all([obtenerServiciosProveedor(proveedor.id_proveedor), listarCatalogo("servicios")]);
    return { ids: oferta.data.map((s) => s.id_servicio), servicios: servicios.data };
  }, [proveedor.id_proveedor]));
  const { ocupado, ejecutar } = useAccion();
  const ids = seleccion ?? consulta.datos?.ids ?? [];
  return <Modal open title={`Servicios de ${proveedor.razon_social}`} onCancel={ocupado ? undefined : cerrar}
    confirmLoading={ocupado} okText="Guardar" cancelText="Cancelar" okButtonProps={{ disabled: consulta.cargando || Boolean(consulta.error) }}
    onOk={async () => {
      const respuesta = await ejecutar(() => guardarServiciosProveedor(proveedor.id_proveedor, ids));
      if (respuesta.ok) { actualizado(); cerrar(); }
    }}>
    <ErrorConsulta {...consulta} />
    <label htmlFor="servicios-proveedor">Servicios ofrecidos</label>
    <Select id="servicios-proveedor" mode="multiple" style={{ width: "100%", marginTop: 8 }} showSearch optionFilterProp="label"
      disabled={ocupado || consulta.cargando || Boolean(consulta.error)} loading={consulta.cargando} value={ids} onChange={setSeleccion}
      options={(consulta.datos?.servicios || []).filter((s) => s.activo || ids.includes(s.id_servicio))
        .map((s) => ({ value: s.id_servicio, label: s.nombre + (s.activo ? "" : " (inactivo)"), disabled: !s.activo && !ids.includes(s.id_servicio) }))} />
  </Modal>;
}

export default function Catalogo({ recurso, sinTitulo = false }) {
  const config = catalogos[recurso];
  const [buscar, setBuscar] = useState("");
  const [activo, setActivo] = useState("true");
  const consulta = useConsulta(useCallback(async () => (await listarCatalogo(recurso, { buscar, ...(activo === "todos" ? {} : { activo }) })).data, [recurso, buscar, activo]));
  const [editor, setEditor] = useState(null);
  const [proveedor, setProveedor] = useState(null);
  const [acceso, setAcceso] = useState(null);
  const [form] = Form.useForm();
  const conAcceso = Form.useWatch("dar_acceso", form);
  const altaDePersonal = recurso === "empleados" && editor !== null && !editor.id_empleado;
  const { ocupado, ejecutar } = useAccion();
  async function guardar(valores) {
    const datos = camposPermitidos(valores, config.campos.map(([nombre]) => nombre));
    if (recurso === "empleados") datos.fecha_inicio = fechaAPI(valores.fecha_inicio);
    // Alta con acceso: la API crea el empleado y su usuario en una transaccion
    if (altaDePersonal && valores.dar_acceso) {
      datos.acceso = { email: valores.acceso.email.trim(), password: valores.acceso.password, rol: valores.acceso.rol };
    }
    const respuesta = await ejecutar(() => editor[config.id] ? editarCatalogo(recurso, editor[config.id], datos) : crearCatalogo(recurso, datos));
    if (respuesta.ok) { setEditor(null); consulta.recargar(); }
  }
  async function editar(fila) {
    const respuesta = await ejecutar(() => obtenerCatalogo(recurso, fila[config.id]), null);
    if (respuesta.ok) setEditor(respuesta.datos);
  }
  const columnas = [
    ...(recurso === "empleados" ? [{ title: "Legajo", dataIndex: "legajo" }] : []),
    { title: recurso === "proveedores" ? "Razón social" : "Nombre", key: "nombre", render: (_, fila) => recurso === "proveedores" ? fila.razon_social : nombreCompleto(fila) },
    ...(["tipos", "servicios"].includes(recurso) ? [{ title: "Descripción", dataIndex: "descripcion", render: (v) => v || "—" }] : [
      { title: "Email", dataIndex: "email", render: (v) => v || "—" }, { title: "Teléfono", dataIndex: "telefono", render: (v) => v || "—" }
    ]),
    ...(recurso === "clientes" ? [{ title: "DNI / CUIT", dataIndex: "dni_cuit" }] : []),
    ...(recurso === "proveedores" ? [{ title: "Servicios", dataIndex: "servicios", render: (servicios) => servicios?.map((s) => s.nombre).join(", ") || "Sin asignar" }] : []),
    ...(recurso === "empleados" ? [{ title: "Cargo", dataIndex: "cargo" }, { title: "Ingreso", dataIndex: "fecha_inicio", render: formatearFecha },
      { title: "Acceso", dataIndex: "acceso", render: (a) => a ? <Space size={4} wrap><EtiquetaRol rol={a.rol} />{!a.activo && <Tag variant="outlined">Inactivo</Tag>}</Space>
        : <Typography.Text type="secondary">Sin acceso</Typography.Text> }] : []),
    { title: "Estado", dataIndex: "activo", render: (v) => <Tag color={v ? "green" : "default"}>{v ? "Activo" : "Inactivo"}</Tag> },
    { title: "Acciones", key: "acciones", render: (_, fila) => <Space wrap>
      <Button size="small" disabled={ocupado} onClick={() => editar(fila)}>Editar</Button>
      {recurso === "proveedores" && <Button size="small" disabled={ocupado} onClick={() => setProveedor(fila)}>Servicios</Button>}
      {recurso === "empleados" && !fila.acceso && fila.activo && <Button size="small" disabled={ocupado} onClick={() => setAcceso(fila)}>Dar acceso</Button>}
      <Popconfirm title={fila.activo ? `¿Desactivar este ${config.singular}?` : `¿Activar este ${config.singular}?`}
        okText="Confirmar" cancelText="Cancelar" onConfirm={async () => {
          const respuesta = await ejecutar(() => activarCatalogo(recurso, fila[config.id], !fila.activo));
          if (respuesta.ok) consulta.recargar();
        }}><Button size="small" disabled={ocupado}>{fila.activo ? "Desactivar" : "Activar"}</Button></Popconfirm>
    </Space> }
  ];
  return <>
    {!sinTitulo && <EncabezadoPagina titulo={config.titulo} />}
    <ErrorConsulta {...consulta} />
    <Card><div className="barra-tabla">
      <Input.Search placeholder="Buscar" allowClear onSearch={setBuscar} style={{ maxWidth: 320 }} aria-label={`Buscar ${config.titulo.toLowerCase()}`} />
      <Space wrap><Select aria-label="Estado" value={activo} onChange={setActivo} style={{ minWidth: 130 }} options={[{ value: "true", label: "Activos" }, { value: "false", label: "Inactivos" }, { value: "todos", label: "Todos" }]} />
        <Button icon={<ReloadOutlined />} aria-label="Actualizar" onClick={consulta.recargar} loading={consulta.cargando} />
        <Button type="primary" icon={<PlusOutlined />} disabled={ocupado} onClick={() => setEditor({})}>Nuevo {config.singular}</Button></Space>
    </div><Table rowKey={config.id} loading={consulta.cargando} dataSource={consulta.datos || []} columns={columnas} scroll={{ x: 900 }}
      pagination={{ pageSize: 10, hideOnSinglePage: true }} locale={{ emptyText: consulta.error ? "No se pudo cargar el listado" : "Sin registros" }} /></Card>
    <Modal open={editor !== null} title={`${editor?.[config.id] ? "Editar" : "Nuevo"} ${config.singular}`}
      onCancel={ocupado ? undefined : () => setEditor(null)} onOk={() => form.submit()} okText="Guardar" cancelText="Cancelar" confirmLoading={ocupado} destroyOnHidden>
      {editor !== null && <FormularioCatalogo recurso={recurso} datos={editor} form={form} guardar={guardar} ocupado={ocupado}>
        {altaDePersonal && <>
          <Divider />
          <Form.Item name="dar_acceso" label="Darle acceso al sistema" valuePropName="checked"><Switch /></Form.Item>
          {conAcceso && <CamposAcceso grupo="acceso" />}
        </>}
      </FormularioCatalogo>}
    </Modal>
    {proveedor && <ServiciosProveedor proveedor={proveedor} cerrar={() => setProveedor(null)} actualizado={consulta.recargar} />}
    {acceso && <DarAcceso empleado={acceso} cerrar={() => setAcceso(null)} actualizado={consulta.recargar} />}
  </>;
}

export function Catalogos() {
  return <><EncabezadoPagina titulo="Catálogos" /><Tabs destroyOnHidden items={[
    { key: "tipos", label: "Tipos de evento", children: <Catalogo recurso="tipos" sinTitulo /> },
    { key: "servicios", label: "Servicios", children: <Catalogo recurso="servicios" sinTitulo /> },
    { key: "proveedores", label: "Proveedores", children: <Catalogo recurso="proveedores" sinTitulo /> }
  ]} /></>;
}
