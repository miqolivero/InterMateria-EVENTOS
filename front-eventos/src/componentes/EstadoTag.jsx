import { Tag, Tooltip } from "antd";
import { CheckCircleFilled, ClockCircleOutlined, CloseCircleFilled, EditOutlined, ExclamationCircleOutlined,
  MinusCircleOutlined, SendOutlined, SwapOutlined, SyncOutlined } from "@ant-design/icons";
import { estados } from "../utils/estados";

// Un ícono por estado, además del color: así los estados se distinguen a
// simple vista (y también para quien no distingue bien los colores). Un
// aceptado y un reemplazado ya no son "dos etiquetas parecidas".
const ICONOS = {
  borrador: <EditOutlined />,
  presentado: <SendOutlined />,
  esperando_respuesta: <SendOutlined />,
  aceptado: <CheckCircleFilled />,
  aceptada: <CheckCircleFilled />,
  confirmado: <CheckCircleFilled />,
  completado: <CheckCircleFilled />,
  completada: <CheckCircleFilled />,
  realizado: <CheckCircleFilled />,
  rechazado: <CloseCircleFilled />,
  rechazada: <CloseCircleFilled />,
  solicitud_rechazada: <CloseCircleFilled />,
  vencida: <ExclamationCircleOutlined />,
  a_revisar: <ExclamationCircleOutlined />,
  reemplazado: <SwapOutlined />,
  cancelado: <MinusCircleOutlined />,
  cancelada: <MinusCircleOutlined />,
  solicitud_cancelada: <MinusCircleOutlined />,
  pendiente: <ClockCircleOutlined />,
  en_curso: <SyncOutlined />,
  en_preparacion: <SyncOutlined />
};

export default function EstadoTag({ estado }) {
  const configuracion = estados[estado];
  // Los estados neutros (sin color) van con borde: el Tag sin color de antd 6
  // tiene el mismo gris que el fondo de la pagina (colorBgLayout) y no se veia.
  const tag = <Tag color={configuracion?.color} icon={ICONOS[estado]} variant={configuracion?.color ? undefined : "outlined"}>
    {configuracion?.texto || estado || "Sin estado"}</Tag>;
  return configuracion?.ayuda ? <Tooltip title={configuracion.ayuda}>{tag}</Tooltip> : tag;
}
