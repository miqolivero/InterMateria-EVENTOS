import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { construirFiltros } from "../utils/consultas.js";

// Tipos de evento: cumpleanos, casamiento, egresados... Catalogo por empresa,
// asi que cada una arma su propia lista.

const COLUMNAS = "id_tipo_evento, nombre, descripcion, activo";
const CAMPOS_BUSQUEDA = ["nombre"];
const MENSAJES = { duplicado: "Ya existe un tipo de evento con ese nombre" };

// El nombre no tiene UNIQUE en la base porque solo tiene que ser unico DENTRO
// de la empresa: dos empresas pueden tener su propio "Casamiento". Por eso el
// duplicado se valida con una consulta y no con el error 23505.
const nombreRepetido = async (nombre, idEmpresa, idExcluido = null) => {
  const resultado = await pool.query(
    `SELECT 1 FROM tipos_eventos
     WHERE LOWER(nombre) = LOWER($1) AND id_empresa = $2
       AND ($3::int IS NULL OR id_tipo_evento <> $3)`,
    [nombre, idEmpresa, idExcluido]
  );

  return resultado.rows.length > 0;
};

// GET /api/tipos-eventos?activo=true|false&buscar=texto
export const obtenerTiposEventos = async (req, res) => {
  const { where, valores } = construirFiltros(req.query, CAMPOS_BUSQUEDA, {
    condicionesBase: ["id_empresa = $1"],
    valoresBase: [req.usuario.id_empresa]
  });

  try {
    const resultado = await pool.query(
      `SELECT ${COLUMNAS} FROM tipos_eventos ${where} ORDER BY nombre`,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/tipos-eventos/:id
export const obtenerTipoEventoPorId = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT ${COLUMNAS} FROM tipos_eventos
       WHERE id_tipo_evento = $1 AND id_empresa = $2`,
      [req.params.id, req.usuario.id_empresa]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Tipo de evento no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/tipos-eventos
export const crearTipoEvento = async (req, res) => {
  const { nombre, descripcion } = req.body;

  if (!nombre) {
    return res.status(400).json({ mensaje: "El nombre es obligatorio" });
  }

  try {
    if (await nombreRepetido(nombre, req.usuario.id_empresa)) {
      return res.status(400).json({ mensaje: MENSAJES.duplicado });
    }

    const resultado = await pool.query(
      `INSERT INTO tipos_eventos (id_empresa, nombre, descripcion)
       VALUES ($1, $2, $3)
       RETURNING ${COLUMNAS}`,
      [req.usuario.id_empresa, nombre, descripcion ?? null]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error, MENSAJES);
  }
};

// PUT /api/tipos-eventos/:id
export const editarTipoEvento = async (req, res) => {
  const { nombre, descripcion, activo } = req.body;

  if (!nombre) {
    return res.status(400).json({ mensaje: "El nombre es obligatorio" });
  }

  try {
    if (
      await nombreRepetido(
        nombre,
        req.usuario.id_empresa,
        Number(req.params.id)
      )
    ) {
      return res.status(400).json({ mensaje: MENSAJES.duplicado });
    }

    const resultado = await pool.query(
      `UPDATE tipos_eventos
       SET nombre = $1,
           descripcion = $2,
           activo = COALESCE($3, activo)
       WHERE id_tipo_evento = $4 AND id_empresa = $5
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
      return res.status(404).json({ mensaje: "Tipo de evento no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error, MENSAJES);
  }
};

// PATCH /api/tipos-eventos/:id/activo
// Baja logica: las solicitudes viejas siguen apuntando a este tipo de evento.
export const cambiarActivoTipoEvento = async (req, res) => {
  const { activo } = req.body;

  if (typeof activo !== "boolean") {
    return res
      .status(400)
      .json({ mensaje: "El campo activo tiene que ser true o false" });
  }

  try {
    const resultado = await pool.query(
      `UPDATE tipos_eventos SET activo = $1
       WHERE id_tipo_evento = $2 AND id_empresa = $3
       RETURNING ${COLUMNAS}`,
      [activo, req.params.id, req.usuario.id_empresa]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Tipo de evento no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};
