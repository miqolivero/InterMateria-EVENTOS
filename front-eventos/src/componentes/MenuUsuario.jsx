import { Avatar, Button, Dropdown, Tag, Typography } from "antd";
import { DownOutlined, KeyOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useSesion } from "../contexto/useSesion";
import { coloresRoles, nombresRoles } from "../utils/menu";
import "./MenuUsuario.css";

// El menú del usuario del Header, igual en los tres layouts: nombre, rol,
// "Cambiar contraseña" y "Cerrar sesión".
export default function MenuUsuario() {
  const { usuario, salir } = useSesion();
  const navigate = useNavigate();
  const items = [
    { key: "datos", disabled: true, label: <div className="menu-usuario-datos">
      <Typography.Text strong>{usuario.nombre}</Typography.Text>
      <Typography.Text type="secondary">{usuario.email}</Typography.Text>
    </div> },
    { type: "divider" },
    { key: "password", icon: <KeyOutlined />, label: "Cambiar contraseña" },
    { key: "salir", icon: <LogoutOutlined />, label: "Cerrar sesión", danger: true }
  ];
  function elegir({ key }) {
    if (key === "password") navigate("/cambiar-password");
    if (key === "salir") { salir(); navigate("/login", { replace: true }); }
  }
  return <Dropdown menu={{ items, onClick: elegir }} trigger={["click"]} placement="bottomRight">
    <Button type="text" className="menu-usuario" aria-label={`Menú de ${usuario.nombre}`}>
      <Avatar size="small" icon={<UserOutlined />} />
      <span className="menu-usuario-nombre">{usuario.nombre}</span>
      <Tag color={coloresRoles[usuario.rol]} variant={coloresRoles[usuario.rol] ? undefined : "outlined"} className="menu-usuario-rol">
        {nombresRoles[usuario.rol] || usuario.rol}</Tag>
      <DownOutlined className="menu-usuario-flecha" />
    </Button>
  </Dropdown>;
}
