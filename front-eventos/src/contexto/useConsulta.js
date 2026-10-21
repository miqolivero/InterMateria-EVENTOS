import { useEffect, useState } from "react";

// Cada consulta identifica su resultado. Una respuesta vieja no pisa una ruta nueva.
export function useConsulta(consultar) {
  const [revision, setRevision] = useState(0);
  const [resultado, setResultado] = useState(null);
  useEffect(() => {
    let vigente = true;
    Promise.resolve().then(consultar)
      .then((datos) => { if (vigente) setResultado({ consultar, revision, datos, error: null }); })
      .catch((error) => { if (vigente) setResultado({ consultar, revision, datos: null, error }); });
    return () => { vigente = false; };
  }, [consultar, revision]);
  const actualizado = resultado?.consultar === consultar && resultado.revision === revision;
  return { datos: actualizado ? resultado.datos : null, error: actualizado ? resultado.error : null,
    cargando: !actualizado, recargar: () => setRevision((actual) => actual + 1) };
}
