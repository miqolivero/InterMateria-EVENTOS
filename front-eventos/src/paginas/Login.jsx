import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../servicios/authService";
import "./Auth.css";

function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const manejarCambio = (evento) => {
    const { name, value } = evento.target;
    setForm({ ...form, [name]: value });
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError("");

    try {
      const respuesta = await login(form.email, form.password);

      // Guardar token y usuario en el navegador.
      // El usuario es un objeto, por eso va con JSON.stringify.
      localStorage.setItem("token", respuesta.data.token);
      localStorage.setItem("usuario", JSON.stringify(respuesta.data.usuario));

      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          "No se pudo iniciar sesion. Verifica que la API este corriendo."
      );
    }
  };

  return (
    <section className="auth">
      <h1 className="auth-titulo">Iniciar sesion</h1>

      {error && <p className="auth-error">{error}</p>}

      <form className="auth-campos" onSubmit={manejarEnvio}>
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
          Ingresar
        </button>
      </form>

      <p className="auth-pie">
        No tenes cuenta? <Link to="/registro">Registrate</Link>
      </p>
    </section>
  );
}

export default Login;
