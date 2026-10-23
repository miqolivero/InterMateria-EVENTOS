import { Router } from "express";
import {
  obtenerSolicitudes,
  obtenerSolicitudPorId,
  crearSolicitud,
  editarSolicitud,
  cambiarEstadoSolicitud
} from "../controllers/solicitudes.controller.js";
import { crearPresupuesto } from "../controllers/presupuestos.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Solicitud no encontrada"));

// Todas las rutas piden token: de ahi sale el id_empresa con el que se
// filtran las solicitudes.

router.get("/", obtenerSolicitudes);
router.get("/:id", obtenerSolicitudPorId);
router.post("/", crearSolicitud);
router.put("/:id", editarSolicitud);

// No hay DELETE: una solicitud que no sigue se cancela o se rechaza, asi queda
// el registro de que el cliente pidio algo.
router.patch("/:id/estado", cambiarEstadoSolicitud);

// Fase 4: la version 1 del presupuesto se crea desde la solicitud. La logica
// vive en el controlador de presupuestos, que es el dueno de esa tabla.
router.post("/:id/presupuestos", crearPresupuesto);

export default router;
