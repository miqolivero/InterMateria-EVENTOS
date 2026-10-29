import "dotenv/config";
import pg from "pg";
import { esPasswordValida, hashear, MENSAJES_USUARIO } from "../src/utils/usuarios.js";

// Cambia la contraseña de cualquier usuario desde el servidor. Es la salida
// cuando nadie puede entrar desde la pantalla: por ejemplo, el superadmin
// perdió la suya (no hay nadie "arriba" que se la resetee).
//
//   npm run usuario:password -- <email> <contraseña nueva> [--temporal]
//
// --temporal: el usuario la tiene que cambiar al entrar (debe_cambiar_password).
// Úsalo cuando la contraseña la elige otra persona.
// Se necesita acceso a la base (el .env del servidor): no es un endpoint, así
// que nadie lo puede usar desde afuera.

const [email, password, opcion] = process.argv.slice(2);

if (!email || !password) {
  console.error("Uso: npm run usuario:password -- <email> <contraseña nueva> [--temporal]");
  process.exit(1);
}
if (!esPasswordValida(password)) {
  console.error(MENSAJES_USUARIO.passwordCorta ?? "La contraseña es demasiado corta.");
  process.exit(1);
}

const pool = new pg.Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });

try {
  const { rows } = await pool.query(
    `UPDATE usuarios SET password = $1, debe_cambiar_password = $2
     WHERE lower(email) = lower($3)
     RETURNING nombre, rol, activo`,
    [await hashear(password), opcion === "--temporal", email.trim()]
  );

  if (rows.length === 0) {
    console.error(`No existe un usuario con el email ${email}.`);
    process.exitCode = 1;
  } else {
    const [usuario] = rows;
    console.log(`Contraseña actualizada: ${usuario.nombre} (${usuario.rol}).`);
    if (opcion === "--temporal") console.log("La va a tener que cambiar al entrar.");
    if (!usuario.activo) console.log("Atención: el usuario está desactivado y no puede entrar hasta que lo activen.");
  }
} finally {
  await pool.end();
}
