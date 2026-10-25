import { Router } from "express";
import {
  obtenerResumen,
  obtenerProximosEventos,
  obtenerTareasVencidas,
  obtenerServiciosSinConfirmar,
  obtenerPorEstado
} from "../controllers/seguimiento.controller.js";

const router = Router();

// El tablero es de la empresa del token: todas las rutas lo piden

// Solo lectura: consultas agregadas sobre los eventos abiertos
router.get("/resumen", obtenerResumen);
router.get("/proximos-eventos", obtenerProximosEventos);
router.get("/tareas-vencidas", obtenerTareasVencidas);
router.get("/servicios-sin-confirmar", obtenerServiciosSinConfirmar);

// Fase 11: solicitudes y eventos juntos, cada uno con su situacion
router.get("/por-estado", obtenerPorEstado);

export default router;
