import { Router } from "express";
import {
  verificarToken,
  verificarRol
} from "../middlewares/auth.middleware.js";
import {
  obtenerEmpresas,
  obtenerEmpresaPorId,
  crearEmpresa,
  editarEmpresa,
  eliminarEmpresa
} from "../controllers/empresas.controller.js";

const router = Router();

// Publicas: cualquiera puede ver
router.get("/", obtenerEmpresas);
router.get("/:id", obtenerEmpresaPorId);

// Protegidas: hay que estar logueado
router.post("/", verificarToken, crearEmpresa);
router.put("/:id", verificarToken, editarEmpresa);

// Solo admin. El orden importa: verificarToken crea req.usuario, verificarRol lo usa.
router.delete("/:id", verificarToken, verificarRol("admin"), eliminarEmpresa);

export default router;
