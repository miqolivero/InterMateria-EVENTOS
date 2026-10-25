import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Col, Row, Segmented, Space, Statistic, Table, Tag } from "antd";
import { resumenSeguimiento, proximosEventos, tareasVencidas, serviciosSinConfirmar } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { formatearFecha } from "../utils/formato.js";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import ErrorConsulta from "../componentes/ErrorConsulta";
import EstadoTag from "../componentes/EstadoTag";
import Indicadores from "../componentes/Indicadores";

export default function Seguimiento() {
  const [dias, setDias] = useState(30);
  // Consultas independientes: un panel con error no oculta los demás resultados.
  const resumen = useConsulta(useCallback(async () => (await resumenSeguimiento(dias)).data, [dias]));
  const eventos = useConsulta(useCallback(async () => (await proximosEventos(dias)).data, [dias]));
  const tareas = useConsulta(useCallback(async () => (await tareasVencidas(dias)).data, [dias]));
  const servicios = useConsulta(useCallback(async () => (await serviciosSinConfirmar(dias)).data, [dias]));
  const indicador = (titulo, campo) => <Card key={campo} loading={resumen.cargando}><Statistic title={titulo} value={resumen.datos?.[campo] ?? "—"} /></Card>;
  return <>
    <EncabezadoPagina titulo="Seguimiento" acciones={<Space wrap><Link to="/eventos-por-estado"><Button>Eventos por estado</Button></Link>
      <Segmented value={dias} onChange={setDias} options={[7, 15, 30].map((v) => ({ value: v, label: `${v} días` }))} /></Space>} />
    <ErrorConsulta {...resumen} />
    <div className="indicadores-seguimiento">{[
      ["Eventos próximos", "eventos_proximos"], ["Tareas vencidas", "tareas_vencidas"], ["Tareas pendientes", "tareas_pendientes"],
      ["Servicios sin confirmar", "servicios_sin_confirmar"], ["A revisar", "pendientes_revision"], ["Solicitudes pendientes", "solicitudes_pendientes"]
    ].map(([titulo, campo]) => indicador(titulo, campo))}</div>
    <Card title="Próximos eventos"><ErrorConsulta {...eventos} />
      <Table rowKey="id_evento" pagination={{ hideOnSinglePage: true }} dataSource={eventos.datos || []} loading={eventos.cargando} scroll={{ x: 950 }} columns={[
        { title: "Cliente", dataIndex: "nombre_cliente", render: (v, e) => <Link to={`/eventos/${e.id_evento}`}>{v}</Link> },
        { title: "Fecha", dataIndex: "fecha_evento_confirmada", render: formatearFecha },
        { title: "Estado", dataIndex: "estado", render: (v) => <EstadoTag estado={v} /> },
        { title: "Coordinador", dataIndex: "nombre_coordinador" },
        // Fase 11: dos indicadores y la alerta en lugar de un porcentaje
        { title: "Avance", key: "avance", render: (_, e) => <Indicadores indicadores={e} compacto /> }
      ]} />
    </Card>
    <Row gutter={[20, 20]} style={{ marginTop: 0 }}>
      <Col xs={24} xl={12}><Card title="Tareas vencidas" style={{ marginTop: 20 }}><ErrorConsulta {...tareas} />
        <Table rowKey="id_tarea" pagination={{ hideOnSinglePage: true }} dataSource={tareas.datos || []} loading={tareas.cargando} scroll={{ x: 500 }} columns={[
          { title: "Tarea", dataIndex: "descripcion", render: (v, t) => <Link to={`/eventos/${t.id_evento}`}>{v}</Link> },
          { title: "Responsable", dataIndex: "nombre_responsable" }, { title: "Días vencida", dataIndex: "dias_vencida" }
        ]} />
      </Card></Col>
      <Col xs={24} xl={12}><Card title="Servicios sin confirmar" style={{ marginTop: 20 }}><ErrorConsulta {...servicios} />
        <Table rowKey="id_servicio_x_evento" pagination={{ hideOnSinglePage: true }} dataSource={servicios.datos || []} loading={servicios.cargando} scroll={{ x: 500 }} columns={[
          { title: "Servicio", dataIndex: "nombre_servicio", render: (v, s) => <Link to={`/eventos/${s.id_evento}`}>{v}</Link> },
          { title: "Cliente", dataIndex: "nombre_cliente" }, { title: "Proveedor", dataIndex: "nombre_proveedor", render: (v) => v || "Sin asignar" },
          { title: "Estado", dataIndex: "estado_proveedor", render: (v, s) => <Space size={4} wrap><EstadoTag estado={v} />{s.a_revisar && <Tag color="orange">A revisar</Tag>}</Space> },
          { title: "Fecha", dataIndex: "fecha_evento_confirmada", render: formatearFecha }
        ]} />
      </Card></Col>
    </Row>
  </>;
}
