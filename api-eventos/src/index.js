import "dotenv/config";
import express from "express";
import cors from "cors";
import empresasRoutes from "./routes/empresas.routes.js";
import authRoutes from "./routes/auth.routes.js";
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

const app = express();
const PORT = process.env.PORT || 3000;

// Solo el front puede consumir la API. Sin esto el navegador bloquea los pedidos.
app.use(cors({ origin: process.env.FRONT_URL || "http://localhost:5173" }));
app.use(express.json());

// Fase 1: autenticacion y empresas
app.use("/api/auth", authRoutes);
app.use("/api/empresas", empresasRoutes);

// Fase 2: catalogos
app.use("/api/clientes", clientesRoutes);
app.use("/api/tipos-eventos", tiposEventosRoutes);
app.use("/api/servicios", serviciosRoutes);
app.use("/api/proveedores", proveedoresRoutes);
app.use("/api/empleados", empleadosRoutes);

// Fase 3: solicitudes
app.use("/api/solicitudes", solicitudesRoutes);

// Fase 4: presupuestos (la version 1 se crea en /api/solicitudes/:id/presupuestos)
app.use("/api/presupuestos", presupuestosRoutes);

// Fase 5: eventos (se crean en /api/presupuestos/:id/aceptar)
app.use("/api/eventos", eventosRoutes);

// Fase 6: servicios del evento y tareas
app.use("/api/servicios-evento", serviciosEventoRoutes);
app.use("/api/tareas", tareasRoutes);

// Fase 7: tablero de seguimiento
app.use("/api/seguimiento", seguimientoRoutes);

// Ruta 404: siempre al final
app.use((req, res) => {
  res.status(404).json({ mensaje: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
