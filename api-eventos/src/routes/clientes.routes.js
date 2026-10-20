import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import {
  obtenerClientes,
  obtenerClientePorId,
  crearCliente,
  editarCliente,
  cambiarActivoCliente
} from "../controllers/clientes.controller.js";

const router = Router();

// Todas las rutas del recurso piden token: de ahi sale el id_empresa con el
// que se filtran los datos. Se aplica una sola vez para todo el router.
router.use(verificarToken);

router.get("/", obtenerClientes);
router.get("/:id", obtenerClientePorId);
router.post("/", crearCliente);
router.put("/:id", editarCliente);

// No hay DELETE: la baja es logica (ver docs/API.md)
router.patch("/:id/activo", cambiarActivoCliente);

export default router;
