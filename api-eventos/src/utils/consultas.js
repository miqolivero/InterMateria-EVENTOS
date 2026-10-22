// Helpers para armar consultas. Los usan los 5 recursos de catalogos, que
// comparten el mismo patron de listado (?activo y ?buscar) y la misma necesidad
// de verificar que un id sea de la empresa del usuario.

// Arma el WHERE de un listado a partir de los query params del contrato.
//
// - condicionesBase / valoresBase: lo que el controlador ya trae armado,
//   normalmente el filtro por empresa. Van primero para que la numeracion de
//   los $1, $2... quede consistente.
// - camposBusqueda: sobre que columnas aplica ?buscar (cada recurso define las
//   suyas en docs/API.md).
// - columnaActivo: en empleados el activo es el del vinculo (exe.activo), no el
//   de la tabla principal, asi que se puede cambiar.
//
// Devuelve el fragmento de SQL y el array de valores, siempre parametrizado:
// nunca se concatena nada que venga del request.
export const construirFiltros = (
  query,
  camposBusqueda,
  { condicionesBase = [], valoresBase = [], columnaActivo = "activo" } = {}
) => {
  const condiciones = [...condicionesBase];
  const valores = [...valoresBase];

  // Sin ?activo el listado devuelve todos (activos e inactivos)
  if (query.activo === "true" || query.activo === "false") {
    valores.push(query.activo === "true");
    condiciones.push(`${columnaActivo} = $${valores.length}`);
  }

  // ILIKE = LIKE sin distinguir mayusculas. El % lo pone el valor, no el SQL.
  if (query.buscar) {
    valores.push(`%${query.buscar}%`);
    const indice = valores.length;
    const busqueda = camposBusqueda
      .map((campo) => `${campo} ILIKE $${indice}`)
      .join(" OR ");
    condiciones.push(`(${busqueda})`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

  return { where, valores };
};

// Verifica que un registro exista Y sea de la empresa indicada.
//
// Se usa cuando llega el id de otra tabla en el body (por ejemplo el
// id_servicio de un proveedor): sin esto, alguien podria asociar datos de su
// empresa con registros de otra.
//
// ejecutor es el pool o un client de transaccion, asi sirve en los dos casos.
//
// soloActivos: para dar de alta algo nuevo (una solicitud, por ejemplo) no
// alcanza con que el registro sea de la empresa, tambien tiene que estar
// activo. Un cliente dado de baja conserva su historial, pero no recibe
// pedidos nuevos.
//
// tabla y columnaId los escribe siempre el controlador, nunca vienen del
// request: por eso se pueden interpolar sin riesgo de inyeccion.
export const existeEnEmpresa = async (
  ejecutor,
  tabla,
  columnaId,
  id,
  idEmpresa,
  { soloActivos = false } = {}
) => {
  const filtroActivo = soloActivos ? "AND activo = TRUE" : "";

  const resultado = await ejecutor.query(
    `SELECT 1 FROM ${tabla}
     WHERE ${columnaId} = $1 AND id_empresa = $2 ${filtroActivo}`,
    [id, idEmpresa]
  );

  return resultado.rows.length > 0;
};

// Verifica que un empleado trabaje HOY en la empresa: el vinculo
// (empleados_x_empresa) tiene que estar activo, y el empleado tambien.
//
// No alcanza con existeEnEmpresa porque los empleados no tienen id_empresa:
// la relacion es N:M con historial. Se usa para el coordinador de un evento y
// para el responsable de una tarea (regla 9 de CLAUDE.md).
export const esEmpleadoActivo = async (ejecutor, idEmpleado, idEmpresa) => {
  const resultado = await ejecutor.query(
    `SELECT 1 FROM empleados_x_empresa exe
     JOIN empleados e ON e.id_empleado = exe.id_empleado
     WHERE exe.id_empleado = $1 AND exe.id_empresa = $2
       AND exe.activo = TRUE AND e.activo = TRUE`,
    [idEmpleado, idEmpresa]
  );

  return resultado.rows.length > 0;
};
