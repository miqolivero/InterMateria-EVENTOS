import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { obtenerEmpresas, eliminarEmpresa } from "../servicios/empresasService";
import { usuarioGuardado } from "../servicios/authService";
import "./Empresas.css";

function Empresas() {
  // Tres estados: mientras carga, si fallo, y los datos.
  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // Para mostrar u ocultar botones. El backend igual vuelve a controlar:
  // esconder un boton no es seguridad.
  const usuario = usuarioGuardado();
  const esAdmin = usuario?.rol === "admin";

  // El array vacio hace que se ejecute una sola vez, al montar la pantalla.
  useEffect(() => {
    const pedirEmpresas = async () => {
      try {
        const respuesta = await obtenerEmpresas();
        setEmpresas(respuesta.data);
      } catch (err) {
        setError(
          err.response
            ? "La API respondio con un error al pedir las empresas."
            : "No se pudo conectar con la API. Verifica que este corriendo en el puerto 3000."
        );
      } finally {
        setCargando(false);
      }
    };

    pedirEmpresas();
  }, []);

  const manejarBorrado = async (id, nombre) => {
    const confirmado = window.confirm(`Eliminar la empresa "${nombre}"?`);
    if (!confirmado) return;

    try {
      await eliminarEmpresa(id);
      // La API ya borro: saco la fila del estado en vez de volver a pedir todo.
      setEmpresas(empresas.filter((empresa) => empresa.id_empresa !== id));
    } catch (err) {
      if (err.response?.status === 403) {
        setError("Solo un administrador puede eliminar empresas.");
      } else if (err.response?.status === 404) {
        setError("Esa empresa ya no existe.");
      } else {
        setError("No se pudo eliminar la empresa.");
      }
    }
  };

  if (cargando) {
    return <p className="empresas-mensaje">Cargando empresas...</p>;
  }

  return (
    <section className="empresas">
      <div className="empresas-encabezado">
        <h1 className="empresas-titulo">Empresas</h1>
        {usuario && (
          <Link className="empresas-nueva" to="/empresas/nueva">
            Nueva empresa
          </Link>
        )}
      </div>

      {error && <p className="empresas-error">{error}</p>}

      {!usuario && (
        <p className="empresas-aviso">
          El listado es publico. Para crear o editar empresas hay que{" "}
          <Link to="/login">iniciar sesion</Link>.
        </p>
      )}

      {empresas.length === 0 ? (
        <p className="empresas-mensaje">Todavia no hay empresas cargadas.</p>
      ) : (
        <table className="empresas-tabla">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>CUIT</th>
              <th>Email</th>
              <th>Telefono</th>
              {usuario && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {empresas.map((empresa) => (
              <tr key={empresa.id_empresa}>
                <td>{empresa.id_empresa}</td>
                <td>{empresa.nombre}</td>
                <td>{empresa.cuit}</td>
                <td>{empresa.email || "-"}</td>
                <td>{empresa.telefono || "-"}</td>
                {usuario && (
                  <td className="empresas-acciones">
                    <Link
                      className="empresas-editar"
                      to={`/empresas/${empresa.id_empresa}/editar`}
                    >
                      Editar
                    </Link>
                    {esAdmin && (
                      <button
                        className="empresas-eliminar"
                        type="button"
                        onClick={() =>
                          manejarBorrado(empresa.id_empresa, empresa.nombre)
                        }
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default Empresas;
