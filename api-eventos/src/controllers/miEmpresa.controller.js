import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";

// Mi empresa (Fase 10): los datos de la empresa del token, y nada mas.
// No recibe ningun id: no hay forma de pedir los datos de otra empresa.

const SELECT_MI_EMPRESA = `
  SELECT id_empresa, nombre, cuit, email, telefono, direccion, fecha_creacion
  FROM empresas
  WHERE id_empresa = $1`;

// GET /api/mi-empresa  (admin, coordinador y empleado)
export const obtenerMiEmpresa = async (req, res) => {
  try {
    const resultado = await pool.query(SELECT_MI_EMPRESA, [req.usuario.id_empresa]);
    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};

// PUT /api/mi-empresa  (solo admin)
// El cuit no se toca aunque venga en el body: identifica a la empresa ante el
// sistema y solo lo corrige el superadmin. El activo tampoco: una empresa no
// se puede reactivar sola.
export const editarMiEmpresa = async (req, res) => {
  const { nombre, email, telefono, direccion } = req.body ?? {};

  if (typeof nombre !== "string" || nombre.trim() === "") {
    return res.status(400).json({ mensaje: "El nombre es obligatorio" });
  }

  try {
    await pool.query(
      `UPDATE empresas SET nombre = $1, email = $2, telefono = $3, direccion = $4
       WHERE id_empresa = $5`,
      [nombre.trim(), email ?? null, telefono ?? null, direccion ?? null, req.usuario.id_empresa]
    );

    const resultado = await pool.query(SELECT_MI_EMPRESA, [req.usuario.id_empresa]);
    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};
