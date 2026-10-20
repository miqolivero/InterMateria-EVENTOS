import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  obtenerTiposEventos,
  obtenerTipoEventoPorId,
  crearTipoEvento,
  editarTipoEvento,
  cambiarActivoTipoEvento
} from "../controllers/tiposEventos.controller.js";

const router = Router();

router.use(verificarToken);

router.get("/", obtenerTiposEventos);
router.get("/:id", obtenerTipoEventoPorId);
router.post("/", crearTipoEvento);
router.put("/:id", editarTipoEvento);
router.patch("/:id/activo", cambiarActivoTipoEvento);

export default router;
