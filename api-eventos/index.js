import "dotenv/config";
import express from "express";
import cors from "cors";
import empresasRoutes from "./src/routes/empresas.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import clientesRoutes from "./src/routes/clientes.routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Solo el front puede consumir la API. Sin esto el navegador bloquea los pedidos.
app.use(cors({ origin: process.env.FRONT_URL || "http://localhost:5173" }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/empresas", empresasRoutes);
app.use("/api/clientes", clientesRoutes);

// Ruta 404: siempre al final
app.use((req, res) => {
  res.status(404).json({ mensaje: "Ruta no encontrada" });
});

const servidor = app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${servidor.address().port}`);
});
