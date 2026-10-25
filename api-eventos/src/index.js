import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import superadminRoutes from "./routes/superadmin.routes.js";
import miEmpresaRoutes from "./routes/miEmpresa.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import clientesRoutes from "./routes/clientes.routes.js";
import tiposEventosRoutes from "./routes/tiposEventos.routes.js";
import serviciosRoutes from "./routes/servicios.routes.js";
import proveedoresRoutes from "./routes/proveedores.routes.js";
import empleadosRoutes from "./routes/empleados.routes.js";
import solicitudesRoutes from "./routes/solicitudes.routes.js";
import presupuestosRoutes from "./routes/presupuestos.routes.js";
import eventosRoutes from "./routes/eventos.routes.js";
import serviciosEventoRoutes from "./routes/serviciosEvento.routes.js";
import tareasRoutes from "./routes/tareas.routes.js";
import seguimientoRoutes from "./routes/seguimiento.routes.js";
import revisionesRoutes from "./routes/revisiones.routes.js";
import {
  verificarToken,
  soloEmpresa,
  soloSuperadmin,
  permitirRoles
} from "./middlewares/auth.middleware.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Solo el front puede consumir la API. Sin esto el navegador bloquea los pedidos.
app.use(cors({ origin: process.env.FRONT_URL || "http://localhost:5173" }));
app.use(express.json());

// -----------------------------------------------------------------------------
// Permisos (Fase 10): la tabla "Permisos por ruta" de docs/API.md se aplica
// aca, por grupo de rutas, y no endpoint por endpoint. Asi una ruta nueva que
// se agregue a un router ya nace protegida. Donde el permiso cambia dentro de
// un grupo (por ejemplo, PUT /mi-empresa solo para admin), el router suma su
// propio permitirRoles.
// -----------------------------------------------------------------------------
const empresa = [verificarToken, soloEmpresa];
const ADMIN = "admin";
const COORDINADOR = "coordinador";
const EMPLEADO = "empleado";
const operacion = [...empresa, permitirRoles(ADMIN, COORDINADOR)];

// Login publico; /perfil y /password protegidas dentro del router.
// POST /auth/register y /api/empresas ya no existen: responden el 404 de abajo.
app.use("/api/auth", authRoutes);

// Panel de superadmin
app.use("/api/superadmin", verificarToken, soloSuperadmin, superadminRoutes);

// La empresa y sus usuarios
app.use("/api/mi-empresa", ...empresa, permitirRoles(ADMIN, COORDINADOR, EMPLEADO), miEmpresaRoutes);
app.use("/api/usuarios", ...empresa, permitirRoles(ADMIN), usuariosRoutes);

// Catalogos (Fase 2). Empleados: el alta, la edicion y el acceso son solo del
// admin, y eso lo agrega su router.
app.use("/api/clientes", ...operacion, clientesRoutes);
app.use("/api/tipos-eventos", ...operacion, tiposEventosRoutes);
app.use("/api/servicios", ...operacion, serviciosRoutes);
app.use("/api/proveedores", ...operacion, proveedoresRoutes);
app.use("/api/empleados", ...operacion, empleadosRoutes);

// Operacion (Fases 3 a 8). La version 1 del presupuesto se crea en
// /api/solicitudes/:id/presupuestos y el evento en /api/presupuestos/:id/aceptar.
app.use("/api/solicitudes", ...operacion, solicitudesRoutes);
app.use("/api/presupuestos", ...operacion, presupuestosRoutes);
app.use("/api/seguimiento", ...operacion, seguimientoRoutes);

// Las rutas de operacion que tambien usa el empleado. Cada router le cierra
// el resto (con router.use(permitirRoles(...)) o por endpoint) y el
// controller lo limita a SUS registros:
//   - eventos: solo el resumen y las revisiones (Fase 11);
//   - servicios-evento: solo el estado del proveedor;
//   - tareas: "mis tareas" y el cambio de estado;
//   - revisiones: dejar constancia de lo que reviso.
app.use("/api/eventos", ...empresa, permitirRoles(ADMIN, COORDINADOR, EMPLEADO), eventosRoutes);
app.use("/api/servicios-evento", ...empresa, permitirRoles(ADMIN, COORDINADOR, EMPLEADO), serviciosEventoRoutes);
app.use("/api/tareas", ...empresa, permitirRoles(ADMIN, COORDINADOR, EMPLEADO), tareasRoutes);
app.use("/api/revisiones", ...empresa, permitirRoles(ADMIN, COORDINADOR, EMPLEADO), revisionesRoutes);

// Ruta 404: siempre al final
app.use((req, res) => {
  res.status(404).json({ mensaje: "Ruta no encontrada" });
});

// Manejador de errores de Express (4 parametros): lo que se escapa de los
// controladores. El caso tipico es un body que no es JSON valido: sin esto,
// express.json() responde una pagina HTML y el front no puede leer el mensaje.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ mensaje: "El cuerpo del pedido no es un JSON valido" });
  }

  console.error(error);
  res.status(500).json({ mensaje: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
