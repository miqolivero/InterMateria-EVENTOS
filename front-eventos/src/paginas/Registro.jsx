import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registrar } from "../servicios/authService";
import "./Auth.css";

function Registro() {
  const [form, setForm] = useState({ nombre: "", email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const manejarCambio = (evento) => {
    const { name, value } = evento.target;
    setForm({ ...form, [name]: value });
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError("");

    if (!form.nombre || !form.email || !form.password) {
      setError("Faltan datos.");
      return;
    }

    try {
      await registrar(form);
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
