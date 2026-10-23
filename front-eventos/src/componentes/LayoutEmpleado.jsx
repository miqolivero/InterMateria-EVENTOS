import { Layout, Menu, Typography } from "antd";
import { ApartmentOutlined } from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSesion } from "../contexto/useSesion";
import { inicioDeRol, menuDeRol, opcionDeRuta } from "../utils/menu";
import MenuUsuario from "./MenuUsuario";
import "./LayoutEmpleado.css";

// Layout del rol empleado (Fase 10), pensado para el celular: el empleado
// trabaja desde el salón, no desde un escritorio. Sin menú lateral: una barra
// con sus dos opciones (Mis tareas y Mi empresa, de utils/menu.jsx) y el
// contenido en una sola columna angosta.
export default function LayoutEmpleado() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { usuario } = useSesion();
  const seleccion = opcionDeRuta(pathname)?.ruta;
  return <Layout className="layout-empleado">
    <Layout.Header className="cabecera-empleado">
      <Link className="marca-empleado" to={inicioDeRol(usuario.rol)} aria-label="Mis tareas, inicio">
        <ApartmentOutlined />
        <Typography.Text strong ellipsis className="empresa-empleado">{usuario.nombre_empresa || "Eventos"}</Typography.Text>
      </Link>
      <MenuUsuario />
    </Layout.Header>
    <nav className="navegacion-empleado" aria-label="Secciones">
      <Menu mode="horizontal" selectedKeys={seleccion ? [seleccion] : []} items={menuDeRol(usuario.rol)}
        onClick={({ key }) => navigate(key)} className="menu-empleado" />
    </nav>
    <Layout.Content className="contenido-empleado"><div className="transicion-pagina" key={pathname}><Outlet /></div></Layout.Content>
  </Layout>;
}
