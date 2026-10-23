import { useState } from "react";
import { Button, Drawer, Grid, Layout, Menu, Space, Typography } from "antd";
import { ApartmentOutlined, MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSesion } from "../contexto/useSesion";
import { inicioDeRol, menuDeRol, opcionDeRuta } from "../utils/menu";
import MenuUsuario from "./MenuUsuario";
import "./LayoutPrincipal.css";

// Layout con menú lateral, para el admin y el coordinador (y, con otra
// cabecera, para el superadmin: ver LayoutSuperadmin). El menú sale de
// utils/menu.jsx filtrado por el rol: cada uno ve solo lo suyo.
//
// marca / cabecera: lo que cambia entre el panel de una empresa y el del
// superadmin.
export function LayoutLateral({ marca: textoMarca = "Eventos", cabecera, className = "" }) {
  const [colapsado, setColapsado] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const pantallas = Grid.useBreakpoint();
  const movil = !pantallas.lg;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { usuario } = useSesion();
  const seleccion = opcionDeRuta(pathname)?.ruta;
  const marca = <Link className="marca" to={inicioDeRol(usuario.rol)} aria-label={`${textoMarca}, inicio`}>
    <span className="marca-icono"><ApartmentOutlined /></span>
    {(!colapsado || movil) && <span>{textoMarca}</span>}
  </Link>;
  const menu = <Menu theme="light" mode="inline" selectedKeys={seleccion ? [seleccion] : []}
    items={menuDeRol(usuario.rol)} onClick={({ key }) => { navigate(key); setMenuAbierto(false); }} />;

  return <Layout className={`layout-principal ${className}`}>
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
          <div className="empresa-cabecera">{cabecera}</div>
        </Space>
        <MenuUsuario />
      </Layout.Header>
      <Layout.Content className="contenido-principal"><div className="transicion-pagina" key={pathname}><Outlet /></div></Layout.Content>
    </Layout>
  </Layout>;
}

export default function LayoutPrincipal() {
  const { usuario } = useSesion();
  return <LayoutLateral cabecera={<Typography.Text strong ellipsis>{usuario.nombre_empresa || "Mi empresa"}</Typography.Text>} />;
}
