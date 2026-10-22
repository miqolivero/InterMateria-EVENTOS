import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  obtenerTiposEventos,
  obtenerTipoEventoPorId,
  crearTipoEvento,
  editarTipoEvento,
  cambiarActivoTipoEvento
} from "../controllers/tiposEventos.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Tipo de evento no encontrado"));

router.use(verificarToken);

router.get("/", obtenerTiposEventos);
router.get("/:id", obtenerTipoEventoPorId);
router.post("/", crearTipoEvento);
router.put("/:id", editarTipoEvento);
router.patch("/:id/activo", cambiarActivoTipoEvento);

export default router;
