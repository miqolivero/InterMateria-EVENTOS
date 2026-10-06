import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  obtenerEmpresa,
  crearEmpresa,
  actualizarEmpresa
} from "../servicios/axiosConfig";
import "./EmpresaForm.css";

const FORMULARIO_VACIO = {
  nombre: "",
  cuit: "",
  email: "",
  telefono: "",
  direccion: ""
};

// El mismo componente sirve para crear y para editar: si la URL trae un id,
// pide esa empresa y carga el formulario con sus datos.
function EmpresaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);

  const [empresa, setEmpresa] = useState(FORMULARIO_VACIO);
  const [cargando, setCargando] = useState(editando);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!editando) return;

    const pedirEmpresa = async () => {
      try {
        const respuesta = await obtenerEmpresa(id);
        const datos = respuesta.data;
        setEmpresa({
          nombre: datos.nombre ?? "",
          cuit: datos.cuit ?? "",
          email: datos.email ?? "",
          telefono: datos.telefono ?? "",
          direccion: datos.direccion ?? ""
        });
      } catch (err) {
        if (err.response && err.response.status === 404) {
          setError("No existe una empresa con ese id.");
        } else {
          setError("No se pudo cargar la empresa.");
        }
      } finally {
        setCargando(false);
      }
    };

    pedirEmpresa();
  }, [id, editando]);

  const manejarCambio = (evento) => {
    const { name, value } = evento.target;
    setEmpresa({ ...empresa, [name]: value });
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError("");

    // Validacion en el front: evita un viaje a la API que ya sabemos que falla.
    // La API igual valida de nuevo, no se confia en el navegador.
    if (!empresa.nombre.trim() || !empresa.cuit.trim()) {
      setError("El nombre y el cuit son obligatorios.");
      return;
    }

    setGuardando(true);

    try {
      if (editando) {
        await actualizarEmpresa(id, empresa);
      } else {
        await crearEmpresa(empresa);
      }
      navigate("/");
    } catch (err) {
      if (err.response && err.response.status === 400) {
        setError(err.response.data.mensaje || "Los datos enviados no son validos.");
      } else if (err.response && err.response.status === 404) {
        setError("Esa empresa ya no existe.");
      } else if (err.response) {
        setError("La API respondio con un error al guardar.");
      } else {
        setError("No se pudo conectar con la API.");
      }
      setGuardando(false);
    }
  };

  if (cargando) {
    return <p className="formulario-mensaje">Cargando empresa...</p>;
  }

  return (
    <section className="formulario">
      <h1 className="formulario-titulo">
        {editando ? "Editar empresa" : "Nueva empresa"}
      </h1>

      {error && <p className="formulario-error">{error}</p>}

      <form className="formulario-campos" onSubmit={manejarEnvio}>
        <label className="formulario-label">
          Nombre *
          <input
            className="formulario-input"
            type="text"
            name="nombre"
            value={empresa.nombre}
            onChange={manejarCambio}
            maxLength={150}
          />
        </label>

        <label className="formulario-label">
          CUIT *
          <input
            className="formulario-input"
            type="text"
            name="cuit"
            value={empresa.cuit}
            onChange={manejarCambio}
            maxLength={13}
            placeholder="30-71234567-8"
          />
        </label>

        <label className="formulario-label">
          Email
          <input
            className="formulario-input"
            type="email"
            name="email"
            value={empresa.email}
            onChange={manejarCambio}
            maxLength={150}
          />
        </label>

        <label className="formulario-label">
          Telefono
          <input
            className="formulario-input"
            type="text"
            name="telefono"
            value={empresa.telefono}
            onChange={manejarCambio}
            maxLength={30}
          />
        </label>

        <label className="formulario-label">
          Direccion
          <input
            className="formulario-input"
            type="text"
            name="direccion"
            value={empresa.direccion}
            onChange={manejarCambio}
            maxLength={200}
          />
        </label>

        <div className="formulario-acciones">
          <button
            className="formulario-guardar"
            type="submit"
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
          <Link className="formulario-cancelar" to="/">
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}

export default EmpresaForm;
