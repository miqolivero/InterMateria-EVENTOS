import { Router } from "express";
import {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  editarUsuario,
  cambiarActivoUsuario,
  resetearPasswordUsuario
} from "../controllers/usuarios.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Usuario no encontrado"));

// Solo el admin llega aca: lo controla index.js para todo el grupo
router.get("/", obtenerUsuarios);
router.get("/:id", obtenerUsuarioPorId);
router.post("/", crearUsuario);
router.put("/:id", editarUsuario);
router.patch("/:id/activo", cambiarActivoUsuario);
router.put("/:id/password", resetearPasswordUsuario);

export default router;
