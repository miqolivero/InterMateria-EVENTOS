import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  obtenerProveedores,
  obtenerProveedorPorId,
  crearProveedor,
  editarProveedor,
  cambiarActivoProveedor,
  obtenerServiciosDelProveedor,
  reemplazarServiciosDelProveedor
} from "../controllers/proveedores.controller.js";

const router = Router();

router.use(verificarToken);

router.get("/", obtenerProveedores);

// Las rutas de /servicios van ANTES de /:id a proposito. Express toma la
// primera que coincide, y aunque en este caso no se pisan, dejarlas arriba
// evita sorpresas si mas adelante se agrega algo como /:id/algo.
router.get("/:id/servicios", obtenerServiciosDelProveedor);
router.put("/:id/servicios", reemplazarServiciosDelProveedor);

router.get("/:id", obtenerProveedorPorId);
router.post("/", crearProveedor);
router.put("/:id", editarProveedor);
router.patch("/:id/activo", cambiarActivoProveedor);

export default router;
