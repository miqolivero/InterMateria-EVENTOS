import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { construirFiltros } from "../utils/consultas.js";

// Sedes: los salones donde se hacen los eventos. Es un catalogo por empresa: una
// solicitud o un evento eligen una sede de la lista, no la escriben a mano, asi
// "un salon, un evento por dia" compara el mismo registro y no dos textos.
//
// Los repetidos ("Salon Las Palmas" y "salón las palmas") los frena el indice
// uq_sedes_nombre, y responderError traduce el mensaje.

const COLUMNAS = "id_sede, nombre, direccion, activo";
const CAMPOS_BUSQUEDA = ["nombre", "direccion"];

// GET /api/sedes?activo=true|false&buscar=texto
export const obtenerSedes = async (req, res) => {
  const { where, valores } = construirFiltros(req.query, CAMPOS_BUSQUEDA, {
    condicionesBase: ["id_empresa = $1"],
    valoresBase: [req.usuario.id_empresa]
  });

  try {
    const resultado = await pool.query(
      `SELECT ${COLUMNAS} FROM sedes ${where} ORDER BY nombre`,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/sedes/:id
export const obtenerSedePorId = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT ${COLUMNAS} FROM sedes WHERE id_sede = $1 AND id_empresa = $2`,
      [req.params.id, req.usuario.id_empresa]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Sede no encontrada" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/sedes
export const crearSede = async (req, res) => {
  const { nombre, direccion } = req.body;

  if (!nombre) {
    return res.status(400).json({ mensaje: "El nombre es obligatorio" });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO sedes (id_empresa, nombre, direccion)
       VALUES ($1, $2, $3)
       RETURNING ${COLUMNAS}`,
      [req.usuario.id_empresa, nombre, direccion ?? null]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};

// PUT /api/sedes/:id
// Cambiar el nombre no reescribe lo ya acordado: cada evento conserva el nombre
// que tenia cuando se confirmo, como el resto de lo acordado con el cliente.
export const editarSede = async (req, res) => {
  const { nombre, direccion, activo } = req.body;

  if (!nombre) {
    return res.status(400).json({ mensaje: "El nombre es obligatorio" });
  }

  try {
    const resultado = await pool.query(
      `UPDATE sedes
       SET nombre = $1, direccion = $2, activo = COALESCE($3, activo)
       WHERE id_sede = $4 AND id_empresa = $5
       RETURNING ${COLUMNAS}`,
      [nombre, direccion ?? null, activo ?? null, req.params.id, req.usuario.id_empresa]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Sede no encontrada" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};

// PATCH /api/sedes/:id/activo
// Baja logica: los eventos ya confirmados siguen apuntando a la sede. Una sede
// inactiva solo deja de ofrecerse para lo nuevo.
export const cambiarActivoSede = async (req, res) => {
  const { activo } = req.body;

  if (typeof activo !== "boolean") {
    return res
      .status(400)
      .json({ mensaje: "El campo activo tiene que ser true o false" });
  }

  try {
    const resultado = await pool.query(
      `UPDATE sedes SET activo = $1
       WHERE id_sede = $2 AND id_empresa = $3
       RETURNING ${COLUMNAS}`,
      [activo, req.params.id, req.usuario.id_empresa]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Sede no encontrada" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};
