import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Steps, Table, Tag, Typography } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { activarEmpresa, crearEmpresa, listarEmpresas } from "../../servicios/superadminService.js";
import { useConsulta } from "../../contexto/useConsulta.js";
import { useAccion } from "../../contexto/useAccion.js";
import { formatearFecha } from "../../utils/formato.js";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import ErrorConsulta from "../../componentes/ErrorConsulta";
import CamposEmpresa from "../../componentes/CamposEmpresa";
import { datosEmpresa } from "../../utils/usuarios.js";
import { reglasPassword } from "../../utils/usuarios.js";
import "./superadmin.css";

export const EstadoEmpresa = ({ activo }) => <Tag color={activo ? "green" : "red"}>{activo ? "Activa" : "Suspendida"}</Tag>;

const PASOS_EMPRESA = [["empresa", "nombre"], ["empresa", "cuit"], ["empresa", "email"], ["empresa", "telefono"], ["empresa", "direccion"]];

// Alta de una empresa con su admin, en dos pasos. La API crea las dos cosas en
// una sola transacción: si el email del admin está repetido, no queda la
// empresa creada a medias.
function AltaEmpresa({ cerrar, creada }) {
  const [form] = Form.useForm();
  const [paso, setPaso] = useState(0);
  const { ocupado, ejecutar } = useAccion();
  async function siguiente() {
    try { await form.validateFields(PASOS_EMPRESA); setPaso(1); } catch { /* el Form muestra los errores */ }
  }
  async function crear() {
    try { await form.validateFields(); } catch { return; }
    const valores = form.getFieldsValue(true);
    const admin = { nombre: valores.admin.nombre.trim(), email: valores.admin.email.trim(), password: valores.admin.password };
    const respuesta = await ejecutar(() => crearEmpresa(datosEmpresa(valores.empresa), admin), "Empresa creada.");
    if (respuesta.ok) creada(respuesta.datos);
  }
  return <Modal open title="Nueva empresa" onCancel={ocupado ? undefined : cerrar} width={640} destroyOnHidden
    footer={<Space>
      {paso === 1 && <Button disabled={ocupado} onClick={() => setPaso(0)}>Anterior</Button>}
      {paso === 0 ? <Button type="primary" onClick={siguiente}>Siguiente</Button>
        : <Button type="primary" loading={ocupado} onClick={crear}>Crear empresa</Button>}
    </Space>}>
    <Steps current={paso} size="small" className="pasos-alta" items={[{ title: "Empresa" }, { title: "Administrador" }]} />
    <Form form={form} layout="vertical" disabled={ocupado}>
      {paso === 0 && <CamposEmpresa grupo="empresa" />}
      {paso === 1 && <>
        <Typography.Paragraph type="secondary">Es la primera cuenta de la empresa. Con ella va a dar de alta a su personal.
          Al entrar va a tener que cambiar la contraseña.</Typography.Paragraph>
        <Form.Item name={["admin", "nombre"]} label="Nombre y apellido" rules={[{ required: true, whitespace: true, message: "Completá el nombre." }, { max: 100 }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name={["admin", "email"]} label="Email" rules={[{ required: true, message: "Completá el email." }, { type: "email", message: "Email inválido." }]}><Input type="email" autoComplete="off" /></Form.Item>
        <Form.Item name={["admin", "password"]} label="Contraseña temporal" rules={reglasPassword}><Input.Password autoComplete="new-password" /></Form.Item>
      </>}
    </Form>
  </Modal>;
}

// Empresas del sistema, con sus métricas. Nunca sus datos operativos.
export default function EmpresasSistema() {
  const [buscar, setBuscar] = useState("");
  const [activo, setActivo] = useState("todas");
  const [alta, setAlta] = useState(false);
  const navigate = useNavigate();
  const { ocupado, ejecutar } = useAccion();
  const consulta = useConsulta(useCallback(async () => (await listarEmpresas({ ...(buscar ? { buscar } : {}),
    ...(activo === "todas" ? {} : { activo }) })).data, [buscar, activo]));
  const numero = (campo, titulo) => ({ title: titulo, dataIndex: campo, align: "right", sorter: (a, b) => a[campo] - b[campo] });
  const columnas = [
    { title: "Empresa", key: "empresa", sorter: (a, b) => a.nombre.localeCompare(b.nombre), render: (_, e) => <span className="nombre-empresa">
      <Link to={`/superadmin/empresas/${e.id_empresa}`}>{e.nombre}</Link>
      <Typography.Text type="secondary">{e.cuit}</Typography.Text></span> },
    { title: "Estado", dataIndex: "activo", render: (v) => <EstadoEmpresa activo={v} /> },
    numero("usuarios_activos", "Usuarios"),
    numero("empleados_activos", "Empleados"),
    numero("clientes", "Clientes"),
    numero("eventos_abiertos", "Eventos abiertos"),
    numero("eventos_realizados", "Realizados"),
    { title: "Último evento", dataIndex: "ultimo_evento_creado", render: formatearFecha },
    { title: "Acciones", key: "acciones", render: (_, e) => <Space wrap>
      <Button size="small" onClick={() => navigate(`/superadmin/empresas/${e.id_empresa}`)}>Ver</Button>
      <Popconfirm title={e.activo ? `¿Suspender ${e.nombre}? Sus usuarios no van a poder entrar.` : `¿Reactivar ${e.nombre}?`}
        okText={e.activo ? "Suspender" : "Reactivar"} okButtonProps={{ danger: e.activo }} cancelText="Cancelar"
        onConfirm={async () => { const r = await ejecutar(() => activarEmpresa(e.id_empresa, !e.activo), e.activo ? "Empresa suspendida." : "Empresa reactivada."); if (r.ok) consulta.recargar(); }}>
        <Button size="small" danger={e.activo} disabled={ocupado}>{e.activo ? "Suspender" : "Reactivar"}</Button>
      </Popconfirm>
    </Space> }
  ];
  return <>
    <EncabezadoPagina titulo="Empresas" descripcion="Las organizadoras que usan el sistema y sus métricas."
      acciones={<Button type="primary" icon={<PlusOutlined />} onClick={() => setAlta(true)}>Nueva empresa</Button>} />
    <ErrorConsulta {...consulta} />
    <Card><div className="barra-tabla">
      <Input.Search placeholder="Buscar por nombre o CUIT" allowClear onSearch={setBuscar} style={{ maxWidth: 320 }} aria-label="Buscar empresas" />
      <Space wrap><Select aria-label="Estado" value={activo} onChange={setActivo} style={{ minWidth: 150 }}
        options={[{ value: "todas", label: "Todas" }, { value: "true", label: "Activas" }, { value: "false", label: "Suspendidas" }]} />
        <Button icon={<ReloadOutlined />} aria-label="Actualizar" onClick={consulta.recargar} loading={consulta.cargando} /></Space>
    </div>
    <Table rowKey="id_empresa" loading={consulta.cargando} dataSource={consulta.datos || []} columns={columnas} scroll={{ x: 1000 }}
      pagination={{ pageSize: 10, hideOnSinglePage: true }} locale={{ emptyText: consulta.error ? "No se pudo cargar el listado" : "Sin empresas" }} /></Card>
    {alta && <AltaEmpresa cerrar={() => setAlta(false)} creada={(empresa) => navigate(`/superadmin/empresas/${empresa.id_empresa}`)} />}
  </>;
}
