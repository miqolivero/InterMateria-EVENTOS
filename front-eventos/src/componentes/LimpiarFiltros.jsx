import { Button } from "antd";
import { ClearOutlined } from "@ant-design/icons";

// Vuelve a mostrar todo el listado. Aparece solo si hay algún filtro puesto.
export default function LimpiarFiltros({ activo, alTocar }) {
  if (!activo) return null;
  return <Button icon={<ClearOutlined />} onClick={alTocar}>Limpiar filtros</Button>;
}
