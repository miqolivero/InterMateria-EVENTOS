import { Router } from "express";
import { revisarAfectado } from "../controllers/cambios.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Revision no encontrada"));

// Los tres roles. El empleado solo encuentra las revisiones de sus tareas y
// de los servicios que gestiona (el filtro va en el WHERE del controller).
// El listado cuelga del evento: GET /api/eventos/:id/revisiones
router.patch("/:id", revisarAfectado);

export default router;
