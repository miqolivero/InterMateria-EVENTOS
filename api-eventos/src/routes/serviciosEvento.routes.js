import { Router } from "express";
import {
  actualizarServicioEvento,
  generarTareas
} from "../controllers/serviciosEvento.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";
import { permitirRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Servicio del evento no encontrado"));

// index.js deja entrar a admin, coordinador y empleado. El empleado solo usa
// el PATCH, y el controller lo limita a los servicios donde tiene tareas.

// El listado de los servicios de un evento esta en GET /api/eventos/:id/servicios

// Estado del proveedor, proveedor, importes y observaciones (parcial)
router.patch("/:id", actualizarServicioEvento);

// Los 4 pasos de la secuencia con el proveedor
router.post("/:id/generar-tareas", permitirRoles("admin", "coordinador"), generarTareas);

export default router;
