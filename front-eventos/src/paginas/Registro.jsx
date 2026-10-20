import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registrar } from "../servicios/authService";
import { obtenerEmpresas } from "../servicios/empresasService";
import "./Auth.css";

function Registro() {
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    id_empresa: ""
  });
  const [empresas, setEmpresas] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // El sistema es multitenant: al registrarse hay que elegir a que empresa
  // pertenece el usuario. El listado de empresas es publico justamente para
  // poder llenar este select sin estar logueado.
  useEffect(() => {
    const cargarEmpresas = async () => {
      try {
        const respuesta = await obtenerEmpresas();
        setEmpresas(respuesta.data.filter((empresa) => empresa.activo));
      } catch {
        setError("No se pudieron cargar las empresas. Verifica que la API este corriendo.");
      }
    };

    cargarEmpresas();
  }, []);

  const manejarCambio = (evento) => {
    const { name, value } = evento.target;
    setForm({ ...form, [name]: value });
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError("");

    if (!form.nombre || !form.email || !form.password || !form.id_empresa) {
      setError("Faltan datos.");
      return;
    }

    try {
      // La API espera id_empresa como numero
      await registrar({ ...form, id_empresa: Number(form.id_empresa) });
      navigate("/login");
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          "No se pudo registrar. Verifica que la API este corriendo."
      );
    }
  };

  return (
    <section className="auth">
      <h1 className="auth-titulo">Crear cuenta</h1>

      {error && <p className="auth-error">{error}</p>}

      <form className="auth-campos" onSubmit={manejarEnvio}>
        <label className="auth-label">
          Nombre
          <input
            className="auth-input"
            type="text"
            name="nombre"
            value={form.nombre}
            onChange={manejarCambio}
          />
        </label>

        <label className="auth-label">
          Email
          <input
            className="auth-input"
            type="email"
            name="email"
            value={form.email}
            onChange={manejarCambio}
          />
        </label>

        <label className="auth-label">
          Contrasena
          <input
            className="auth-input"
            type="password"
            name="password"
            value={form.password}
            onChange={manejarCambio}
          />
        </label>

        <label className="auth-label">
          Empresa
          <select
            className="auth-input"
            name="id_empresa"
            value={form.id_empresa}
            onChange={manejarCambio}
          >
            <option value="">Elegi una empresa</option>
            {empresas.map((empresa) => (
              <option key={empresa.id_empresa} value={empresa.id_empresa}>
                {empresa.nombre}
              </option>
            ))}
          </select>
        </label>

        <button className="auth-boton" type="submit">
          Registrarme
        </button>
      </form>

      <p className="auth-pie">
        Ya tenes cuenta? <Link to="/login">Inicia sesion</Link>
      </p>
    </section>
  );
}

export default Registro;
