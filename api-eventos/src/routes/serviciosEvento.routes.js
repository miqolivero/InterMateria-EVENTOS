import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  actualizarServicioEvento,
  generarTareas
} from "../controllers/serviciosEvento.controller.js";

const router = Router();

// Todas las rutas piden token: la empresa del token se compara con la del
// evento al que pertenece el servicio.
router.use(verificarToken);

// El listado de los servicios de un evento esta en GET /api/eventos/:id/servicios

// Estado del proveedor, proveedor, importes y observaciones (parcial)
router.patch("/:id", actualizarServicioEvento);

// Los 4 pasos de la secuencia con el proveedor
router.post("/:id/generar-tareas", generarTareas);

export default router;
