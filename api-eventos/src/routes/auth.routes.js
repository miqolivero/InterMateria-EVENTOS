import { Router } from "express";
import { login, perfil, cambiarPassword } from "../controllers/auth.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Fase 10: POST /register ya no existe. Las cuentas las crean el superadmin
// (empresa y admin) y el admin de cada empresa (su personal).
router.post("/login", login);

// Para los cuatro roles, incluido el superadmin: por eso no llevan soloEmpresa.
// El controller igual corta la sesion si la empresa esta suspendida.
router.get("/perfil", verificarToken, perfil);
router.put("/password", verificarToken, cambiarPassword);

export default router;
