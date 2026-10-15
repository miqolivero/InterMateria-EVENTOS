import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { obtenerClientes } from "../servicios/clientesService";
import { obtenerEmpresas } from "../servicios/empresasService";
import "./Empresas.css";
import "./Clientes.css";

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [empresa, setEmpresa] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    obtenerEmpresas().then(({ data }) => { if (vigente) setEmpresas(data); })
      .catch(() => { if (vigente) setError("No se pudieron cargar las empresas."); });
    return () => { vigente = false; };
  }, []);

  useEffect(() => {
    let vigente = true;
    obtenerClientes(empresa).then(({ data }) => { if (vigente) setClientes(data); })
      .catch(() => { if (vigente) setError("No se pudieron cargar los clientes. Intentá nuevamente."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [empresa]);

  return <section>
    <div className="empresas-encabezado">
      <h1 className="empresas-titulo">Clientes</h1>
      <Link className="empresas-nueva" to="/clientes/nuevo">Nuevo cliente</Link>
    </div>
    <label className="clientes-filtro">Empresa
      <select value={empresa} onChange={(e) => { setCargando(true); setError(""); setEmpresa(e.target.value); }}>
        <option value="">Todas las empresas</option>
        {empresas.map((e) => <option key={e.id_empresa} value={e.id_empresa}>{e.nombre}</option>)}
      </select>
    </label>
    {error && <p className="empresas-error" role="alert">{error}</p>}
    {cargando ? <p className="empresas-mensaje" role="status">Cargando clientes...</p> : !error && (
      clientes.length === 0 ? <p className="empresas-mensaje">Todavía no hay clientes para esta selección.</p> :
        <div className="clientes-tabla"><table className="empresas-tabla">
          <thead><tr><th>Cliente</th><th>Empresa</th><th>DNI / CUIT</th><th>Teléfono</th><th>Email</th><th>Acciones</th></tr></thead>
          <tbody>{clientes.map((c) => <tr key={c.id}>
            <td>{c.apellido}, {c.nombre}</td><td>{c.empresa_nombre}</td><td>{c.dni_cuit || "—"}</td>
            <td>{c.telefono || "—"}</td><td>{c.email || "—"}</td>
            <td><Link className="empresas-editar" to={`/clientes/${c.id}/editar`}>Editar</Link></td>
          </tr>)}</tbody>
        </table></div>
    )}
  </section>;
}
