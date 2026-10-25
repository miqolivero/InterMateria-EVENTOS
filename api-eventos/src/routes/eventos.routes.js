import { Router } from "express";
import {
  obtenerEventos,
  obtenerEventoPorId,
  editarEvento,
  iniciarPreparacion,
  obtenerServiciosDelEvento,
  cerrarEvento,
  cargarFeedback
} from "../controllers/eventos.controller.js";
import {
  obtenerTareasDelEvento,
  crearTarea
} from "../controllers/tareas.controller.js";
import { agregarServicioEvento } from "../controllers/serviciosEvento.controller.js";
import {
  obtenerCambios,
  obtenerRevisiones,
  obtenerResumenEvento
} from "../controllers/cambios.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";
import { permitirRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Evento no encontrado"));

// index.js deja entrar a admin, coordinador y empleado (Fase 11). El empleado
// solo usa estas dos, y el controller lo limita a los eventos donde tiene
// alguna tarea (si no, 404).
router.get("/:id/resumen", obtenerResumenEvento);
router.get("/:id/revisiones", obtenerRevisiones);

// Todo lo que sigue es de admin y coordinador. Va con router.use para que una
// ruta nueva que se agregue abajo nazca cerrada para el empleado.
router.use(permitirRoles("admin", "coordinador"));

// Un evento no se crea por aca: nace al aceptar un presupuesto
// (POST /api/presupuestos/:id/aceptar, ver presupuestos.routes.js).

router.get("/", obtenerEventos);
router.get("/:id", obtenerEventoPorId);

// Fase 11: un cambio registrado, con motivo
router.put("/:id", editarEvento);
router.patch("/:id/iniciar-preparacion", iniciarPreparacion);

// Lo acordado con cada proveedor. Los cambios de cada servicio van por
// /api/servicios-evento; el alta despues de confirmar, por aca.
router.get("/:id/servicios", obtenerServiciosDelEvento);
router.post("/:id/servicios", agregarServicioEvento);

// Fase 11: historial de cambios
router.get("/:id/cambios", obtenerCambios);

// Fase 6: tareas del evento (los pasos con un proveedor se generan en
// POST /api/servicios-evento/:id/generar-tareas)
router.get("/:id/tareas", obtenerTareasDelEvento);
router.post("/:id/tareas", crearTarea);

// Fase 8: cierre (realizado o cancelado) y feedback del cliente
router.patch("/:id/cerrar", cerrarEvento);
router.patch("/:id/feedback", cargarFeedback);

export default router;
