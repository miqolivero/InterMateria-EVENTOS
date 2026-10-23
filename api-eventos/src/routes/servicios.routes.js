import { Router } from "express";
import {
  obtenerServicios,
  obtenerServicioPorId,
  crearServicio,
  editarServicio,
  cambiarActivoServicio
} from "../controllers/servicios.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Servicio no encontrado"));


router.get("/", obtenerServicios);
router.get("/:id", obtenerServicioPorId);
router.post("/", crearServicio);
router.put("/:id", editarServicio);
router.patch("/:id/activo", cambiarActivoServicio);

export default router;
