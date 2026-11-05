import { Router } from "express";
import {
  obtenerSedes,
  obtenerSedePorId,
  crearSede,
  editarSede,
  cambiarActivoSede
} from "../controllers/sedes.controller.js";
import { datosSede } from "../middlewares/datos.middleware.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Sede no encontrada"));

router.get("/", obtenerSedes);
router.get("/:id", obtenerSedePorId);
router.post("/", datosSede, crearSede);
router.put("/:id", datosSede, editarSede);
router.patch("/:id/activo", cambiarActivoSede);

export default router;
