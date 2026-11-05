// Helper comun para responder los errores de PostgreSQL.
//
// Por que existe: los 5 recursos de catalogos tienen 5 endpoints cada uno, y
// todos terminan en el mismo catch. Sin esto, el mismo bloque se repetiria 25
// veces y cualquier cambio de criterio habria que hacerlo 25 veces.
//
// Traduce el codigo de error de pg al codigo HTTP que corresponde segun
// docs/API.md. Los mensajes puntuales los pasa cada controlador, porque son
// propios del recurso ("Ya existe un cliente con ese DNI/CUIT").

// Que dato se repitio, segun el indice unico de la base que salto. Es la red
// que aguanta dos pedidos simultaneos: ningun SELECT previo puede garantizarlo.
const MENSAJES_INDICE = {
  uq_clientes_documento: "Ya existe un cliente con ese DNI/CUIT",
  uq_proveedores_cuit: "Ya existe un proveedor con ese CUIT",
  uq_proveedores_razon_social: "Ya existe un proveedor con esa razon social",
  uq_servicios_nombre: "Ya existe un servicio con ese nombre",
  uq_tipos_eventos_nombre: "Ya existe un tipo de evento con ese nombre",
  uq_empleados_legajo: "Ya existe un empleado con ese legajo",
  uq_usuarios_email: "El email ya esta registrado",
  uq_empresas_cuit: "Ya existe una empresa con ese cuit",
  uq_empresas_nombre: "Ya existe una empresa con ese nombre",
  uq_solicitudes_abiertas: "El cliente ya tiene una solicitud de ese tipo para esa fecha",
  uq_detalle_renglon: "Ese renglon ya esta en el presupuesto",
  uq_servicio_evento_acordado: "Ese servicio ya esta acordado en el evento",
  uq_tareas_libres: "Ya existe esa tarea, con el mismo responsable y la misma fecha",
  uq_sedes_nombre: "Ya existe una sede con ese nombre"
};

export const responderError = (res, error, mensajes = {}) => {
  // 23505 = violacion de UNIQUE. Es un dato repetido, culpa de quien manda el
  // request: va como 400, igual que en empresas.
  if (error.code === "23505") {
    return res.status(400).json({
      mensaje: MENSAJES_INDICE[error.constraint] ?? mensajes.duplicado ?? "Ya existe un registro con esos datos"
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

  // Errores de formato: un dato del request que la base no puede convertir al
  // tipo de la columna. Los controladores validan los campos principales antes
  // de llegar aca; esto es la red de seguridad para el resto, y es culpa de
  // quien pide, no nuestra: 400, nunca 500.
  //   22P02 = texto invalido para el tipo ("abc" en un INTEGER o un BOOLEAN)
  //   22003 = numero fuera de rango (no entra en INTEGER o en NUMERIC(12,2))
  //   22007 / 22008 = fecha con formato invalido o inexistente
  //   22001 = texto mas largo que la columna (un cuit de 20 caracteres)
  if (["22P02", "22003", "22007", "22008", "22001"].includes(error.code)) {
    return res.status(400).json({ mensaje: "Hay datos con un formato invalido" });
  }

  // Cualquier otra cosa es un problema nuestro, no de quien pide. No se
  // devuelve el detalle del error de la base: eso es informacion interna.
  console.error(error);
  return res.status(500).json({ mensaje: "Error interno del servidor" });
};
