import { Router } from "express";
import {
  obtenerResumen,
  obtenerEmpresas,
  obtenerEmpresaPorId,
  crearEmpresa,
  editarEmpresa,
  cambiarActivoEmpresa,
  eliminarEmpresa,
  crearUsuarioDeEmpresa,
  actualizarUsuarioDeEmpresa,
  resetearPasswordDeEmpresa
} from "../controllers/superadmin.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Empresa no encontrada"));
router.param("idUsuario", validarParamId("Usuario no encontrado"));

// Solo el superadmin llega aca: lo controla index.js (soloSuperadmin)
router.get("/resumen", obtenerResumen);

router.get("/empresas", obtenerEmpresas);
router.get("/empresas/:id", obtenerEmpresaPorId);
router.post("/empresas", crearEmpresa);
router.put("/empresas/:id", editarEmpresa);
router.patch("/empresas/:id/activo", cambiarActivoEmpresa);
router.delete("/empresas/:id", eliminarEmpresa);

// Soporte: los usuarios de cada empresa
router.post("/empresas/:id/usuarios", crearUsuarioDeEmpresa);
router.patch("/empresas/:id/usuarios/:idUsuario", actualizarUsuarioDeEmpresa);
router.put("/empresas/:id/usuarios/:idUsuario/password", resetearPasswordDeEmpresa);

export default router;
