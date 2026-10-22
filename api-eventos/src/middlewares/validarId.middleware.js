import { esIdValido } from "../utils/validaciones.js";

// Valida un parametro de la URL (:id, :idDetalle) antes de que llegue al
// controlador. Se engancha con router.param("id", validarParamId("..."))
// en cada router.
//
// Por que: si llega /clientes/abc o /clientes/99999999999, PostgreSQL no puede
// convertir el valor a INTEGER y la consulta falla (500). Un id con formato
// invalido es un id que no existe, asi que se responde el mismo 404 que el
// recurso usa cuando no encuentra el registro: el front no tiene que
// distinguir los dos casos.
export const validarParamId = (mensaje) => (req, res, next, valor) => {
  if (!esIdValido(valor)) {
    return res.status(404).json({ mensaje });
  }
  next();
};
