import { Tag, Typography } from "antd";
import { LayoutLateral } from "./LayoutPrincipal";
import "./LayoutSuperadmin.css";

// Layout del superadmin: el mismo esqueleto con menú lateral, pero sin empresa
// en la cabecera (el superadmin no pertenece a ninguna) y con una marca
// distinta, para que nunca se confunda con el panel de una empresa.
// Su menú (Resumen y Empresas) sale de utils/menu.jsx como el de los demás.
export default function LayoutSuperadmin() {
  return <LayoutLateral className="layout-superadmin" marca="Administración" cabecera={<span className="cabecera-superadmin">
    <Typography.Text strong>Panel del sistema</Typography.Text>
    <Tag color="geekblue" className="etiqueta-metricas">Solo métricas</Tag>
  </span>} />;
}
