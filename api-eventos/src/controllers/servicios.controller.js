import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { construirFiltros } from "../utils/consultas.js";

// Servicios: el catalogo de lo que la empresa ofrece (catering, decoracion,
// sonido...). No es lo que presta un proveedor concreto: esa relacion esta en
// proveedores_x_servicio.

const COLUMNAS = "id_servicio, nombre, descripcion, activo";
const CAMPOS_BUSQUEDA = ["nombre", "descripcion"];
const MENSAJES = { duplicado: "Ya existe un servicio con ese nombre" };

// Unico dentro de la empresa, igual que los tipos de evento.
const nombreRepetido = async (nombre, idEmpresa, idExcluido = null) => {
  const resultado = await pool.query(
    `SELECT 1 FROM servicios
     WHERE LOWER(nombre) = LOWER($1) AND id_empresa = $2
       AND ($3::int IS NULL OR id_servicio <> $3)`,
    [nombre, idEmpresa, idExcluido]
  );

  return resultado.rows.length > 0;
};

// GET /api/servicios?activo=true|false&buscar=texto
export const obtenerServicios = async (req, res) => {
  const { where, valores } = construirFiltros(req.query, CAMPOS_BUSQUEDA, {
    condicionesBase: ["id_empresa = $1"],
    valoresBase: [req.usuario.id_empresa]
  });

  try {
    const resultado = await pool.query(
      `SELECT ${COLUMNAS} FROM servicios ${where} ORDER BY nombre`,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/servicios/:id
export const obtenerServicioPorId = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT ${COLUMNAS} FROM servicios
       WHERE id_servicio = $1 AND id_empresa = $2`,
      [req.params.id, req.usuario.id_empresa]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Servicio no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/servicios
export const crearServicio = async (req, res) => {
  const { nombre, descripcion } = req.body;

  if (!nombre) {
    return res.status(400).json({ mensaje: "El nombre es obligatorio" });
  }

  try {
    if (await nombreRepetido(nombre, req.usuario.id_empresa)) {
      return res.status(400).json({ mensaje: MENSAJES.duplicado });
    }

    const resultado = await pool.query(
      `INSERT INTO servicios (id_empresa, nombre, descripcion)
       VALUES ($1, $2, $3)
       RETURNING ${COLUMNAS}`,
      [req.usuario.id_empresa, nombre, descripcion ?? null]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error, MENSAJES);
  }
};

// PUT /api/servicios/:id
export const editarServicio = async (req, res) => {
  const { nombre, descripcion, activo } = req.body;

  if (!nombre) {
    return res.status(400).json({ mensaje: "El nombre es obligatorio" });
  }

  try {
    if (
      await nombreRepetido(nombre, req.usuario.id_empresa, Number(req.params.id))
    ) {
      return res.status(400).json({ mensaje: MENSAJES.duplicado });
    }

    const resultado = await pool.query(
      `UPDATE servicios
       SET nombre = $1,
           descripcion = $2,
           activo = COALESCE($3, activo)
       WHERE id_servicio = $4 AND id_empresa = $5
       RETURNING ${COLUMNAS}`,
      [
        nombre,
        descripcion ?? null,
        activo ?? null,
        req.params.id,
        req.usuario.id_empresa
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Servicio no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error, MENSAJES);
  }
};

// PATCH /api/servicios/:id/activo
// Baja logica: los presupuestos y los eventos ya cerrados siguen apuntando a
// este servicio, asi que borrarlo romperia el historial.
export const cambiarActivoServicio = async (req, res) => {
  const { activo } = req.body;

  if (typeof activo !== "boolean") {
    return res
      .status(400)
      .json({ mensaje: "El campo activo tiene que ser true o false" });
  }

  try {
    const resultado = await pool.query(
      `UPDATE servicios SET activo = $1
       WHERE id_servicio = $2 AND id_empresa = $3
       RETURNING ${COLUMNAS}`,
      [activo, req.params.id, req.usuario.id_empresa]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Servicio no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};
