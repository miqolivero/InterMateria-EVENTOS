import { Router } from "express";
import {
  obtenerEmpleados,
  obtenerEmpleadoPorId,
  crearEmpleado,
  editarEmpleado,
  cambiarActivoEmpleado,
  darAcceso
} from "../controllers/empleados.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";
import { permitirRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Empleado no encontrado"));

// index.js deja leer al admin y al coordinador (el coordinador necesita la
// lista para elegir responsables). Dar de alta, editar, dar de baja y dar
// acceso al sistema es solo del admin.
const soloAdmin = permitirRoles("admin");

router.get("/", obtenerEmpleados);
router.get("/:id", obtenerEmpleadoPorId);
router.post("/", soloAdmin, crearEmpleado);
router.put("/:id", soloAdmin, editarEmpleado);
router.patch("/:id/activo", soloAdmin, cambiarActivoEmpleado);
router.post("/:id/acceso", soloAdmin, darAcceso);

export default router;
