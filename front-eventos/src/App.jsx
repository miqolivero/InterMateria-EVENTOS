import { Routes, Route } from "react-router-dom";
import Navbar from "./componentes/Navbar";
import RutaProtegida from "./componentes/RutaProtegida";
import Empresas from "./paginas/Empresas";
import EmpresaForm from "./paginas/EmpresaForm";
import Login from "./paginas/Login";
import Registro from "./paginas/Registro";
import NoEncontrada from "./paginas/NoEncontrada";
import Clientes from "./paginas/Clientes";
import ClienteForm from "./paginas/ClienteForm";
import "./App.css";

// Las rutas del front no son las rutas de la API: aca se define que pantalla
// se muestra en cada URL del navegador.
function App() {
  return (
    <div className="app">
      <Navbar />

      <main className="app-contenido">
        <Routes>
          {/* Publicas */}
          <Route path="/" element={<Empresas />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/clientes" element={<RutaProtegida><Clientes /></RutaProtegida>} />
          <Route path="/clientes/nuevo" element={<RutaProtegida><ClienteForm /></RutaProtegida>} />
          <Route path="/clientes/:id/editar" element={<RutaProtegida><ClienteForm /></RutaProtegida>} />

          {/* Protegidas: sin token te manda al login */}
          <Route
            path="/empresas/nueva"
            element={
              <RutaProtegida>
                <EmpresaForm />
              </RutaProtegida>
            }
          />
          <Route
            path="/empresas/:id/editar"
            element={
              <RutaProtegida>
                <EmpresaForm />
              </RutaProtegida>
            }
          />

          <Route path="*" element={<NoEncontrada />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
