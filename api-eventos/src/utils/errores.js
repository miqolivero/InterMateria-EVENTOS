// Helper comun para responder los errores de PostgreSQL.
//
// Por que existe: los 5 recursos de catalogos tienen 5 endpoints cada uno, y
// todos terminan en el mismo catch. Sin esto, el mismo bloque se repetiria 25
// veces y cualquier cambio de criterio habria que hacerlo 25 veces.
//
// Traduce el codigo de error de pg al codigo HTTP que corresponde segun
// docs/API.md. Los mensajes puntuales los pasa cada controlador, porque son
// propios del recurso ("Ya existe un cliente con ese DNI/CUIT").

export const responderError = (res, error, mensajes = {}) => {
  // 23505 = violacion de UNIQUE. Es un dato repetido, culpa de quien manda el
  // request: va como 400, igual que en empresas.
  if (error.code === "23505") {
    return res.status(400).json({
      mensaje: mensajes.duplicado ?? "Ya existe un registro con esos datos"
    });
  }

  // 23503 = violacion de FOREIGN KEY. El registro tiene datos asociados, asi
  // que no se puede borrar: 409, no 400, porque el pedido es valido pero
  // choca con el estado actual de la base.
  if (error.code === "23503") {
    return res.status(409).json({
      mensaje:
        mensajes.asociado ??
        "El registro tiene datos asociados y no se puede eliminar"
    });
  }

  // Cualquier otra cosa es un problema nuestro, no de quien pide. No se
  // devuelve el detalle del error de la base: eso es informacion interna.
  console.error(error);
  return res.status(500).json({ mensaje: "Error interno del servidor" });
};
