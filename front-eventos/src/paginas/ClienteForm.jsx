import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { obtenerEmpresas } from "../servicios/empresasService";
import { obtenerCliente, crearCliente, actualizarCliente } from "../servicios/clientesService";
import "./EmpresaForm.css";

const vacio = { id_empresa: "", nombre: "", apellido: "", dni_cuit: "", telefono: "", email: "" };
const campos = [
  ["nombre", "Nombre", 150, true], ["apellido", "Apellido", 150, true],
  ["dni_cuit", "DNI / CUIT", 20, false], ["telefono", "Teléfono", 30, false], ["email", "Email", 150, false]
];

export default function ClienteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(vacio);
  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [falloCarga, setFalloCarga] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    Promise.all([obtenerEmpresas(), id ? obtenerCliente(id) : Promise.resolve(null)])
      .then(([lista, cliente]) => {
        if (!vigente) return;
        setEmpresas(lista.data);
        setForm(cliente ? Object.fromEntries(Object.keys(vacio).map((key) => [key, cliente.data[key] ?? ""])) : vacio);
      }).catch((err) => {
        if (!vigente) return;
        setFalloCarga(true);
        setError(err.response?.data?.mensaje || "No se pudieron cargar los datos del formulario.");
      }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [id]);

  async function guardar(evento) {
    evento.preventDefault();
    if (guardando) return;
    if (!form.id_empresa || !form.nombre.trim() || !form.apellido.trim()) {
      setError("Empresa, nombre y apellido son obligatorios."); return;
    }
    setGuardando(true); setError("");
    try {
      if (id) await actualizarCliente(id, form); else await crearCliente(form);
      navigate("/clientes");
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo guardar el cliente.");
      setGuardando(false);
    }
  }

  if (cargando) return <p role="status">Cargando formulario...</p>;
  return <section className="formulario">
    <h1 className="formulario-titulo">{id ? "Editar cliente" : "Nuevo cliente"}</h1>
    {error && <p className="formulario-error" role="alert">{error}</p>}
    {!falloCarga && empresas.length === 0 && <p>Primero necesitás <Link to="/empresas/nueva">crear una empresa</Link>.</p>}
    {!falloCarga && empresas.length > 0 && <form className="formulario-campos" onSubmit={guardar}>
      <label className="formulario-label">Empresa *
        <select className="formulario-input" required value={form.id_empresa} disabled={guardando}
          onChange={(e) => setForm({ ...form, id_empresa: e.target.value })}>
          <option value="">Seleccioná una empresa</option>
          {empresas.map((e) => <option value={e.id_empresa} key={e.id_empresa}>{e.nombre}</option>)}
        </select>
      </label>
      {campos.map(([name, label, maxLength, required]) => <label className="formulario-label" key={name}>
        {label}{required ? " *" : ""}
        <input className="formulario-input" name={name} type={name === "email" ? "email" : name === "telefono" ? "tel" : "text"}
          required={required} maxLength={maxLength} value={form[name]} disabled={guardando}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
      </label>)}
      <div className="formulario-acciones">
        <button className="formulario-guardar" type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</button>
        <Link className="formulario-cancelar" to="/clientes">Cancelar</Link>
      </div>
    </form>}
    {falloCarga && <Link to="/clientes">Volver a clientes</Link>}
  </section>;
}
