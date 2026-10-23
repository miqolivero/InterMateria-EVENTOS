import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Descriptions, Empty, Form, Input, Modal, Popconfirm, Select, Space, Spin, Statistic, Typography } from "antd";
import { ArrowLeftOutlined, PlusOutlined } from "@ant-design/icons";
import { actualizarUsuarioEmpresa, activarEmpresa, crearUsuarioEmpresa, editarEmpresa, eliminarEmpresa,
  obtenerEmpresa, resetearPasswordEmpresa } from "../../servicios/superadminService.js";
import { useConsulta } from "../../contexto/useConsulta.js";
import { useAccion } from "../../contexto/useAccion.js";
import { formatearFecha } from "../../utils/formato.js";
import { ADMIN, COORDINADOR } from "../../utils/menu";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import ErrorConsulta from "../../componentes/ErrorConsulta";
import CamposEmpresa from "../../componentes/CamposEmpresa";
import { datosEmpresa } from "../../utils/usuarios.js";
import TablaUsuarios from "../../componentes/TablaUsuarios";
import { opcionesRol, reglasPassword } from "../../utils/usuarios.js";
import { EstadoEmpresa } from "./EmpresasSistema";
import "./superadmin.css";

function EditorEmpresa({ empresa, cerrar, guardada }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  useEffect(() => { form.setFieldsValue(empresa); }, [empresa, form]);
  return <Modal open title="Editar empresa" okText="Guardar" cancelText="Cancelar" width={640} destroyOnHidden
    onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()} confirmLoading={ocupado}>
    <Form form={form} layout="vertical" disabled={ocupado} onFinish={async (valores) => {
      const r = await ejecutar(() => editarEmpresa(empresa.id_empresa, datosEmpresa(valores)));
      if (r.ok) { cerrar(); guardada(); }
    }}><CamposEmpresa /></Form>
  </Modal>;
}

// Soporte: un usuario nuevo para la empresa. Solo admin o coordinador: un
// usuario empleado necesita su ficha de personal, y eso lo carga la empresa.
function NuevoUsuario({ idEmpresa, cerrar, creado }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  return <Modal open title="Nuevo usuario" okText="Crear" cancelText="Cancelar" destroyOnHidden
    onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()} confirmLoading={ocupado}>
    <Typography.Paragraph type="secondary">Los usuarios con rol empleado los crea la empresa desde Personal.</Typography.Paragraph>
    <Form form={form} layout="vertical" disabled={ocupado} initialValues={{ rol: ADMIN }} onFinish={async (v) => {
      const r = await ejecutar(() => crearUsuarioEmpresa(idEmpresa, { nombre: v.nombre.trim(), email: v.email.trim(), password: v.password, rol: v.rol }), "Usuario creado.");
      if (r.ok) { cerrar(); creado(); }
    }}>
      <Form.Item name="nombre" label="Nombre y apellido" rules={[{ required: true, whitespace: true, message: "Completá el nombre." }, { max: 100 }]}><Input maxLength={100} /></Form.Item>
      <Form.Item name="email" label="Email" rules={[{ required: true, message: "Completá el email." }, { type: "email", message: "Email inválido." }]}><Input type="email" autoComplete="off" /></Form.Item>
      <Form.Item name="password" label="Contraseña temporal" rules={reglasPassword}><Input.Password autoComplete="new-password" /></Form.Item>
      <Form.Item name="rol" label="Rol" rules={[{ required: true }]}><Select options={opcionesRol([ADMIN, COORDINADOR])} /></Form.Item>
    </Form>
  </Modal>;
}

const metricas = [
  ["usuarios_activos", "Usuarios activos"], ["empleados_activos", "Empleados activos"], ["clientes", "Clientes"],
  ["eventos_abiertos", "Eventos abiertos"], ["eventos_realizados", "Eventos realizados"]
];

