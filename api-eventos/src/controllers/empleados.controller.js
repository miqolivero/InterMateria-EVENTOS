import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { construirFiltros } from "../utils/consultas.js";

// Empleados: el personal de la empresa.
//
// Este recurso es distinto a los otros catalogos porque la tabla empleados NO
// tiene id_empresa: el vinculo esta en empleados_x_empresa, que guarda el
// historial (cargo, fecha_inicio, fecha_fin). Por eso:
//   - el filtro multitenant va por el JOIN, no por un WHERE id_empresa;
//   - el "activo" que ve el front es el del VINCULO, no el de la tabla
//     empleados (asi un empleado puede estar inactivo en una empresa y activo
//     en otra);
//   - crear y editar tocan dos tablas, asi que van en una transaccion.

const CAMPOS_BUSQUEDA = ["e.nombre", "e.apellido", "e.legajo"];
const MENSAJES = { duplicado: "Ya existe un empleado con ese legajo" };

// El JOIN es lo que hace el filtro por empresa: un empleado de otra empresa no
// aparece, y el endpoint responde 404 sin revelar que existe.
const SELECT_EMPLEADO = `
  SELECT e.id_empleado, e.legajo, e.nombre, e.apellido, e.rol,
         e.telefono, e.email,
         exe.cargo, exe.fecha_inicio, exe.fecha_fin, exe.activo
  FROM empleados e
  JOIN empleados_x_empresa exe ON exe.id_empleado = e.id_empleado`;

const buscarEmpleado = async (ejecutor, idEmpleado, idEmpresa) => {
  const resultado = await ejecutor.query(
    `${SELECT_EMPLEADO} WHERE e.id_empleado = $1 AND exe.id_empresa = $2`,
    [idEmpleado, idEmpresa]
  );

  return resultado.rows[0] ?? null;
};

