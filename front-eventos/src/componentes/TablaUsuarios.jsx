import { useState } from "react";
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from "antd";
import { useAccion } from "../contexto/useAccion.js";
import { useSesion } from "../contexto/useSesion.js";
import { EMPLEADO, coloresRoles, nombresRoles } from "../utils/menu";
import { opcionesRol, reglasPassword } from "../utils/usuarios.js";
import { formatearFecha } from "../utils/formato.js";

export const EtiquetaRol = ({ rol }) =>
  <Tag color={coloresRoles[rol]} variant={coloresRoles[rol] ? undefined : "outlined"}>{nombresRoles[rol] || rol}</Tag>;

// Reset de la contraseña de otra persona. La API deja debe_cambiar_password en
// true: esa persona la va a tener que cambiar al entrar.
function ResetPassword({ usuario, resetear, cerrar }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  return <Modal open title={`Resetear la contraseña de ${usuario.nombre}`} okText="Resetear" cancelText="Cancelar"
    onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()} confirmLoading={ocupado} destroyOnHidden>
    <Typography.Paragraph type="secondary">Pasale la contraseña temporal a {usuario.nombre}. Al entrar va a tener que elegir una nueva.</Typography.Paragraph>
    <Form form={form} layout="vertical" disabled={ocupado} onFinish={async ({ password_nueva }) => {
      const respuesta = await ejecutar(() => resetear(usuario, password_nueva), "Contraseña reseteada.");
      if (respuesta.ok) cerrar();
    }}>
      <Form.Item name="password_nueva" label="Contraseña temporal" rules={reglasPassword}>
        <Input.Password autoComplete="new-password" />
      </Form.Item>
    </Form>
  </Modal>;
}

// La tabla de usuarios de una empresa, con sus acciones de soporte. La usan
// "Usuarios" (el admin, sobre su empresa) y el detalle de empresa del
// superadmin. Las reglas (último admin, uno mismo) las aplica la API: acá solo
// se muestran sus 409 tal cual llegan.
//
// cambiarRol: si viene, el rol se cambia con un Select en la fila (superadmin).
// editar: si viene, aparece "Editar" (admin, con su propio formulario).
export default function TablaUsuarios({ usuarios, cargando, actualizar, cambiarRol, cambiarActivo, resetear, editar, mostrarEmpleado = true }) {
  const { ocupado, ejecutar } = useAccion();
  const { usuario: sesion } = useSesion();
  const [reset, setReset] = useState(null);
  const columnas = [
    { title: "Usuario", key: "usuario", sorter: (a, b) => a.nombre.localeCompare(b.nombre), render: (_, u) => <Space orientation="vertical" size={0}>
      <Typography.Text strong>{u.nombre}{u.id_usuario === sesion?.id_usuario ? " (vos)" : ""}</Typography.Text>
      <Typography.Text type="secondary">{u.email}</Typography.Text>
    </Space> },
    { title: "Rol", dataIndex: "rol", render: (rol, u) => cambiarRol
      ? <Select size="small" value={rol} disabled={ocupado} style={{ width: 150 }} aria-label={`Rol de ${u.nombre}`}
        options={opcionesRol().map((o) => ({ ...o, disabled: o.value === EMPLEADO && !u.id_empleado }))}
        onChange={async (nuevo) => { const r = await ejecutar(() => cambiarRol(u, nuevo)); if (r.ok) actualizar(); }} />
      : <EtiquetaRol rol={rol} /> },
    ...(mostrarEmpleado ? [{ title: "Empleado vinculado", dataIndex: "nombre_empleado", render: (v) => v || <Typography.Text type="secondary">Sin vínculo</Typography.Text> }] : []),
    { title: "Estado", key: "estado", render: (_, u) => <Space wrap size={4}>
      <Tag color={u.activo ? "green" : undefined} variant={u.activo ? undefined : "outlined"}>{u.activo ? "Activo" : "Inactivo"}</Tag>
      {u.debe_cambiar_password && <Tag color="gold">Contraseña temporal</Tag>}
    </Space> },
    { title: "Alta", dataIndex: "fecha_creacion", render: formatearFecha },
    { title: "Acciones", key: "acciones", render: (_, u) => <Space wrap>
      {editar && <Button size="small" disabled={ocupado} onClick={() => editar(u)}>Editar</Button>}
      <Popconfirm title={u.activo ? `¿Desactivar a ${u.nombre}? No va a poder entrar.` : `¿Activar a ${u.nombre}?`}
        okText="Confirmar" cancelText="Cancelar" onConfirm={async () => {
          const r = await ejecutar(() => cambiarActivo(u, !u.activo)); if (r.ok) actualizar();
        }}><Button size="small" disabled={ocupado}>{u.activo ? "Desactivar" : "Activar"}</Button></Popconfirm>
      <Button size="small" disabled={ocupado} onClick={() => setReset(u)}>Resetear contraseña</Button>
    </Space> }
  ];
  return <>
    <Table rowKey="id_usuario" loading={cargando} dataSource={usuarios || []} columns={columnas} scroll={{ x: 900 }}
      pagination={{ pageSize: 10, hideOnSinglePage: true }} locale={{ emptyText: "Sin usuarios" }} />
    {reset && <ResetPassword usuario={reset} resetear={resetear} cerrar={() => { setReset(null); actualizar(); }} />}
  </>;
}
