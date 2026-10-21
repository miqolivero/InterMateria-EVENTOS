import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
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

const router = Router();

// Todas las rutas piden token: de ahi sale el id_empresa de los eventos.
router.use(verificarToken);

// Un evento no se crea por aca: nace al aceptar un presupuesto
// (POST /api/presupuestos/:id/aceptar, ver presupuestos.routes.js).

router.get("/", obtenerEventos);
router.get("/:id", obtenerEventoPorId);
router.put("/:id", editarEvento);
router.patch("/:id/iniciar-preparacion", iniciarPreparacion);

// Lo acordado con cada proveedor (se editan en /api/servicios-evento)
router.get("/:id/servicios", obtenerServiciosDelEvento);

// Fase 6: tareas del evento (las de la secuencia se generan en
// POST /api/servicios-evento/:id/generar-tareas)
router.get("/:id/tareas", obtenerTareasDelEvento);
router.post("/:id/tareas", crearTarea);

// Fase 8: cierre (realizado o cancelado) y feedback del cliente
router.patch("/:id/cerrar", cerrarEvento);
router.patch("/:id/feedback", cargarFeedback);

export default router;
