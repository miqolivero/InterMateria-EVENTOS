import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  obtenerPresupuestoPorId,
  editarPresupuesto,
  agregarRenglon,
  editarRenglon,
  eliminarRenglon,
  presentarPresupuesto,
  crearNuevaVersion,
  rechazarPresupuesto
} from "../controllers/presupuestos.controller.js";

const router = Router();

// Todas las rutas piden token: la empresa del token es la que se compara con
// la de la solicitud del presupuesto.
router.use(verificarToken);

// La creacion de la version 1 cuelga de la solicitud:
// POST /api/solicitudes/:id/presupuestos (ver solicitudes.routes.js)

router.get("/:id", obtenerPresupuestoPorId);
router.put("/:id", editarPresupuesto);

// Renglones del detalle (solo en borrador)
router.post("/:id/detalle", agregarRenglon);
router.put("/:id/detalle/:idDetalle", editarRenglon);
router.delete("/:id/detalle/:idDetalle", eliminarRenglon);

// Cambios de estado y versiones
router.patch("/:id/presentar", presentarPresupuesto);
router.post("/:id/nueva-version", crearNuevaVersion);
router.patch("/:id/rechazar", rechazarPresupuesto);

export default router;
