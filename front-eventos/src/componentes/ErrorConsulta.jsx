import { Alert, Button } from "antd";
import { mensajeError } from "../utils/errores.js";

export default function ErrorConsulta({ error, recargar }) {
  return error ? <Alert type="error" showIcon role="alert" className="aviso-formulario" title={mensajeError(error)}
    action={recargar && <Button size="small" onClick={recargar}>Reintentar</Button>} /> : null;
}
