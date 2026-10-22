import { useState } from "react";
import { Button, Drawer, Grid, Layout, Menu, Space, Tag, Typography } from "antd";
import { ApartmentOutlined, CalendarOutlined, CheckSquareOutlined, DashboardOutlined,
  FileTextOutlined, LogoutOutlined, MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined,
  TeamOutlined, UserOutlined, BookOutlined, BankOutlined } from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSesion } from "../contexto/useSesion";
import "./LayoutPrincipal.css";

const opciones = [
  { key: "/seguimiento", icon: <DashboardOutlined />, label: "Seguimiento" },
  { key: "/mis-tareas", icon: <CheckSquareOutlined />, label: "Mis tareas" },
  { key: "/solicitudes", icon: <FileTextOutlined />, label: "Solicitudes" },
  { key: "/eventos", icon: <CalendarOutlined />, label: "Eventos" },
  { key: "/clientes", icon: <UserOutlined />, label: "Clientes" },
  { key: "/catalogos", icon: <BookOutlined />, label: "Catálogos" },
  { key: "/personal", icon: <TeamOutlined />, label: "Personal" },
  { key: "/empresas", icon: <BankOutlined />, label: "Empresas" }
];

export default function LayoutPrincipal() {
  const [colapsado, setColapsado] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const pantallas = Grid.useBreakpoint();
  const movil = !pantallas.lg;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { usuario, salir } = useSesion();
  const seleccion = pathname.startsWith("/presupuestos/") ? "/solicitudes" : opciones.find((opcion) => pathname.startsWith(opcion.key))?.key;
  const marca = <Link className="marca" to="/seguimiento" aria-label="Sistema de Eventos, inicio">
    <span className="marca-icono"><ApartmentOutlined /></span>
    {(!colapsado || movil) && <span>Eventos</span>}
  </Link>;
  const menu = <Menu theme="light" mode="inline" selectedKeys={seleccion ? [seleccion] : []}
    items={opciones} onClick={({ key }) => { navigate(key); setMenuAbierto(false); }} />;

  return <Layout className="layout-principal">
    {!movil && <Layout.Sider theme="light" width={210} collapsedWidth={64} collapsed={colapsado} className="barra-lateral">
      {marca}{menu}
    </Layout.Sider>}
    <Drawer title={marca} placement="left" open={menuAbierto} onClose={() => setMenuAbierto(false)}
      size={250} styles={{ body: { padding: 0 } }}>
      {menu}
    </Drawer>
    <Layout>
      <Layout.Header className="cabecera-principal">
        <Space size="middle">
          <Button type="text" aria-label={movil ? "Abrir menú" : colapsado ? "Expandir menú" : "Colapsar menú"}
            icon={movil ? <MenuOutlined /> : colapsado ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => movil ? setMenuAbierto(true) : setColapsado(!colapsado)} />
          <div className="empresa-cabecera">
            <Typography.Text strong ellipsis>{usuario.nombre_empresa || "Mi empresa"}</Typography.Text></div>
        </Space>
        <Space size="middle">
          <div className="datos-usuario"><Typography.Text strong>{usuario.nombre}</Typography.Text>
            <Tag variant="filled">{usuario.rol === "admin" ? "Administrador" : "Usuario"}</Tag></div>
          <Button type="text" icon={<LogoutOutlined />} aria-label="Cerrar sesión" title="Cerrar sesión"
            onClick={() => { salir(); navigate("/login", { replace: true }); }} />
        </Space>
      </Layout.Header>
      <Layout.Content className="contenido-principal"><div className="transicion-pagina" key={pathname}><Outlet /></div></Layout.Content>
    </Layout>
  </Layout>;
}
