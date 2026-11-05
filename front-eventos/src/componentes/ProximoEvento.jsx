import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Card } from "antd";
import { CalendarOutlined, EnvironmentOutlined, UserOutlined } from "@ant-design/icons";
import { proximosEventos } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { formatearFecha, textoDiasRestantes, urgenciaDias } from "../utils/formato.js";
import EstadoTag from "./EstadoTag";
import ErrorConsulta from "./ErrorConsulta";
import Indicadores from "./Indicadores";
import "./ProximoEvento.css";

// El evento abierto más cercano y cuánto falta, para tenerlo presente al entrar.
// Tiene su propia consulta, a un año: no depende del filtro de días del tablero.
const VENTANA_DIAS = 365;

export default function ProximoEvento() {
  const consulta = useConsulta(useCallback(async () => (await proximosEventos(VENTANA_DIAS)).data, []));
  const eventos = consulta.datos || [];
  const evento = eventos[0];
  if (consulta.error) return <ErrorConsulta {...consulta} />;
  if (consulta.cargando) return <Card loading className="proximo-evento" />;
  if (!evento) return <Card className="proximo-evento proximo-vacio tarjeta-entrada"><strong>No hay eventos próximos.</strong> Cuando confirmes uno, va a aparecer acá.</Card>;
  const mismoDia = eventos.filter((e) => e.fecha_evento_confirmada === evento.fecha_evento_confirmada).length - 1;
  return <Card className={`proximo-evento urgencia-${urgenciaDias(evento.dias_restantes)} tarjeta-entrada`}>
    <div className="proximo-contenido">
      <div className="proximo-cuenta">
        <span className="proximo-etiqueta">Próximo evento</span>
        <strong className="proximo-dias">{textoDiasRestantes(evento.dias_restantes)}</strong>
      </div>
      <div className="proximo-datos">
        <div className="proximo-titulo">
          <Link to={`/eventos/${evento.id_evento}`}>{evento.nombre_cliente}</Link>
          <span className="texto-secundario">{evento.nombre_tipo_evento}</span>
          <EstadoTag estado={evento.estado} />
        </div>
        <div className="proximo-detalle">
          <span><CalendarOutlined /> {formatearFecha(evento.fecha_evento_confirmada)}</span>
          {evento.sede_acordada && <span><EnvironmentOutlined /> {evento.sede_acordada}</span>}
          {evento.nombre_coordinador && <span><UserOutlined /> {evento.nombre_coordinador}</span>}
        </div>
        <Indicadores indicadores={evento} compacto />
        {mismoDia > 0 && <span className="texto-secundario">Ese mismo día {mismoDia === 1 ? "hay 1 evento más" : `hay ${mismoDia} eventos más`}.</span>}
      </div>
    </div>
  </Card>;
}
