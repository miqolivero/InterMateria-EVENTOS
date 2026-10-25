import { Router } from "express";
import {
  modificarServicioEvento,
  cambiarProveedor,
  cancelarServicio,
  cambiarEstadoProveedor,
  generarTareas
} from "../controllers/serviciosEvento.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";
import { permitirRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Servicio del evento no encontrado"));

// index.js deja entrar a admin, coordinador y empleado. El empleado solo usa
// el seguimiento del proveedor (/estado), y el controller lo limita a los
// servicios donde tiene tareas.
router.patch("/:id/estado", cambiarEstadoProveedor);

// Todo lo que sigue es de admin y coordinador. Va con router.use para que una
// ruta nueva que se agregue abajo nazca cerrada para el empleado.
router.use(permitirRoles("admin", "coordinador"));

// El listado de los servicios de un evento y el alta de uno nuevo cuelgan del
// evento: GET y POST /api/eventos/:id/servicios

// Cambios de lo acordado (Fase 11): con motivo y registrados en el historial.
// El PATCH /:id de la Fase 6 ya no existe: se reparte entre estos y /estado.
router.put("/:id", modificarServicioEvento);
router.put("/:id/proveedor", cambiarProveedor);
router.patch("/:id/cancelar", cancelarServicio);

// Los pasos elegidos con el proveedor
router.post("/:id/generar-tareas", generarTareas);

export default router;
