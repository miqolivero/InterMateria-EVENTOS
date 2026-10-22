// Vista de prueba EN MEMORIA. No consume ni modifica la API o la base reales.
// Solo lectura, excepto el login ficticio. Ejecutar: node test/vista-contrato.mjs
import { createServer as crearHTTP } from "node:http";
import { build, preview } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const usuario = { id_usuario: 1, nombre: "Cuenta de prueba", email: "demo@example.com", rol: "admin", id_empresa: 1, nombre_empresa: "Empresa de prueba", id_empleado: 1 };
const cliente = { id_cliente: 1, nombre: "Ana", apellido: "Demo", dni_cuit: "11111111", email: "ana@example.com", telefono: "3510000000", direccion: "Dirección de prueba", activo: true };
const tipo = { id_tipo_evento: 1, nombre: "Cumpleaños", descripcion: "Evento de prueba", activo: true };
const servicio = { id_servicio: 1, nombre: "Catering", descripcion: "Servicio de prueba", activo: true };
const proveedor = { id_proveedor: 1, razon_social: "Proveedor de prueba", servicios: [servicio], activo: true };
const empleado = { id_empleado: 1, legajo: "P-001", nombre: "Laura", apellido: "Demo", rol: "Coordinación", cargo: "Coordinadora", fecha_inicio: "2026-01-01", activo: true };
const solicitud = { id_solicitud: 1, id_cliente: 1, nombre_cliente: "Ana Demo", id_tipo_evento: 1, nombre_tipo_evento: "Cumpleaños", fecha_solicitud: "2026-10-20", fecha_evento_prevista: "2027-11-14", cantidad_asistentes: 80, sede_prevista: "Salón de prueba", preferencias: "Menú de prueba", estado: "presupuestada", id_evento: null, cliente };
const renglon = { id_detalle: 1, id_servicio: 1, nombre_servicio: "Catering", id_proveedor: 1, nombre_proveedor: "Proveedor de prueba", descripcion: "80 cubiertos", cantidad: 80, costo_proveedor: 100000, importe_cliente: 130000, margen: 30000 };
const versiones = [{ id_presupuesto: 1, numero_version: 1, estado: "borrador" }, { id_presupuesto: 2, numero_version: 2, estado: "presentado" }];
const presupuesto = { id_presupuesto: 1, id_solicitud: 1, numero_version: 1, fecha_emision: "2026-10-20", validez_dias: 15, estado: "borrador", editable: true, importe_total: 130000, total_costo: 100000, total_margen: 30000, solicitud, detalle: [renglon], versiones };
solicitud.presupuestos = versiones.map((v) => ({ ...v, importe_total: 130000, fecha_emision: "2026-10-20" }));
const evento = { id_evento: 1, estado: "en_preparacion", editable: true, fecha_evento_confirmada: "2027-11-14", sede_acordada: "Salón de prueba", condiciones_acordadas: "Según propuesta", coordinador: empleado, cliente, solicitud, presupuesto_aceptado: { id_presupuesto: 2, numero_version: 2, importe_total: 130000 } };
const servicioEvento = { ...renglon, id_servicio_x_evento: 1, id_evento: 1, costo_acordado_proveedor: 100000, importe_acordado_cliente: 130000, estado_proveedor: "solicitada", fecha_confirmacion_proveedor: null, tareas_generadas: true, paso_actual: 2 };
const tareas = ["Contacto", "Confirmación", "Seguimiento", "Finalización"].map((nombre, i) => ({ id_tarea: i + 1, id_evento: 1, id_servicio_x_evento: 1, nombre_servicio: "Catering", nombre_proveedor: proveedor.razon_social,
  id_tipo_tarea: i + 1, nombre_tipo_tarea: nombre, orden: i + 1, descripcion: `${nombre} de catering`, id_empleado_responsable: 1, nombre_responsable: "Laura Demo", fecha_prevista: "2027-11-01", fecha_finalizacion: i ? null : "2026-10-20", estado_tarea: i ? "pendiente" : "completada", vencida: false }));
tareas.push({ id_tarea: 5, id_evento: 1, id_servicio_x_evento: null, id_tipo_tarea: null, descripcion: "Revisar sede", id_empleado_responsable: 1, nombre_responsable: "Laura Demo", fecha_prevista: "2026-10-01", fecha_finalizacion: null, estado_tarea: "en_curso", vencida: true });

