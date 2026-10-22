import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Spin } from "antd";
import RutaProtegida from "./componentes/RutaProtegida";
import "./App.css";

// La tabla y las herramientas de cada pantalla se descargan cuando se necesitan.
const LayoutPrincipal = lazy(() => import("./componentes/LayoutPrincipal"));
const Empresas = lazy(() => import("./paginas/Empresas"));
const EmpresaForm = lazy(() => import("./paginas/EmpresaForm"));
const Login = lazy(() => import("./paginas/Login"));
const Registro = lazy(() => import("./paginas/Registro"));
const NoEncontrada = lazy(() => import("./paginas/NoEncontrada"));
const Catalogo = lazy(() => import("./paginas/Catalogo"));
const Catalogos = lazy(() => import("./paginas/Catalogo").then((m) => ({ default: m.Catalogos })));
const Solicitudes = lazy(() => import("./paginas/Solicitudes"));
const SolicitudDetalle = lazy(() => import("./paginas/Solicitudes").then((m) => ({ default: m.SolicitudDetalle })));
const Presupuesto = lazy(() => import("./paginas/Presupuesto"));
const Eventos = lazy(() => import("./paginas/Eventos"));
const EventoDetalle = lazy(() => import("./paginas/Eventos").then((m) => ({ default: m.EventoDetalle })));
const MisTareas = lazy(() => import("./componentes/TareasEvento").then((m) => ({ default: m.MisTareas })));
const Seguimiento = lazy(() => import("./paginas/Seguimiento"));

export default function App() {
  return <Suspense fallback={<div className="pantalla-espera"><Spin size="large" /><p>Cargando tu espacio…</p></div>}><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/registro" element={<Registro />} />
    <Route element={<RutaProtegida><LayoutPrincipal /></RutaProtegida>}>
      <Route path="/" element={<Navigate to="/seguimiento" replace />} />
      <Route path="/empresas" element={<Empresas />} />
      <Route path="/empresas/nueva" element={<RutaProtegida soloAdmin><EmpresaForm /></RutaProtegida>} />
      <Route path="/empresas/:id/editar" element={<RutaProtegida soloAdmin><EmpresaForm /></RutaProtegida>} />
      <Route path="/seguimiento" element={<Seguimiento />} />
      <Route path="/mis-tareas" element={<MisTareas />} />
      <Route path="/solicitudes" element={<Solicitudes />} />
      <Route path="/solicitudes/:id" element={<SolicitudDetalle />} />
      <Route path="/presupuestos/:id" element={<Presupuesto />} />
      <Route path="/eventos" element={<Eventos />} />
      <Route path="/eventos/:id" element={<EventoDetalle />} />
      <Route path="/clientes" element={<Catalogo recurso="clientes" />} />
      <Route path="/catalogos" element={<Catalogos />} />
      <Route path="/personal" element={<Catalogo recurso="empleados" />} />
      <Route path="*" element={<NoEncontrada />} />
    </Route>
  </Routes></Suspense>;
}
