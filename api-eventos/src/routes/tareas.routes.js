import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  obtenerMisTareas,
  editarTarea,
  cambiarEstadoTarea,
  eliminarTarea
} from "../controllers/tareas.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Tarea no encontrada"));

router.use(verificarToken);

// El listado y el alta de las tareas de un evento cuelgan del evento:
// GET y POST /api/eventos/:id/tareas (ver eventos.routes.js)

// Va antes que las rutas con :id para que "mias" no se tome como un id
router.get("/mias", obtenerMisTareas);

router.put("/:id", editarTarea);
router.patch("/:id/estado", cambiarEstadoTarea);

// Solo tareas libres: las de la secuencia no se borran
router.delete("/:id", eliminarTarea);

export default router;
