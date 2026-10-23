import bcrypt from "bcryptjs";
import { esEmpleadoActivo } from "./consultas.js";
import { responderError } from "./errores.js";
import { esIdValido, esVacio } from "./validaciones.js";

// Reglas de los usuarios de una empresa (regla 10 de CLAUDE.md).
//
// Las usan tres lugares que crean o cambian usuarios:
//   - /usuarios               (el admin, sobre su empresa)
//   - /superadmin/empresas/:id/usuarios  (el superadmin, como soporte)
//   - /empleados con "acceso" (el admin, al dar de alta personal)
// Si cada uno tuviera su copia, alcanzaria con olvidarse una regla en uno de
// los tres para que se pueda dejar una empresa sin admin.

export const ROLES_EMPRESA = ["admin", "coordinador", "empleado"];
export const LARGO_MINIMO_PASSWORD = 6;

export const MENSAJES_USUARIO = {
  noEncontrado: "Usuario no encontrado",
  passwordCorta: "La contrasena tiene que tener al menos 6 caracteres",
  rolInvalido: "Rol invalido",
  emailRepetido: "El email ya esta registrado",
  empleadoObligatorio:
    "Un usuario con rol empleado tiene que estar vinculado a un empleado",
  empleadoInvalido: "El empleado no existe o no esta activo en la empresa",
  empleadoOcupado: "Ese empleado ya esta vinculado a otro usuario",
  unoMismo: "No podes desactivarte ni quitarte el rol de admin a vos mismo",
  ultimoAdmin: "La empresa tiene que tener al menos un admin activo",
  activoInvalido: "El campo activo tiene que ser true o false",
  passwordActualizada: "Contrasena actualizada"
};

export const esPasswordValida = (valor) =>
  typeof valor === "string" && valor.length >= LARGO_MINIMO_PASSWORD;

export const hashear = (password) => bcrypt.hash(password, 10);

// Objeto Usuario del contrato. Nunca incluye el hash de la contrasena.
export const SELECT_USUARIO = `
  SELECT u.id_usuario, u.nombre, u.email, u.rol, u.activo, u.id_empleado,
         CASE WHEN emp.id_empleado IS NULL THEN NULL
              ELSE emp.nombre || ' ' || emp.apellido END AS nombre_empleado,
         u.debe_cambiar_password, u.fecha_creacion
  FROM usuarios u
  LEFT JOIN empleados emp ON emp.id_empleado = u.id_empleado`;

export const buscarUsuario = async (ejecutor, idUsuario, idEmpresa) => {
  const resultado = await ejecutor.query(
    `${SELECT_USUARIO} WHERE u.id_usuario = $1 AND u.id_empresa = $2`,
    [idUsuario, idEmpresa]
  );

  return resultado.rows[0] ?? null;
};

export const listarUsuariosDeEmpresa = async (ejecutor, idEmpresa) => {
  const resultado = await ejecutor.query(
    `${SELECT_USUARIO} WHERE u.id_empresa = $1 ORDER BY u.nombre, u.id_usuario`,
    [idEmpresa]
  );

  return resultado.rows;
};

// Un error de negocio: el controller lo responde tal cual.
const error = (status, mensaje) => ({ status, mensaje });

// Valida el vinculo con un empleado: tiene que trabajar hoy en la empresa y no
// estar vinculado a otro usuario (un empleado tiene a lo sumo un usuario).
const validarVinculo = async (client, idEmpleado, idEmpresa, idUsuario = null) => {
  if (!esIdValido(idEmpleado) || !(await esEmpleadoActivo(client, idEmpleado, idEmpresa))) {
    return error(400, MENSAJES_USUARIO.empleadoInvalido);
  }

  const ocupado = await client.query(
    "SELECT 1 FROM usuarios WHERE id_empleado = $1 AND id_usuario IS DISTINCT FROM $2",
    [idEmpleado, idUsuario]
  );

  return ocupado.rows.length > 0 ? error(400, MENSAJES_USUARIO.empleadoOcupado) : null;
};

// Crea un usuario de empresa. Lo llama el controller DENTRO de su transaccion,
// despues de chequear los obligatorios (cada endpoint tiene su mensaje).
// Siempre nace con debe_cambiar_password: la contrasena la puso otra persona.
// Devuelve { usuario } o { error }.
export const insertarUsuario = async (client, idEmpresa, datos) => {
  const { nombre, email, password, rol } = datos;
  const idEmpleado = esVacio(datos.id_empleado) ? null : datos.id_empleado;

  if (!esPasswordValida(password)) {
    return { error: error(400, MENSAJES_USUARIO.passwordCorta) };
  }
  if (!ROLES_EMPRESA.includes(rol)) {
    return { error: error(400, MENSAJES_USUARIO.rolInvalido) };
  }
  if (rol === "empleado" && idEmpleado === null) {
    return { error: error(400, MENSAJES_USUARIO.empleadoObligatorio) };
  }
  if (idEmpleado !== null) {
    const problema = await validarVinculo(client, idEmpleado, idEmpresa);
    if (problema) return { error: problema };
  }

  const creado = await client.query(
    `INSERT INTO usuarios (nombre, email, password, rol, id_empresa, id_empleado,
                           debe_cambiar_password)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     RETURNING id_usuario`,
    [String(nombre).trim(), String(email).trim(), await hashear(password), rol, idEmpresa, idEmpleado]
  );

  return { usuario: await buscarUsuario(client, creado.rows[0].id_usuario, idEmpresa) };
};

