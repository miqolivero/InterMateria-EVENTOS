import "dotenv/config";
import pg from "pg";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Actualiza la instalación antigua sin ejecutar los DROP de schema.sql.
// El respaldo completo se genera antes de modificar la base.
const raiz = fileURLToPath(new URL("../../", import.meta.url));
const carpeta = path.join(raiz, "laboratorio-bd", "respaldos");
await mkdir(carpeta, { recursive: true });
const respaldo = path.join(carpeta, `eventos-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
const pgDumpWindows = "C:/Program Files/PostgreSQL/18/bin/pg_dump.exe";
const ejecutable = process.env.PG_DUMP || (existsSync(pgDumpWindows) ? pgDumpWindows : "pg_dump");
const copia = spawnSync(ejecutable, ["--format=custom", "--file", respaldo], {
  env: { ...process.env, PGHOST: process.env.DB_HOST, PGPORT: process.env.DB_PORT,
    PGUSER: process.env.DB_USER, PGPASSWORD: process.env.DB_PASSWORD, PGDATABASE: process.env.DB_NAME },
  encoding: "utf8", windowsHide: true
});
if (copia.error || copia.status !== 0) throw new Error(`No se pudo respaldar la base: ${copia.error?.message || copia.stderr}`);
console.log(`Respaldo: ${respaldo}`);

const pool = new pg.Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  connectionTimeoutMillis: 5000 });
const cliente = await pool.connect();
try {
  await cliente.query("BEGIN");
  await cliente.query("SET LOCAL lock_timeout = '5s'");
  await cliente.query("SELECT pg_advisory_xact_lock(720261022)");
  const schema = await readFile(new URL("../database/schema.sql", import.meta.url), "utf8");
  const tablas = [...schema.matchAll(/CREATE TABLE (\w+)\s*\([\s\S]*?\);/g)];
  if (tablas.length !== 16) throw new Error("El esquema cambió: revisar la actualización antes de ejecutarla.");
  const antes = (await cliente.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rows.map(r => r.tablename);
  if (antes.includes("clientes")) {
    const columnas = (await cliente.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes'")).rows.map(r => r.column_name);
    if (columnas.includes("id") && !columnas.includes("id_cliente")) await cliente.query("ALTER TABLE clientes RENAME COLUMN id TO id_cliente");
    await cliente.query("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion VARCHAR(200), ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE, ADD COLUMN IF NOT EXISTS fecha_alta TIMESTAMP NOT NULL DEFAULT NOW()");
  }
  for (const [sql] of tablas) await cliente.query(sql.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS "));
  for (const [sql] of schema.matchAll(/CREATE INDEX \w+ ON [\s\S]*?;/g)) await cliente.query(sql.replace("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS "));
  // Datos fijos del sistema, sin empresas, usuarios ni eventos de prueba.
  for (const [orden, nombre, descripcion] of [
    [1, "Contactar al proveedor", "Primer contacto para pedir disponibilidad y condiciones"],
    [2, "Confirmar asistencia", "Confirmar con el proveedor que va a prestar el servicio"],
    [3, "Seguimiento previo", "Repasar detalles, horarios y requerimientos antes del evento"],
    [4, "Cierre del servicio", "Verificar que el servicio se presto y cerrar el pago"]
  ]) await cliente.query("INSERT INTO tipos_tarea (nombre, descripcion, orden) VALUES ($1,$2,$3) ON CONFLICT (orden) DO NOTHING", [nombre, descripcion, orden]);
  await cliente.query("COMMIT");
  console.log("Base actualizada. Se conservaron los registros existentes.");
} catch (error) {
  await cliente.query("ROLLBACK");
  throw error;
} finally {
  cliente.release();
  await pool.end();
}
