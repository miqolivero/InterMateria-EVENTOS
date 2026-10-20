import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { construirFiltros } from "../utils/consultas.js";

// Clientes: quien encarga el evento. Es un catalogo por empresa, asi que TODAS
// las consultas filtran por req.usuario.id_empresa, que sale del token.

// Las columnas que devolvemos, en el orden de docs/API.md. Se escriben una sola
// vez para que las 5 respuestas del recurso tengan exactamente los mismos
// campos (el front se guia por el contrato y un campo de menos le rompe la
// pantalla).
const COLUMNAS = `id_cliente, nombre, apellido, dni_cuit, email, telefono,
                  direccion, activo, fecha_alta`;

// Sobre que campos busca ?buscar, segun el contrato
const CAMPOS_BUSQUEDA = ["nombre", "apellido", "dni_cuit", "email"];

const MENSAJES = { duplicado: "Ya existe un cliente con ese DNI/CUIT" };

// El dni_cuit no tiene UNIQUE en la base (dos empresas distintas pueden tener
// al mismo cliente: son tenants separados), asi que el duplicado se valida con
// una consulta, dentro de la empresa.
// idExcluido sirve para el PUT: un cliente no choca consigo mismo.
const dniRepetido = async (dniCuit, idEmpresa, idExcluido = null) => {
  if (!dniCuit) return false;

  const resultado = await pool.query(
    `SELECT 1 FROM clientes
     WHERE dni_cuit = $1 AND id_empresa = $2
       AND ($3::int IS NULL OR id_cliente <> $3)`,
    [dniCuit, idEmpresa, idExcluido]
  );

  return resultado.rows.length > 0;
};

// GET /api/clientes?activo=true|false&buscar=texto
export const obtenerClientes = async (req, res) => {
  const { where, valores } = construirFiltros(req.query, CAMPOS_BUSQUEDA, {
    condicionesBase: ["id_empresa = $1"],
    valoresBase: [req.usuario.id_empresa]
  });

  try {
    const resultado = await pool.query(
      `SELECT ${COLUMNAS} FROM clientes ${where} ORDER BY apellido, nombre`,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/clientes/:id
export const obtenerClientePorId = async (req, res) => {
  try {
    // El filtro por empresa va en el WHERE, no en un if posterior: si el
    // cliente es de otra empresa la consulta no devuelve nada y responde 404.
    // No se revela que el registro existe.
    const resultado = await pool.query(
      `SELECT ${COLUMNAS} FROM clientes
       WHERE id_cliente = $1 AND id_empresa = $2`,
      [req.params.id, req.usuario.id_empresa]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Cliente no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/clientes
export const crearCliente = async (req, res) => {
  const { nombre, apellido, dni_cuit, email, telefono, direccion } = req.body;

  if (!nombre || !apellido) {
    return res
      .status(400)
      .json({ mensaje: "El nombre y el apellido son obligatorios" });
  }

  try {
    if (await dniRepetido(dni_cuit, req.usuario.id_empresa)) {
      return res.status(400).json({ mensaje: MENSAJES.duplicado });
    }

    // id_empresa sale del token, nunca del body: aunque alguien lo mande, se
    // ignora.
    const resultado = await pool.query(
      `INSERT INTO clientes (id_empresa, nombre, apellido, dni_cuit, email,
                             telefono, direccion)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNAS}`,
      [
        req.usuario.id_empresa,
        nombre,
        apellido,
        dni_cuit ?? null,
        email ?? null,
        telefono ?? null,
        direccion ?? null
      ]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error, MENSAJES);
  }
};

// PUT /api/clientes/:id
export const editarCliente = async (req, res) => {
  const { nombre, apellido, dni_cuit, email, telefono, direccion, activo } =
    req.body;

  if (!nombre || !apellido) {
    return res
      .status(400)
      .json({ mensaje: "El nombre y el apellido son obligatorios" });
  }

  try {
    if (
      await dniRepetido(dni_cuit, req.usuario.id_empresa, Number(req.params.id))
    ) {
      return res.status(400).json({ mensaje: MENSAJES.duplicado });
    }

    const resultado = await pool.query(
      `UPDATE clientes
       SET nombre = $1,
           apellido = $2,
           dni_cuit = $3,
           email = $4,
           telefono = $5,
           direccion = $6,
           activo = COALESCE($7, activo)
       WHERE id_cliente = $8 AND id_empresa = $9
       RETURNING ${COLUMNAS}`,
      [
        nombre,
        apellido,
        dni_cuit ?? null,
        email ?? null,
        telefono ?? null,
        direccion ?? null,
        activo ?? null,
        req.params.id,
        req.usuario.id_empresa
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Cliente no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error, MENSAJES);
  }
};

// PATCH /api/clientes/:id/activo
// Baja logica: el cliente no se borra nunca, porque tiene solicitudes y
// eventos colgando de su historial.
export const cambiarActivoCliente = async (req, res) => {
  const { activo } = req.body;

  if (typeof activo !== "boolean") {
    return res
      .status(400)
      .json({ mensaje: "El campo activo tiene que ser true o false" });
  }

  try {
    const resultado = await pool.query(
      `UPDATE clientes SET activo = $1
       WHERE id_cliente = $2 AND id_empresa = $3
       RETURNING ${COLUMNAS}`,
      [activo, req.params.id, req.usuario.id_empresa]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Cliente no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};
