import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Card, DatePicker, Segmented, Table } from "antd";
import { eventosPorEstado } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { fechaAPI } from "../utils/formularios.js";
import { formatearFecha } from "../utils/formato.js";
import { estados, SITUACIONES } from "../utils/estados.js";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import ErrorConsulta from "../componentes/ErrorConsulta";
import EstadoTag from "../componentes/EstadoTag";
import "../componentes/Cambios.css";

// Fase 11: la consulta "eventos por estado" del cliente. Junta las
// solicitudes que esperan respuesta (presupuesto presentado) con los eventos,
// y deja a la vista lo rechazado y lo cancelado: nada se borra.
export default function EventosPorEstado() {
  const [situacion, setSituacion] = useState("todas");
  const [rango, setRango] = useState({});
  const consulta = useConsulta(useCallback(async () => (await eventosPorEstado({ ...rango,
    ...(situacion === "todas" ? {} : { situacion }) })).data, [situacion, rango]));
  const conteo = consulta.datos?.conteo || {};
  const total = Object.values(conteo).reduce((a, b) => a + b, 0);
  return <>
    <EncabezadoPagina titulo="Eventos por estado" descripcion="Lo que espera respuesta del cliente, lo confirmado y lo que quedó en el camino."
      acciones={<DatePicker.RangePicker format="DD/MM/YYYY" aria-label="Rango de fechas"
        onChange={(r) => setRango(r ? { desde: fechaAPI(r[0]), hasta: fechaAPI(r[1]) } : {})} />} />
    <ErrorConsulta {...consulta} />
    <div className="filtro-segmentado"><Segmented value={situacion} onChange={setSituacion} aria-label="Situación"
      options={[{ value: "todas", label: `Todas (${total})` }, ...SITUACIONES.map((s) => ({ value: s, label: `${estados[s].texto} (${conteo[s] ?? 0})` }))]} /></div>
    <Card><Table rowKey={(fila) => `${fila.tipo}-${fila.id_evento ?? fila.id_solicitud}`} dataSource={consulta.datos?.items || []} loading={consulta.cargando}
      scroll={{ x: 760 }} columns={[
        { title: "Fecha", dataIndex: "fecha", render: formatearFecha },
        { title: "Cliente", dataIndex: "nombre_cliente" },
        { title: "Tipo de evento", dataIndex: "nombre_tipo_evento" },
        { title: "Situación", dataIndex: "situacion", render: (v) => <EstadoTag estado={v} /> },
        { title: "", key: "ver", render: (_, f) => f.tipo === "evento" ? <Link to={`/eventos/${f.id_evento}`}>Ver evento</Link>
          : f.id_presupuesto_presentado ? <Link to={`/presupuestos/${f.id_presupuesto_presentado}`}>Ver presupuesto</Link>
            : <Link to={`/solicitudes/${f.id_solicitud}`}>Ver solicitud</Link> }
      ]} /></Card>
  </>;
}
