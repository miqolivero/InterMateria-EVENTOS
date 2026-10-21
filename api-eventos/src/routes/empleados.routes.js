import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  obtenerEmpleados,
  obtenerEmpleadoPorId,
  crearEmpleado,
  editarEmpleado,
  cambiarActivoEmpleado
} from "../controllers/empleados.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Empleado no encontrado"));

router.use(verificarToken);

router.get("/", obtenerEmpleados);
router.get("/:id", obtenerEmpleadoPorId);
router.post("/", crearEmpleado);
router.put("/:id", editarEmpleado);
router.patch("/:id/activo", cambiarActivoEmpleado);

export default router;
