import { Router } from "express";
import { registrar, login, perfil } from "../controllers/auth.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", registrar);
router.post("/login", login);
router.get("/perfil", verificarToken, perfil);

export default router;
