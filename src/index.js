import "dotenv/config";
import express from "express";
import cors from "cors";
import empresasRoutes from "./routes/empresas.routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/empresas", empresasRoutes);

// Ruta 404: siempre al final
app.use((req, res) => {
  res.status(404).json({ mensaje: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
