import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { obtenerEmpresas, eliminarEmpresa } from "../servicios/axiosConfig";
import "./Empresas.css";

function Empresas() {
  // Tres estados: mientras carga, si fallo, y los datos.
  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

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
      if (err.response && err.response.status === 404) {
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
        <Link className="empresas-nueva" to="/empresas/nueva">
          Nueva empresa
        </Link>
      </div>

      {error && <p className="empresas-error">{error}</p>}

      {empresas.length === 0 ? (
        <p className="empresas-mensaje">
          Todavia no hay empresas cargadas.
        </p>
      ) : (
        <table className="empresas-tabla">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>CUIT</th>
              <th>Email</th>
              <th>Telefono</th>
              <th>Acciones</th>
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
                <td className="empresas-acciones">
                  <Link
                    className="empresas-editar"
                    to={`/empresas/${empresa.id_empresa}/editar`}
                  >
                    Editar
                  </Link>
                  <button
                    className="empresas-eliminar"
                    type="button"
                    onClick={() =>
                      manejarBorrado(empresa.id_empresa, empresa.nombre)
                    }
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default Empresas;
