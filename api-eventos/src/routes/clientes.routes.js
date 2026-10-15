import { Router } from "express";
import pool from "../data/db.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verificarToken);

const esId = (valor) => /^[1-9]\d*$/.test(String(valor)) && Number.isSafeInteger(Number(valor));

function validar(datos) {
  if (!datos || !esId(datos.id_empresa)) return "Seleccioná una empresa válida";
  for (const [campo, limite] of Object.entries({ nombre: 150, apellido: 150, dni_cuit: 20, telefono: 30, email: 150 })) {
    const valor = datos[campo];
    if (valor != null && typeof valor !== "string") return `El campo ${campo} debe ser texto`;
    if ((campo === "nombre" || campo === "apellido") && !valor?.trim()) return "Nombre y apellido son obligatorios";
    if (valor?.trim().length > limite) return `El campo ${campo} admite hasta ${limite} caracteres`;
  }
  if (datos.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) return "El email no es válido";
  return null;
}

function responderError(error, res) {
  if (error.code === "23503") return res.status(400).json({ mensaje: "La empresa seleccionada no existe" });
  console.error("Error en clientes:", error.code || error.message);
  return res.status(500).json({ mensaje: "No se pudo completar la operación de clientes" });
}

router.get("/", async (req, res) => {
  const { id_empresa } = req.query;
  if (id_empresa !== undefined && !esId(id_empresa)) return res.status(400).json({ mensaje: "Empresa inválida" });
  try {
    const resultado = await pool.query(
      `SELECT c.*, e.nombre AS empresa_nombre FROM clientes c
       JOIN empresas e ON e.id_empresa = c.id_empresa
       ${id_empresa === undefined ? "" : "WHERE c.id_empresa = $1"}
       ORDER BY c.apellido, c.nombre, c.id`, id_empresa === undefined ? [] : [id_empresa]
    );
    res.json(resultado.rows);
  } catch (error) { responderError(error, res); }
});

router.get("/:id", async (req, res) => {
  if (!esId(req.params.id)) return res.status(400).json({ mensaje: "Identificador inválido" });
  try {
    const resultado = await pool.query("SELECT * FROM clientes WHERE id = $1", [req.params.id]);
    if (!resultado.rowCount) return res.status(404).json({ mensaje: "Cliente no encontrado" });
    res.json(resultado.rows[0]);
  } catch (error) { responderError(error, res); }
});

async function guardar(req, res, editar) {
  if (editar && !esId(req.params.id)) return res.status(400).json({ mensaje: "Identificador inválido" });
  const mensaje = validar(req.body);
  if (mensaje) return res.status(400).json({ mensaje });
  const datos = req.body;
  const valores = [datos.id_empresa, datos.nombre.trim(), datos.apellido.trim(),
    datos.dni_cuit?.trim() || null, datos.telefono?.trim() || null, datos.email?.trim() || null];
  try {
    const resultado = await pool.query(editar
      ? `UPDATE clientes SET id_empresa=$1, nombre=$2, apellido=$3, dni_cuit=$4, telefono=$5, email=$6 WHERE id=$7 RETURNING *`
      : `INSERT INTO clientes (id_empresa, nombre, apellido, dni_cuit, telefono, email) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    editar ? [...valores, req.params.id] : valores);
    if (!resultado.rowCount) return res.status(404).json({ mensaje: "Cliente no encontrado" });
    res.status(editar ? 200 : 201).json(resultado.rows[0]);
  } catch (error) { responderError(error, res); }
}

router.post("/", (req, res) => guardar(req, res, false));
router.put("/:id", (req, res) => guardar(req, res, true));

export default router;
