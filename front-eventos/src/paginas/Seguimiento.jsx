import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Col, Row, Segmented, Space, Table, Tag } from "antd";
import { CalendarOutlined, ClockCircleOutlined, ExclamationCircleOutlined, FileTextOutlined, MinusCircleOutlined, SyncOutlined, WarningOutlined } from "@ant-design/icons";
import { resumenSeguimiento, proximosEventos, tareasVencidas, serviciosSinConfirmar } from "../servicios/operacionService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { formatearFecha } from "../utils/formato.js";
import { ordenFecha } from "../utils/tablas.js";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import ErrorConsulta from "../componentes/ErrorConsulta";
import EstadoTag from "../componentes/EstadoTag";
import Indicadores from "../componentes/Indicadores";
import TarjetaDato from "../componentes/TarjetaDato";
import ProximoEvento from "../componentes/ProximoEvento";
import dayjs from "dayjs";

// Lleva a una lista de esta misma pantalla
const irA = (id) => () => document.getElementById(id)?.scrollIntoView({
  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

export default function Seguimiento() {
  const [dias, setDias] = useState(30);
  // Consultas independientes: un panel con error no oculta los demás resultados.
  const resumen = useConsulta(useCallback(async () => (await resumenSeguimiento(dias)).data, [dias]));
  const eventos = useConsulta(useCallback(async () => (await proximosEventos(dias)).data, [dias]));
  const tareas = useConsulta(useCallback(async () => (await tareasVencidas(dias)).data, [dias]));
  const servicios = useConsulta(useCallback(async () => (await serviciosSinConfirmar(dias)).data, [dias]));
  return <>
    <EncabezadoPagina titulo="Seguimiento" acciones={<Space wrap><Link to="/eventos?vista=estado"><Button>Eventos por estado</Button></Link>
      <Segmented value={dias} onChange={setDias} options={[{ value: 7, label: "7 días" }, { value: 15, label: "15 días" }, { value: 30, label: "30 días" }, { value: 365, label: "1 año" }]} /></Space>} />
    <ProximoEvento />
    <ErrorConsulta {...resumen} />
    <div className="indicadores-seguimiento">{[
      // Cada tarjeta lleva a donde están las filas que cuenta, con la misma ventana de días
      ["Eventos próximos", "eventos_proximos", "azul", <CalendarOutlined key="i" />, { alTocar: irA("lista-proximos") }],
      ["Tareas vencidas", "tareas_vencidas", "rojo", <WarningOutlined key="i" />, { a: `/tareas?estado=vencida&dias=${dias}` }],
      ["Tareas pendientes", "tareas_pendientes", "ambar", <ClockCircleOutlined key="i" />, { a: `/tareas?estado=sin_completar&dias=${dias}` }],
      ["No realizadas", "tareas_sin_realizar", "gris", <MinusCircleOutlined key="i" />, { a: `/tareas?estado=sin_realizar&dias=${dias}` }],
      ["Servicios sin confirmar", "servicios_sin_confirmar", "turquesa", <SyncOutlined key="i" />, { alTocar: irA("lista-sin-confirmar") }],
      ["A revisar", "pendientes_revision", "naranja", <ExclamationCircleOutlined key="i" />, { alTocar: irA("lista-proximos") }],
      ["Solicitudes pendientes", "solicitudes_pendientes", "marino", <FileTextOutlined key="i" />, { a: `/solicitudes?estado=pendiente&hasta=${dayjs().add(dias, "day").format("YYYY-MM-DD")}` }]
    ].map(([titulo, campo, tono, icono, destino], orden) => <TarjetaDato key={campo} titulo={titulo} tono={tono} icono={icono} orden={orden} {...destino}
      cargando={resumen.cargando} valor={resumen.datos?.[campo] ?? "—"} />)}</div>
    <Card id="lista-proximos" title="Próximos eventos" className="tarjeta-entrada" style={{ "--orden": 4 }}><ErrorConsulta {...eventos} />
      <Table rowKey="id_evento" pagination={{ hideOnSinglePage: true }} dataSource={eventos.datos || []} loading={eventos.cargando} scroll={{ x: 950 }} columns={[
        { title: "Cliente", dataIndex: "nombre_cliente", render: (v, e) => <Link to={`/eventos/${e.id_evento}`}>{v}</Link> },
        { title: "Fecha", dataIndex: "fecha_evento_confirmada", render: formatearFecha, ...ordenFecha("fecha_evento_confirmada") },
        { title: "Estado", dataIndex: "estado", render: (v) => <EstadoTag estado={v} /> },
        { title: "Coordinador", dataIndex: "nombre_coordinador" },
        // Fase 11: dos indicadores y la alerta en lugar de un porcentaje
        { title: "Avance", key: "avance", render: (_, e) => <Indicadores indicadores={e} compacto /> }
      ]} />
    </Card>
    <Row gutter={[20, 20]} style={{ marginTop: 0 }}>
      <Col xs={24} xl={12}><Card title="Tareas vencidas" className="tarjeta-entrada" style={{ marginTop: 20, "--orden": 6 }}><ErrorConsulta {...tareas} />
        <Table rowKey="id_tarea" pagination={{ hideOnSinglePage: true }} dataSource={tareas.datos || []} loading={tareas.cargando} scroll={{ x: 500 }} columns={[
          { title: "Tarea", dataIndex: "descripcion", render: (v, t) => <Link to={`/eventos/${t.id_evento}`}>{v}</Link> },
          { title: "Responsable", dataIndex: "nombre_responsable" }, { title: "Días vencida", dataIndex: "dias_vencida", sorter: (a, b) => a.dias_vencida - b.dias_vencida }
        ]} />
      </Card></Col>
      <Col xs={24} xl={12}><Card id="lista-sin-confirmar" title="Servicios sin confirmar" className="tarjeta-entrada" style={{ marginTop: 20, "--orden": 7 }}><ErrorConsulta {...servicios} />
        <Table rowKey="id_servicio_x_evento" pagination={{ hideOnSinglePage: true }} dataSource={servicios.datos || []} loading={servicios.cargando} scroll={{ x: 500 }} columns={[
          { title: "Servicio", dataIndex: "nombre_servicio", render: (v, s) => <Link to={`/eventos/${s.id_evento}`}>{v}</Link> },
          { title: "Cliente", dataIndex: "nombre_cliente" }, { title: "Proveedor", dataIndex: "nombre_proveedor", render: (v) => v || "Sin asignar" },
          { title: "Estado", dataIndex: "estado_proveedor", render: (v, s) => <Space size={4} wrap><EstadoTag estado={v} />{s.a_revisar && <Tag color="orange">A revisar</Tag>}</Space> },
          { title: "Fecha", dataIndex: "fecha_evento_confirmada", render: formatearFecha, ...ordenFecha("fecha_evento_confirmada") }
        ]} />
      </Card></Col>
    </Row>
  </>;
}