const api = crearHTTP(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5175");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  res.setHeader("Content-Type", "application/json");
  const ruta = new URL(req.url, "http://localhost").pathname.replace(/^\/api/, "");
  if (ruta === "/auth/login" && req.method === "POST") { res.end(JSON.stringify({ token: "token-ficticio-de-verificacion", usuario })); return; }
  if (req.method !== "GET") { res.writeHead(501); res.end(JSON.stringify({ mensaje: "Vista de prueba: las escrituras están deshabilitadas" })); return; }
  const recursos = { "/clientes": [cliente], "/tipos-eventos": [tipo], "/servicios": [servicio], "/proveedores": [proveedor], "/empleados": [empleado] };
  const respuestas = {
    ...recursos, "/auth/perfil": usuario,
    "/empresas": [{ id_empresa: 1, nombre: "Empresa de prueba", cuit: "30-11111111-1", activo: true }],
    "/proveedores/1/servicios": [servicio], "/solicitudes": [solicitud], "/solicitudes/1": solicitud,
    "/presupuestos/1": presupuesto, "/presupuestos/2": { ...presupuesto, id_presupuesto: 2, numero_version: 2, estado: "presentado", editable: false },
    "/eventos": [{ ...evento, nombre_cliente: "Ana Demo", nombre_tipo_evento: "Cumpleaños", nombre_coordinador: "Laura Demo" }],
    "/eventos/1": evento, "/eventos/1/servicios": [servicioEvento, { ...servicioEvento, id_servicio_x_evento: 2, tareas_generadas: false, paso_actual: null }], "/eventos/1/tareas": tareas, "/tareas/mias": tareas,
    "/eventos/2": { ...evento, id_evento: 2, estado: "realizado", editable: false, fecha_cierre: "2026-10-20", feedback_cliente: "Feedback de prueba", observaciones_cierre: "Observación de prueba" },
    "/eventos/2/servicios": [servicioEvento], "/eventos/2/tareas": tareas,
    "/eventos/3": { ...evento, id_evento: 3, estado: "cancelado", editable: false, fecha_cierre: "2026-10-20", observaciones_cierre: "Cancelación de prueba" },
    "/eventos/3/servicios": [servicioEvento], "/eventos/3/tareas": tareas,
    "/seguimiento/resumen": { dias: 30, eventos_proximos: 1, tareas_vencidas: 1, tareas_pendientes: 4, servicios_sin_confirmar: 1, solicitudes_pendientes: 0 },
    "/seguimiento/proximos-eventos": [{ id_evento: 1, nombre_cliente: "Ana Demo", fecha_evento_confirmada: "2027-11-14", estado: "en_preparacion", nombre_coordinador: "Laura Demo", porcentaje_avance: 20, tareas_vencidas: 1, servicios_sin_confirmar: 1 }],
    "/seguimiento/tareas-vencidas": [{ ...tareas[4], dias_vencida: 19 }],
    "/seguimiento/servicios-sin-confirmar": [{ ...servicioEvento, nombre_cliente: "Ana Demo", fecha_evento_confirmada: "2027-11-14" }]
  };
  let respuesta = respuestas[ruta];
  if (respuesta === undefined) {
    const match = ruta.match(/^\/(clientes|tipos-eventos|servicios|proveedores|empleados)\/1$/);
    if (match) respuesta = recursos[`/${match[1]}`][0];
  }
  if (respuesta === undefined) { res.writeHead(404); respuesta = { mensaje: "Ruta de prueba no disponible" }; }
  res.end(JSON.stringify(respuesta));
});
await new Promise((resolve) => api.listen(3305, "127.0.0.1", resolve));
const raiz = fileURLToPath(new URL("../", import.meta.url));
// Salida aislada dentro de node_modules (ignorada). No comparte el optimizador
// del servidor de desarrollo que usa el usuario en 5173.
await build({ root: raiz, configFile: false, plugins: [react(), { name: "identificar-vista-de-prueba", transformIndexHtml: (html) => html
  .replace("<title>", "<title>[PRUEBA] ")
  .replace("<body>", '<body><div style="padding:8px 16px;background:#fff7d6;border-bottom:1px solid #e7cf73;font:13px system-ui">Vista de prueba · Datos ficticios · No se guardan cambios</div>') }],
  define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://127.0.0.1:3305/api") },
  build: { outDir: "node_modules/.vista-contrato", emptyOutDir: false }, logLevel: "error" });
const vite = await preview({ root: raiz, configFile: false,
  build: { outDir: "node_modules/.vista-contrato" }, preview: { host: "localhost", port: 5175, strictPort: true } });
console.log("VISTA DE PRUEBA · http://localhost:5175 · datos ficticios, sin escrituras. Login: demo@example.com / prueba");
async function cerrar() { vite.httpServer.close(); api.close(); }
process.on("SIGINT", cerrar); process.on("SIGTERM", cerrar);
