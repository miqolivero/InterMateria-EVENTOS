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
import { validarParamId } from "../middlewares/validarId.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Empresa no encontrada"));

// Publicas: el listado lo usa la pantalla de registro para elegir la empresa,
// cuando todavia no hay token.
router.get("/", obtenerEmpresas);
router.get("/:id", obtenerEmpresaPorId);

// Alta, edicion y baja: solo admin. Dar de alta una empresa es crear un tenant
// nuevo del sistema, no es algo que haga un usuario comun.
// El orden importa: verificarToken crea req.usuario, verificarRol lo usa.
router.post("/", verificarToken, verificarRol("admin"), crearEmpresa);
router.put("/:id", verificarToken, verificarRol("admin"), editarEmpresa);
router.delete("/:id", verificarToken, verificarRol("admin"), eliminarEmpresa);

export default router;
