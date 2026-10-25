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
  if (tablas.length !== 18) throw new Error("El esquema cambió: revisar la actualización antes de ejecutarla.");
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
  // Fase 10: roles, superadmin y cambio de contrasena obligatorio. Cada paso se
  // puede repetir sin error, asi el script sirve en una base vieja y en una nueva.
  // El UPDATE va antes del CHECK nuevo: con usuarios en 'usuario' fallaria.
  // 'usuario' pasa a 'coordinador', que conserva la operacion completa que tenia.
  for (const sql of [
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check",
    "UPDATE usuarios SET rol = 'coordinador' WHERE rol = 'usuario'",
    "ALTER TABLE usuarios ALTER COLUMN rol DROP DEFAULT",
    "ALTER TABLE usuarios ALTER COLUMN id_empresa DROP NOT NULL",
    "ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('superadmin', 'admin', 'coordinador', 'empleado'))",
    "ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS chk_usuarios_empresa",
    "ALTER TABLE usuarios ADD CONSTRAINT chk_usuarios_empresa CHECK ((rol = 'superadmin' AND id_empresa IS NULL AND id_empleado IS NULL) OR (rol <> 'superadmin' AND id_empresa IS NOT NULL))",
    "ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS chk_usuarios_empleado",
    "ALTER TABLE usuarios ADD CONSTRAINT chk_usuarios_empleado CHECK (rol <> 'empleado' OR id_empleado IS NOT NULL)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_empleado ON usuarios(id_empleado) WHERE id_empleado IS NOT NULL",
    "ALTER TABLE eventos ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()"
  ]) await cliente.query(sql);
  // Fase 11: estados del proveedor, servicios cancelados y asistentes en el
  // evento. Las tablas cambios_evento y afectados_cambio las crea el bucle de
  // CREATE TABLE IF NOT EXISTS de arriba. El UPDATE de estados va entre el
  // DROP y el ADD del CHECK: con el CHECK viejo los estados nuevos no entran,
  // y con el nuevo no entran los viejos. Repetido, el CASE no cambia nada.
  for (const sql of [
    "ALTER TABLE servicios_x_evento DROP CONSTRAINT IF EXISTS servicios_x_evento_estado_proveedor_check",
    `UPDATE servicios_x_evento SET estado_proveedor = CASE estado_proveedor
       WHEN 'solicitada' THEN 'pendiente' WHEN 'confirmada' THEN 'confirmado'
       WHEN 'en_seguimiento' THEN 'confirmado' WHEN 'finalizada' THEN 'completado'
       WHEN 'rechazada' THEN 'rechazado' ELSE estado_proveedor END`,
    "ALTER TABLE servicios_x_evento ALTER COLUMN estado_proveedor SET DEFAULT 'pendiente'",
    "ALTER TABLE servicios_x_evento ADD CONSTRAINT servicios_x_evento_estado_proveedor_check CHECK (estado_proveedor IN ('pendiente', 'confirmado', 'completado', 'rechazado'))",
    "ALTER TABLE servicios_x_evento ADD COLUMN IF NOT EXISTS estado_servicio VARCHAR(20) NOT NULL DEFAULT 'acordado' CHECK (estado_servicio IN ('acordado', 'cancelado'))",
    // Primero sin NOT NULL, se copia de la solicitud (que ya es NOT NULL y > 0)
    // y recien ahi se exige
    "ALTER TABLE eventos ADD COLUMN IF NOT EXISTS cantidad_asistentes INTEGER",
    "UPDATE eventos e SET cantidad_asistentes = s.cantidad_asistentes FROM solicitudes s WHERE s.id_solicitud = e.id_solicitud AND e.cantidad_asistentes IS NULL",
    "ALTER TABLE eventos ALTER COLUMN cantidad_asistentes SET NOT NULL",
    "ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_cantidad_asistentes_check",
    "ALTER TABLE eventos ADD CONSTRAINT eventos_cantidad_asistentes_check CHECK (cantidad_asistentes > 0)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_tareas_servicio_paso ON tareas(id_servicio_x_evento, id_tipo_tarea) WHERE id_tipo_tarea IS NOT NULL"
  ]) await cliente.query(sql);
  await cliente.query("COMMIT");
  console.log("Base actualizada. Se conservaron los registros existentes.");
} catch (error) {
  await cliente.query("ROLLBACK");
  throw error;
} finally {
  cliente.release();
  await pool.end();
}
