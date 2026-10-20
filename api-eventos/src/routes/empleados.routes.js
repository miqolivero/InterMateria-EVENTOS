import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  obtenerEmpleados,
  obtenerEmpleadoPorId,
  crearEmpleado,
  editarEmpleado,
  cambiarActivoEmpleado
} from "../controllers/empleados.controller.js";

const router = Router();

router.use(verificarToken);

router.get("/", obtenerEmpleados);
router.get("/:id", obtenerEmpleadoPorId);
router.post("/", crearEmpleado);
router.put("/:id", editarEmpleado);
router.patch("/:id/activo", cambiarActivoEmpleado);

export default router;
