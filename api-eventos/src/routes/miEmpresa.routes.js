import { Router } from "express";
import { obtenerMiEmpresa, editarMiEmpresa } from "../controllers/miEmpresa.controller.js";
import { permitirRoles } from "../middlewares/auth.middleware.js";
import { datosEmpresa } from "../middlewares/datos.middleware.js";

const router = Router();

// index.js deja entrar a los tres roles de empresa; editar es solo del admin
router.get("/", obtenerMiEmpresa);
router.put("/", permitirRoles("admin"), datosEmpresa, editarMiEmpresa);

export default router;
