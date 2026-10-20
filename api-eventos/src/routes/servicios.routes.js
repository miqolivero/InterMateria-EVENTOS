import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  obtenerServicios,
  obtenerServicioPorId,
  crearServicio,
  editarServicio,
  cambiarActivoServicio
} from "../controllers/servicios.controller.js";

const router = Router();

router.use(verificarToken);

router.get("/", obtenerServicios);
router.get("/:id", obtenerServicioPorId);
router.post("/", crearServicio);
router.put("/:id", editarServicio);
router.patch("/:id/activo", cambiarActivoServicio);

export default router;
