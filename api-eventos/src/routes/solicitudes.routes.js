import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  obtenerSolicitudes,
  obtenerSolicitudPorId,
  crearSolicitud,
  editarSolicitud,
  cambiarEstadoSolicitud
} from "../controllers/solicitudes.controller.js";

const router = Router();

// Todas las rutas piden token: de ahi sale el id_empresa con el que se
// filtran las solicitudes.
router.use(verificarToken);

router.get("/", obtenerSolicitudes);
router.get("/:id", obtenerSolicitudPorId);
router.post("/", crearSolicitud);
router.put("/:id", editarSolicitud);

// No hay DELETE: una solicitud que no sigue se cancela o se rechaza, asi queda
// el registro de que el cliente pidio algo.
router.patch("/:id/estado", cambiarEstadoSolicitud);

export default router;
