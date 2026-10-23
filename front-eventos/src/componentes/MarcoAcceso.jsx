import "./MarcoAcceso.css";

// Marco de las pantallas sin menú: el login y el cambio de contraseña.
// Fase 10: ya no hay listado público de empresas, así que no hay a dónde volver.
export default function MarcoAcceso({ children, pie }) {
  return <main className="marco-acceso">
    <span className="acceso-marca">Sistema de Eventos</span>
    <section className="acceso-panel">
      <div className="acceso-formulario">{children}</div>
    </section>
    {pie}
  </main>;
}
