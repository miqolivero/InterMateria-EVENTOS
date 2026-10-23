import { Router } from "express";
import { obtenerMiEmpresa, editarMiEmpresa } from "../controllers/miEmpresa.controller.js";
import { permitirRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// index.js deja entrar a los tres roles de empresa; editar es solo del admin
router.get("/", obtenerMiEmpresa);
router.put("/", permitirRoles("admin"), editarMiEmpresa);

export default router;
