import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Statistic } from "antd";
import { BankOutlined, CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, PauseCircleOutlined, TeamOutlined } from "@ant-design/icons";
import { resumenSistema } from "../../servicios/superadminService.js";
import { useConsulta } from "../../contexto/useConsulta.js";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import ErrorConsulta from "../../componentes/ErrorConsulta";
import "./superadmin.css";

const indicadores = [
  ["empresas_activas", "Empresas activas", <BankOutlined key="i" />],
  ["empresas_suspendidas", "Empresas suspendidas", <PauseCircleOutlined key="i" />],
  ["usuarios_activos", "Usuarios activos", <TeamOutlined key="i" />],
  ["eventos_abiertos", "Eventos abiertos", <CalendarOutlined key="i" />],
  ["eventos_proximos_30_dias", "Eventos en los próximos 30 días", <ClockCircleOutlined key="i" />],
  ["eventos_realizados", "Eventos realizados", <CheckCircleOutlined key="i" />]
];

// Inicio del superadmin: solo cantidades de todo el sistema. Por privacidad no
// hay acá ningún cliente, evento ni tarea de las empresas.
export default function ResumenSistema() {
  const consulta = useConsulta(useCallback(async () => (await resumenSistema()).data, []));
  return <>
    <EncabezadoPagina titulo="Resumen del sistema" descripcion="Métricas de todas las empresas."
      acciones={<Link to="/superadmin/empresas"><Button type="primary">Ver empresas</Button></Link>} />
    <ErrorConsulta {...consulta} />
    <div className="indicadores-sistema">
      {indicadores.map(([clave, titulo, icono]) => <Card key={clave} loading={consulta.cargando}>
        <Statistic title={titulo} value={consulta.datos?.[clave] ?? 0} prefix={icono} />
      </Card>)}
    </div>
    <Alert type="info" showIcon title="El panel muestra cantidades, no datos operativos."
      description="Los clientes, solicitudes, eventos y tareas de cada empresa son de esa empresa. Para ayudar a un usuario, usá el soporte de usuarios dentro de cada empresa." />
  </>;
}
