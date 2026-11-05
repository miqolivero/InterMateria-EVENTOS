import { Router } from "express";
import {
  obtenerTareas,
  obtenerMisTareas,
  obtenerHistorialTarea,
  editarTarea,
  cambiarEstadoTarea,
  eliminarTarea
} from "../controllers/tareas.controller.js";
import { datosTarea } from "../middlewares/datos.middleware.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";
import { permitirRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Tarea no encontrada"));

// index.js deja entrar a admin, coordinador y empleado. El empleado solo usa
// "mis tareas" y el cambio de estado, y el controller lo limita a SUS tareas.
const operacion = permitirRoles("admin", "coordinador");

// El listado y el alta de las tareas de un evento cuelgan del evento:
// GET y POST /api/eventos/:id/tareas (ver eventos.routes.js)

// Va antes que las rutas con :id para que "mias" no se tome como un id
router.get("/mias", obtenerMisTareas);

// Todas las de la empresa: el empleado ve solo las suyas, con "mias"
router.get("/", operacion, obtenerTareas);

router.put("/:id", operacion, datosTarea, editarTarea);
router.patch("/:id/estado", cambiarEstadoTarea);
router.get("/:id/historial", obtenerHistorialTarea);

// Solo tareas libres: las de la secuencia no se borran
router.delete("/:id", operacion, eliminarTarea);

export default router;