// GET /api/empleados?activo=true|false&buscar=texto
export const obtenerEmpleados = async (req, res) => {
  const { where, valores } = construirFiltros(req.query, CAMPOS_BUSQUEDA, {
    condicionesBase: ["exe.id_empresa = $1"],
    valoresBase: [req.usuario.id_empresa],
    // El activo del vinculo, no el de la tabla empleados
    columnaActivo: "exe.activo"
  });

  try {
    const resultado = await pool.query(
      `${SELECT_EMPLEADO} ${where} ORDER BY e.apellido, e.nombre`,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/empleados/:id
export const obtenerEmpleadoPorId = async (req, res) => {
  try {
    const empleado = await buscarEmpleado(
      pool,
      req.params.id,
      req.usuario.id_empresa
    );

    if (!empleado) {
      return res.status(404).json({ mensaje: "Empleado no encontrado" });
    }

    res.json(empleado);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/empleados
// Crea el empleado y su vinculo con la empresa del usuario, en una sola
// transaccion: un empleado sin vinculo no lo veria nadie (el listado va por el
// JOIN), asi que quedaria invisible y huerfano.
export const crearEmpleado = async (req, res) => {
  const {
    legajo,
    nombre,
    apellido,
    rol,
    email,
    telefono,
    cargo,
    fecha_inicio
  } = req.body;

  if (!legajo || !nombre || !apellido) {
    return res
      .status(400)
      .json({ mensaje: "El legajo, el nombre y el apellido son obligatorios" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const empleado = await client.query(
      `INSERT INTO empleados (legajo, nombre, apellido, rol, email, telefono)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_empleado`,
      [
        legajo,
        nombre,
        apellido,
        rol ?? null,
        email ?? null,
        telefono ?? null
      ]
    );

    const idEmpleado = empleado.rows[0].id_empleado;

    // Si fecha_inicio no viene, la base pone CURRENT_DATE (lo dice el
    // contrato), por eso se manda null y se resuelve con COALESCE.
    await client.query(
      `INSERT INTO empleados_x_empresa (id_empleado, id_empresa, cargo,
                                        fecha_inicio)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE))`,
      [idEmpleado, req.usuario.id_empresa, cargo ?? null, fecha_inicio ?? null]
    );

    const creado = await buscarEmpleado(
      client,
      idEmpleado,
      req.usuario.id_empresa
    );

    await client.query("COMMIT");

    res.status(201).json(creado);
  } catch (error) {
    await client.query("ROLLBACK");
    // El legajo SI tiene UNIQUE en la base (es unico en todo el sistema), asi
    // que el duplicado llega como 23503/23505 y lo traduce el helper.
    responderError(res, error, MENSAJES);
  } finally {
    client.release();
  }
};

// PUT /api/empleados/:id
// El objeto del contrato mezcla campos de las dos tablas: legajo, nombre,
// apellido, rol, email y telefono son del empleado; cargo y fecha_inicio son
// del vinculo. Por eso el PUT actualiza las dos en una transaccion.
export const editarEmpleado = async (req, res) => {
  const {
    legajo,
    nombre,
    apellido,
    rol,
    email,
    telefono,
    cargo,
    fecha_inicio
  } = req.body;

  if (!legajo || !nombre || !apellido) {
    return res
      .status(400)
      .json({ mensaje: "El legajo, el nombre y el apellido son obligatorios" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Primero se comprueba que el empleado sea de esta empresa. Sin esto se
    // podrian editar los datos de un empleado de otra empresa, porque la tabla
    // empleados es compartida.
    const existente = await buscarEmpleado(
      client,
      req.params.id,
      req.usuario.id_empresa
    );

    if (!existente) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: "Empleado no encontrado" });
    }

    await client.query(
      `UPDATE empleados
       SET legajo = $1, nombre = $2, apellido = $3,
           rol = $4, email = $5, telefono = $6
       WHERE id_empleado = $7`,
      [
        legajo,
        nombre,
        apellido,
        rol ?? null,
        email ?? null,
        telefono ?? null,
        req.params.id
      ]
    );

    await client.query(
      `UPDATE empleados_x_empresa
       SET cargo = $1,
           fecha_inicio = COALESCE($2::date, fecha_inicio)
       WHERE id_empleado = $3 AND id_empresa = $4`,
      [cargo ?? null, fecha_inicio ?? null, req.params.id, req.usuario.id_empresa]
    );

    const actualizado = await buscarEmpleado(
      client,
      req.params.id,
      req.usuario.id_empresa
    );

    await client.query("COMMIT");

    res.json(actualizado);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error, MENSAJES);
  } finally {
    client.release();
  }
};

// PATCH /api/empleados/:id/activo
// La baja cierra el vinculo: activo = false y fecha_fin = hoy. Reactivar lo
// vuelve a abrir (fecha_fin = null). El empleado nunca se borra, porque quedan
// tareas y eventos a su nombre.
export const cambiarActivoEmpleado = async (req, res) => {
  const { activo } = req.body;

  if (typeof activo !== "boolean") {
    return res
      .status(400)
      .json({ mensaje: "El campo activo tiene que ser true o false" });
  }

  try {
    // activo y fecha_fin se mueven juntos, en un solo UPDATE: no pueden quedar
    // en estados contradictorios (inactivo sin fecha de salida).
    const actualizado = await pool.query(
      `UPDATE empleados_x_empresa
       SET activo = $1,
           fecha_fin = CASE WHEN $1 THEN NULL ELSE CURRENT_DATE END
       WHERE id_empleado = $2 AND id_empresa = $3
       RETURNING id_empleado`,
      [activo, req.params.id, req.usuario.id_empresa]
    );

    if (actualizado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Empleado no encontrado" });
    }

    const empleado = await buscarEmpleado(
      pool,
      req.params.id,
      req.usuario.id_empresa
    );

    res.json(empleado);
  } catch (error) {
    responderError(res, error);
  }
};