// Aplica cambios a un usuario que ya existe (rol, activo, nombre, email,
// id_empleado). Va DENTRO de una transaccion del controller.
//
// cambios: solo los campos que se quieren cambiar.
// idActor: el usuario que hace el cambio, para la regla "uno mismo". Es null
//          cuando lo hace el superadmin, que no pertenece a la empresa.
//
// Devuelve { usuario } o { error }.
export const aplicarCambiosUsuario = async (client, idEmpresa, idUsuario, cambios, idActor = null) => {
  // FOR UPDATE: dos admins cambiando usuarios a la vez se esperan entre si.
  const actual = await client.query(
    `SELECT id_usuario, nombre, email, rol, activo, id_empleado
     FROM usuarios WHERE id_usuario = $1 AND id_empresa = $2
     FOR UPDATE`,
    [idUsuario, idEmpresa]
  );

  if (actual.rows.length === 0) {
    return { error: error(404, MENSAJES_USUARIO.noEncontrado) };
  }

  const antes = actual.rows[0];
  const despues = { ...antes, ...cambios };
  if (esVacio(despues.id_empleado)) despues.id_empleado = null;

  if (!ROLES_EMPRESA.includes(despues.rol)) {
    return { error: error(400, MENSAJES_USUARIO.rolInvalido) };
  }
  if (despues.rol === "empleado" && despues.id_empleado === null) {
    return { error: error(400, MENSAJES_USUARIO.empleadoObligatorio) };
  }

  // El vinculo se valida si cambia, o si el usuario queda activo: activar un
  // usuario cuyo empleado se dio de baja le devolveria el acceso a alguien que
  // ya no trabaja en la empresa.
  const cambiaVinculo = despues.id_empleado !== antes.id_empleado;
  if (despues.id_empleado !== null && (cambiaVinculo || (despues.activo && !antes.activo))) {
    const problema = await validarVinculo(client, despues.id_empleado, idEmpresa, idUsuario);
    if (problema) return { error: problema };
  }

  // Deja de ser un admin activo?
  const pierdeAdmin =
    antes.rol === "admin" && antes.activo && (despues.rol !== "admin" || !despues.activo);

  if (pierdeAdmin) {
    // Uno mismo: un admin que se saca el rol o se desactiva se queda afuera.
    if (idActor !== null && Number(idActor) === Number(idUsuario)) {
      return { error: error(409, MENSAJES_USUARIO.unoMismo) };
    }

    // Ultimo admin: se bloquean los otros admins activos, asi dos pedidos a la
    // vez no pueden desactivar cada uno a "el otro" y dejar la empresa sin admin.
    const otros = await client.query(
      `SELECT id_usuario FROM usuarios
       WHERE id_empresa = $1 AND rol = 'admin' AND activo = TRUE AND id_usuario <> $2
       FOR UPDATE`,
      [idEmpresa, idUsuario]
    );

    if (otros.rows.length === 0) {
      return { error: error(409, MENSAJES_USUARIO.ultimoAdmin) };
    }
  }

  await client.query(
    `UPDATE usuarios
     SET nombre = $1, email = $2, rol = $3, activo = $4, id_empleado = $5
     WHERE id_usuario = $6`,
    [String(despues.nombre).trim(), String(despues.email).trim(), despues.rol,
      despues.activo, despues.id_empleado, idUsuario]
  );

  return { usuario: await buscarUsuario(client, idUsuario, idEmpresa) };
};

// Reset de contrasena hecho por otra persona: queda debe_cambiar_password.
export const resetearPassword = async (ejecutor, idUsuario, idEmpresa, passwordNueva) => {
  const resultado = await ejecutor.query(
    `UPDATE usuarios SET password = $1, debe_cambiar_password = TRUE
     WHERE id_usuario = $2 AND id_empresa = $3
     RETURNING id_usuario`,
    [await hashear(passwordNueva), idUsuario, idEmpresa]
  );

  return resultado.rows.length > 0;
};

// Los duplicados de usuarios: el email (UNIQUE) o el empleado (indice parcial).
// El empleado se valida antes, pero dos altas a la vez podrian ganarle a esa
// validacion; el indice es la ultima red.
export const mensajesDuplicadoUsuario = (errorPg) => ({
  duplicado:
    errorPg?.constraint === "uq_usuarios_empleado"
      ? MENSAJES_USUARIO.empleadoOcupado
      : MENSAJES_USUARIO.emailRepetido
});

// Ejecuta fn(client) dentro de una transaccion. Si fn devuelve { error },
// hace ROLLBACK y responde ese error; si no, COMMIT y responde el resultado.
// Los usuarios cambian en varios pasos (validar, bloquear, actualizar) y todos
// sus endpoints necesitan lo mismo.
export const enTransaccion = async (pool, res, fn, { status = 200, mensajesError } = {}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const resultado = await fn(client);

    if (resultado?.error) {
      await client.query("ROLLBACK");
      return res.status(resultado.error.status).json({ mensaje: resultado.error.mensaje });
    }

    await client.query("COMMIT");
    return res.status(status).json(resultado.respuesta);
  } catch (errorPg) {
    await client.query("ROLLBACK");
    return responderError(res, errorPg, mensajesError?.(errorPg));
  } finally {
    client.release();
  }
};
