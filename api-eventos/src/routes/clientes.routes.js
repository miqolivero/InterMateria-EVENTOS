import { Router } from "express";
import {
  obtenerClientes,
  obtenerClientePorId,
  crearCliente,
  editarCliente,
  cambiarActivoCliente
} from "../controllers/clientes.controller.js";
import { validarParamId } from "../middlewares/validarId.middleware.js";

const router = Router();

// Un :id con formato invalido es un registro que no existe: 404
router.param("id", validarParamId("Cliente no encontrado"));

// Todas las rutas del recurso piden token: de ahi sale el id_empresa con el
// que se filtran los datos. Se aplica una sola vez para todo el router.

router.get("/", obtenerClientes);
router.get("/:id", obtenerClientePorId);
router.post("/", crearCliente);
router.put("/:id", editarCliente);

// No hay DELETE: la baja es logica (ver docs/API.md)
router.patch("/:id/activo", cambiarActivoCliente);

export default router;
