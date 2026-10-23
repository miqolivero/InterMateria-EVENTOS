import { Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Spin } from "antd";
import RutaProtegida from "./componentes/RutaProtegida";
import { useSesion } from "./contexto/useSesion";
import { EMPLEADO, SUPERADMIN } from "./utils/menu";
import "./App.css";

// La tabla y las herramientas de cada pantalla se descargan cuando se necesitan.
const LayoutPrincipal = lazy(() => import("./componentes/LayoutPrincipal"));
const LayoutSuperadmin = lazy(() => import("./componentes/LayoutSuperadmin"));
const LayoutEmpleado = lazy(() => import("./componentes/LayoutEmpleado"));
const Login = lazy(() => import("./paginas/Login"));
const CambiarPassword = lazy(() => import("./paginas/CambiarPassword"));
const NoEncontrada = lazy(() => import("./paginas/NoEncontrada"));
const Catalogo = lazy(() => import("./paginas/Catalogo"));
const Catalogos = lazy(() => import("./paginas/Catalogo").then((m) => ({ default: m.Catalogos })));
const Solicitudes = lazy(() => import("./paginas/Solicitudes"));
const SolicitudDetalle = lazy(() => import("./paginas/Solicitudes").then((m) => ({ default: m.SolicitudDetalle })));
const Presupuesto = lazy(() => import("./paginas/Presupuesto"));
const Eventos = lazy(() => import("./paginas/Eventos"));
const EventoDetalle = lazy(() => import("./paginas/Eventos").then((m) => ({ default: m.EventoDetalle })));
const MisTareas = lazy(() => import("./componentes/TareasEvento").then((m) => ({ default: m.MisTareas })));
const MisTareasEmpleado = lazy(() => import("./paginas/MisTareasEmpleado"));
const Seguimiento = lazy(() => import("./paginas/Seguimiento"));
const Usuarios = lazy(() => import("./paginas/Usuarios"));
const MiEmpresa = lazy(() => import("./paginas/MiEmpresa"));
const ResumenSistema = lazy(() => import("./paginas/superadmin/ResumenSistema"));
const EmpresasSistema = lazy(() => import("./paginas/superadmin/EmpresasSistema"));
const EmpresaSistema = lazy(() => import("./paginas/superadmin/EmpresaSistema"));

// Fase 10: tres layouts según el rol del login. Las rutas son las mismas para
// todos; RutaProtegida lleva a cada rol a su inicio si entra a una que no es suya.
function LayoutSegunRol() {
  const { usuario } = useSesion();
  if (usuario.rol === SUPERADMIN) return <LayoutSuperadmin />;
  if (usuario.rol === EMPLEADO) return <LayoutEmpleado />;
  return <LayoutPrincipal />;
}

// "Mis tareas" del empleado es su panel de trabajo, pensado para el celular.
// Admin y coordinador conservan la tabla de siempre.
function MisTareasSegunRol() {
  const { usuario } = useSesion();
  return usuario.rol === EMPLEADO ? <MisTareasEmpleado /> : <MisTareas />;
}

export default function App() {
  return <Suspense fallback={<div className="pantalla-espera"><Spin size="large" /><p>Cargando tu espacio…</p></div>}><Routes>
    <Route path="/login" element={<Login />} />
    {/* Sin layout: si la contraseña es obligatoria, no se muestra ningún menú */}
    <Route path="/cambiar-password" element={<RutaProtegida><CambiarPassword /></RutaProtegida>} />
    <Route element={<RutaProtegida><LayoutSegunRol /></RutaProtegida>}>
      <Route path="/superadmin" element={<ResumenSistema />} />
      <Route path="/superadmin/empresas" element={<EmpresasSistema />} />
      <Route path="/superadmin/empresas/:id" element={<EmpresaSistema />} />
      <Route path="/seguimiento" element={<Seguimiento />} />
      <Route path="/mis-tareas" element={<MisTareasSegunRol />} />
      <Route path="/solicitudes" element={<Solicitudes />} />
      <Route path="/solicitudes/:id" element={<SolicitudDetalle />} />
      <Route path="/presupuestos/:id" element={<Presupuesto />} />
      <Route path="/eventos" element={<Eventos />} />
      <Route path="/eventos/:id" element={<EventoDetalle />} />
      <Route path="/clientes" element={<Catalogo recurso="clientes" />} />
      <Route path="/catalogos" element={<Catalogos />} />
      <Route path="/personal" element={<Catalogo recurso="empleados" />} />
      <Route path="/usuarios" element={<Usuarios />} />
      <Route path="/mi-empresa" element={<MiEmpresa />} />
      <Route path="*" element={<NoEncontrada />} />
    </Route>
  </Routes></Suspense>;
}
