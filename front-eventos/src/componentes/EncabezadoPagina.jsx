import { Typography } from "antd";

export default function EncabezadoPagina({ titulo, descripcion, acciones }) {
  return <div className="encabezado-pagina">
    <div>
      <Typography.Title level={1}>{titulo}</Typography.Title>
      {descripcion && <Typography.Paragraph type="secondary">{descripcion}</Typography.Paragraph>}
    </div>
    {acciones && <div className="encabezado-acciones">{acciones}</div>}
  </div>;
}
