import { Link } from "react-router-dom";
import { Button, Result } from "antd";

function NoEncontrada() {
  return (
    <Result status="404" title="No encontramos esta página" subTitle="Revisá la dirección o volvé a tu espacio de trabajo."
      extra={<Link to="/"><Button type="primary">Volver al inicio</Button></Link>} />
  );
}

export default NoEncontrada;
