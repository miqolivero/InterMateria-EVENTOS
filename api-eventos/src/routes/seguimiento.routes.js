import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  obtenerResumen,
  obtenerProximosEventos,
  obtenerTareasVencidas,
  obtenerServiciosSinConfirmar
} from "../controllers/seguimiento.controller.js";

const router = Router();

// El tablero es de la empresa del token: todas las rutas lo piden
router.use(verificarToken);

// Solo lectura: consultas agregadas sobre los eventos abiertos
router.get("/resumen", obtenerResumen);
router.get("/proximos-eventos", obtenerProximosEventos);
router.get("/tareas-vencidas", obtenerTareasVencidas);
router.get("/servicios-sin-confirmar", obtenerServiciosSinConfirmar);

export default router;
