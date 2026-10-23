import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Modal, Select, Space } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { activarUsuario, crearUsuario, editarUsuario, listarUsuarios, resetearPassword } from "../servicios/usuariosService.js";
import { listarCatalogo } from "../servicios/catalogosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { useSesion } from "../contexto/useSesion.js";
import { EMPLEADO } from "../utils/menu";
import { nombreCompleto } from "../utils/formularios.js";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import ErrorConsulta from "../componentes/ErrorConsulta";
import TablaUsuarios from "../componentes/TablaUsuarios";
import { opcionesRol, reglasPassword } from "../utils/usuarios.js";

// Alta y edición de un usuario, con el mismo formulario. En la edición no va
// la contraseña: para eso está "Resetear contraseña".
function EditorUsuario({ datos, cerrar, guardado }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  const { usuario: sesion, actualizarUsuario } = useSesion();
  const esAlta = !datos.id_usuario;
  const rol = Form.useWatch("rol", form);
  // Empleados activos que todavía no tienen usuario (más el que ya tiene este)
  const empleados = useConsulta(useCallback(async () => (await listarCatalogo("empleados", { activo: true })).data, []));
  useEffect(() => { form.setFieldsValue({ ...datos, id_empleado: datos.id_empleado ?? null }); }, [datos, form]);
  const opcionesEmpleado = (empleados.datos || [])
    .filter((e) => !e.acceso || e.id_empleado === datos.id_empleado)
    .map((e) => ({ value: e.id_empleado, label: `${nombreCompleto(e)} · ${e.legajo}` }));
  return <Modal open title={esAlta ? "Nuevo usuario" : "Editar usuario"} okText="Guardar" cancelText="Cancelar" destroyOnHidden
    onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()} confirmLoading={ocupado}>
    <ErrorConsulta {...empleados} />
    <Form form={form} layout="vertical" disabled={ocupado} initialValues={{ rol: "coordinador" }} onFinish={async (v) => {
      const body = { nombre: v.nombre.trim(), email: v.email.trim(), rol: v.rol, id_empleado: v.id_empleado ?? null };
      const r = await ejecutar(() => esAlta ? crearUsuario({ ...body, password: v.password }) : editarUsuario(datos.id_usuario, body));
      if (!r.ok) return;
      // Si se editó a sí mismo, el Header muestra el nombre nuevo
      if (!esAlta && datos.id_usuario === sesion.id_usuario) actualizarUsuario({ nombre: r.datos.nombre, email: r.datos.email });
      cerrar(); guardado();
    }}>
      <Form.Item name="nombre" label="Nombre y apellido" rules={[{ required: true, whitespace: true, message: "Completá el nombre." }, { max: 100 }]}><Input maxLength={100} /></Form.Item>
      <Form.Item name="email" label="Email" rules={[{ required: true, message: "Completá el email." }, { type: "email", message: "Email inválido." }]}><Input type="email" autoComplete="off" /></Form.Item>
      {esAlta && <Form.Item name="password" label="Contraseña temporal" extra="Al entrar va a tener que cambiarla." rules={reglasPassword}>
        <Input.Password autoComplete="new-password" /></Form.Item>}
      <Form.Item name="rol" label="Rol" rules={[{ required: true }]}><Select options={opcionesRol()} /></Form.Item>
      <Form.Item name="id_empleado" label="Empleado vinculado"
        extra={rol === EMPLEADO ? "Obligatorio: sin empleado no tiene tareas." : "Opcional. Un socio puede no estar cargado en Personal."}
        rules={rol === EMPLEADO ? [{ required: true, message: "Elegí el empleado." }] : []}>
        <Select allowClear showSearch optionFilterProp="label" loading={empleados.cargando} options={opcionesEmpleado}
          placeholder="Sin vínculo" notFoundContent="No hay empleados activos sin usuario" />
      </Form.Item>
    </Form>
  </Modal>;
}

// Usuarios de mi empresa (solo admin). Las reglas (al menos un admin activo,
// no desactivarse a uno mismo) las aplica la API; sus 409 se muestran tal cual.
export default function Usuarios() {
  const [buscar, setBuscar] = useState("");
  const [rol, setRol] = useState(null);
  const [activo, setActivo] = useState("todos");
  const [editor, setEditor] = useState(null);
  const consulta = useConsulta(useCallback(async () => (await listarUsuarios({ ...(buscar ? { buscar } : {}), ...(rol ? { rol } : {}),
    ...(activo === "todos" ? {} : { activo }) })).data, [buscar, rol, activo]));
  return <>
    <EncabezadoPagina titulo="Usuarios" descripcion="Quién entra al sistema y con qué rol."
      acciones={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor({})}>Nuevo usuario</Button>} />
    <Alert type="info" showIcon className="aviso-formulario" title="Para darle acceso a alguien del personal, usá Personal → Dar acceso. Desde acá podés crear usuarios sin ficha de empleado, como un socio." />
    <ErrorConsulta {...consulta} />
    <Card><div className="barra-tabla">
      <Input.Search placeholder="Buscar por nombre o email" allowClear onSearch={setBuscar} style={{ maxWidth: 320 }} aria-label="Buscar usuarios" />
      <Space wrap>
        <Select aria-label="Rol" placeholder="Todos los roles" allowClear value={rol} onChange={setRol} style={{ minWidth: 160 }} options={opcionesRol()} />
        <Select aria-label="Estado" value={activo} onChange={setActivo} style={{ minWidth: 130 }}
          options={[{ value: "todos", label: "Todos" }, { value: "true", label: "Activos" }, { value: "false", label: "Inactivos" }]} />
        <Button icon={<ReloadOutlined />} aria-label="Actualizar" onClick={consulta.recargar} loading={consulta.cargando} />
      </Space>
    </div>
    <TablaUsuarios usuarios={consulta.datos} cargando={consulta.cargando} actualizar={consulta.recargar} editar={setEditor}
      cambiarActivo={(u, valor) => activarUsuario(u.id_usuario, valor)}
      resetear={(u, password) => resetearPassword(u.id_usuario, password)} /></Card>
    {editor && <EditorUsuario datos={editor} cerrar={() => setEditor(null)} guardado={consulta.recargar} />}
  </>;
}
