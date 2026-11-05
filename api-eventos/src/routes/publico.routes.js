import { Router } from "express";
import {
  obtenerPresupuestoPublico,
  responderPresupuesto
} from "../controllers/publico.controller.js";

const router = Router();

// Sin login: lo que se puede hacer con el link del presupuesto, y nada mas
router.get("/presupuestos/:token", obtenerPresupuestoPublico);
router.post("/presupuestos/:token/respuesta", responderPresupuesto);

export default router;
