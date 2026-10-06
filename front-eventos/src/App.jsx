import { Routes, Route } from "react-router-dom";
import Navbar from "./componentes/Navbar";
import Empresas from "./paginas/Empresas";
import EmpresaForm from "./paginas/EmpresaForm";
import NoEncontrada from "./paginas/NoEncontrada";
import "./App.css";

// Las rutas del front no son las rutas de la API: aca se define que pantalla
// se muestra en cada URL del navegador.
function App() {
  return (
    <div className="app">
      <Navbar />

      <main className="app-contenido">
        <Routes>
          <Route path="/" element={<Empresas />} />
          <Route path="/empresas/nueva" element={<EmpresaForm />} />
          <Route path="/empresas/:id/editar" element={<EmpresaForm />} />
          <Route path="*" element={<NoEncontrada />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