export default function EmpresaSistema() {
  const { id } = useParams();
  const navigate = useNavigate();
  const consulta = useConsulta(useCallback(async () => (await obtenerEmpresa(id)).data, [id]));
  const { ocupado, ejecutar } = useAccion();
  const [editor, setEditor] = useState(false);
  const [nuevoUsuario, setNuevoUsuario] = useState(false);
  const empresa = consulta.datos;
  const volver = <Link className="enlace-volver" to="/superadmin/empresas"><ArrowLeftOutlined /> Empresas</Link>;

  if (consulta.cargando) return <>{volver}<div className="pantalla-espera"><Spin /></div></>;
  if (!empresa) return <>{volver}<ErrorConsulta {...consulta} />{consulta.error?.response?.status === 404 && <Empty description="Empresa no encontrada" />}</>;

  return <>
    {volver}
    <EncabezadoPagina titulo={<Space wrap>{empresa.nombre}<EstadoEmpresa activo={empresa.activo} /></Space>} acciones={<Space wrap>
      <Button disabled={ocupado} onClick={() => setEditor(true)}>Editar</Button>
      <Popconfirm title={empresa.activo ? "¿Suspender la empresa? Sus usuarios no van a poder entrar." : "¿Reactivar la empresa?"}
        okText={empresa.activo ? "Suspender" : "Reactivar"} okButtonProps={{ danger: empresa.activo }} cancelText="Cancelar"
        onConfirm={async () => { const r = await ejecutar(() => activarEmpresa(empresa.id_empresa, !empresa.activo), empresa.activo ? "Empresa suspendida." : "Empresa reactivada."); if (r.ok) consulta.recargar(); }}>
        <Button danger={empresa.activo} disabled={ocupado}>{empresa.activo ? "Suspender" : "Reactivar"}</Button></Popconfirm>
      <Popconfirm title="¿Eliminar la empresa?" description="Solo se puede si todavía no cargó datos." okText="Eliminar" okButtonProps={{ danger: true }} cancelText="Cancelar"
        onConfirm={async () => { const r = await ejecutar(() => eliminarEmpresa(empresa.id_empresa), "Empresa eliminada."); if (r.ok) navigate("/superadmin/empresas", { replace: true }); }}>
        <Button danger type="text" disabled={ocupado}>Eliminar</Button></Popconfirm>
    </Space>} />
    <div className="metricas-empresa">
      {metricas.map(([clave, titulo]) => <Card key={clave}><Statistic title={titulo} value={empresa[clave]} /></Card>)}
      <Card><Statistic title="Último evento creado" value={formatearFecha(empresa.ultimo_evento_creado)} /></Card>
    </div>
    <Card title="Datos de la empresa" className="bloque-empresa">
      <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} items={[
        { key: "cuit", label: "CUIT", children: empresa.cuit },
        { key: "email", label: "Email", children: empresa.email || "—" },
        { key: "telefono", label: "Teléfono", children: empresa.telefono || "—" },
        { key: "direccion", label: "Dirección", children: empresa.direccion || "—" },
        { key: "alta", label: "Alta en el sistema", children: formatearFecha(empresa.fecha_creacion) }
      ]} />
    </Card>
    <Card title="Usuarios" extra={<Button icon={<PlusOutlined />} onClick={() => setNuevoUsuario(true)}>Nuevo usuario</Button>}>
      <TablaUsuarios usuarios={empresa.usuarios} actualizar={consulta.recargar} mostrarEmpleado={false}
        cambiarRol={(u, rol) => actualizarUsuarioEmpresa(empresa.id_empresa, u.id_usuario, { rol })}
        cambiarActivo={(u, activo) => actualizarUsuarioEmpresa(empresa.id_empresa, u.id_usuario, { activo })}
        resetear={(u, password) => resetearPasswordEmpresa(empresa.id_empresa, u.id_usuario, password)} />
    </Card>
    {editor && <EditorEmpresa empresa={empresa} cerrar={() => setEditor(false)} guardada={consulta.recargar} />}
    {nuevoUsuario && <NuevoUsuario idEmpresa={empresa.id_empresa} cerrar={() => setNuevoUsuario(false)} creado={consulta.recargar} />}
  </>;
}
