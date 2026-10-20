import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  obtenerEventos,
  obtenerEventoPorId,
  editarEvento,
  iniciarPreparacion,
  obtenerServiciosDelEvento
} from "../controllers/eventos.controller.js";

const router = Router();

// Todas las rutas piden token: de ahi sale el id_empresa de los eventos.
router.use(verificarToken);

// Un evento no se crea por aca: nace al aceptar un presupuesto
// (POST /api/presupuestos/:id/aceptar, ver presupuestos.routes.js).

router.get("/", obtenerEventos);
router.get("/:id", obtenerEventoPorId);
router.put("/:id", editarEvento);
router.patch("/:id/iniciar-preparacion", iniciarPreparacion);

// Lo acordado con cada proveedor (solo lectura en esta fase)
router.get("/:id/servicios", obtenerServiciosDelEvento);

export default router;
