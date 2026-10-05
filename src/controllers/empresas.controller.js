import pool from "../data/db.js";

// GET /api/empresas
export const obtenerEmpresas = async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM empresas ORDER BY id_empresa"
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener las empresas" });
  }
};

// GET /api/empresas/:id
export const obtenerEmpresaPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const resultado = await pool.query(
      "SELECT * FROM empresas WHERE id_empresa = $1",
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Empresa no encontrada" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener la empresa" });
  }
};

// POST /api/empresas
export const crearEmpresa = async (req, res) => {
  const { nombre, cuit, email, telefono, direccion } = req.body;

  if (!nombre || !cuit) {
    return res
      .status(400)
      .json({ mensaje: "El nombre y el cuit son obligatorios" });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO empresas (nombre, cuit, email, telefono, direccion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nombre, cuit, email ?? null, telefono ?? null, direccion ?? null]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    // 23505 = violacion de UNIQUE (el cuit ya existe)
    if (error.code === "23505") {
      return res
        .status(400)
        .json({ mensaje: "Ya existe una empresa con ese cuit" });
    }
    res.status(500).json({ mensaje: "Error al crear la empresa" });
  }
};

// PUT /api/empresas/:id
export const editarEmpresa = async (req, res) => {
  const { id } = req.params;
  const { nombre, cuit, email, telefono, direccion, activo } = req.body;

  if (!nombre || !cuit) {
    return res
      .status(400)
      .json({ mensaje: "El nombre y el cuit son obligatorios" });
  }

  try {
    const resultado = await pool.query(
      `UPDATE empresas
       SET nombre = $1,
           cuit = $2,
           email = $3,
           telefono = $4,
           direccion = $5,
           activo = COALESCE($6, activo)
       WHERE id_empresa = $7
       RETURNING *`,
      [
        nombre,
        cuit,
        email ?? null,
        telefono ?? null,
        direccion ?? null,
        activo ?? null,
        id
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Empresa no encontrada" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(400)
        .json({ mensaje: "Ya existe una empresa con ese cuit" });
    }
    res.status(500).json({ mensaje: "Error al editar la empresa" });
  }
};

// DELETE /api/empresas/:id
export const eliminarEmpresa = async (req, res) => {
  const { id } = req.params;

  try {
    const resultado = await pool.query(
      "DELETE FROM empresas WHERE id_empresa = $1 RETURNING *",
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Empresa no encontrada" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar la empresa" });
  }
};
