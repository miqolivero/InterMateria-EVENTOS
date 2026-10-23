import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { responderSuspendida } from "../middlewares/auth.middleware.js";
import { esPasswordValida, hashear, MENSAJES_USUARIO } from "../utils/usuarios.js";

// Los usuarios estan en la tabla usuarios. El sistema es multitenant: cada
// usuario de empresa tiene su id_empresa, y ese id es el que despues filtra
// TODOS los datos. El superadmin es la excepcion: id_empresa NULL.
//
// Fase 10: ya no hay registro publico. Las cuentas las crea alguien de arriba
// (el superadmin crea la empresa con su admin, el admin da de alta a su
// personal), asi nadie puede elegir a que empresa pertenece.

// El objeto usuario del login y del perfil. LEFT JOIN porque el superadmin no
// tiene empresa: con un JOIN comun no podria entrar.
const SELECT_SESION = `
  SELECT u.id_usuario, u.nombre, u.email, u.password, u.rol,
         u.id_empresa, u.id_empleado, u.activo, u.debe_cambiar_password,
         e.nombre AS nombre_empresa, e.activo AS empresa_activa
  FROM usuarios u
  LEFT JOIN empresas e ON e.id_empresa = u.id_empresa`;

// Solo los datos publicos: nunca el hash ni los flags internos
const datosPublicos = (usuario) => ({
  id_usuario: usuario.id_usuario,
  nombre: usuario.nombre,
  email: usuario.email,
  rol: usuario.rol,
  id_empresa: usuario.id_empresa,
  nombre_empresa: usuario.nombre_empresa,
  id_empleado: usuario.id_empleado,
  debe_cambiar_password: usuario.debe_cambiar_password
});

// Un usuario de empresa con la empresa suspendida (el superadmin no tiene)
const estaSuspendido = (usuario) =>
  usuario.id_empresa !== null && usuario.empresa_activa === false;

// Usuario de la sesion actual, activo. null si lo desactivaron o lo borraron.
const usuarioDeLaSesion = async (idUsuario) => {
  const resultado = await pool.query(
    `${SELECT_SESION} WHERE u.id_usuario = $1 AND u.activo = TRUE`,
    [idUsuario]
  );
  return resultado.rows[0] ?? null;
};

// POST /api/auth/login
export const login = async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ mensaje: "Faltan el email y la contrasena" });
  }

  try {
    // 1. Buscar el usuario por email, con su empresa
    const resultado = await pool.query(`${SELECT_SESION} WHERE u.email = $1`, [email]);
    const usuario = resultado.rows[0];

    // Mismo mensaje que si falla la contrasena: no revelamos que emails existen
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ mensaje: "Credenciales invalidas" });
    }

    // 2. Comparar la contrasena con el hash guardado
    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return res.status(401).json({ mensaje: "Credenciales invalidas" });
    }

    // 3. Empresa suspendida: se chequea DESPUES de la contrasena, asi quien no
    //    la conoce no puede averiguar que empresas estan suspendidas.
    if (estaSuspendido(usuario)) {
      return responderSuspendida(res);
    }

    // 4. Firmar el token. id_empresa va en el payload, pero los middlewares
    //    vuelven a leer rol y empresa de la base en cada pedido (ver
    //    auth.middleware.js): un cambio de rol no espera a que venza el token.
    const token = jwt.sign(
      {
        id: usuario.id_usuario,
        email: usuario.email,
        rol: usuario.rol,
        id_empresa: usuario.id_empresa
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({ token, usuario: datosPublicos(usuario) });
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/auth/perfil  (protegida)
// El id sale del token, no de la URL: nadie puede pedir el perfil de otro.
// Tambien corta la sesion si la empresa fue suspendida: es lo que el front
// consulta al recargar la pagina.
export const perfil = async (req, res) => {
  try {
    const usuario = await usuarioDeLaSesion(req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }
    if (estaSuspendido(usuario)) {
      return responderSuspendida(res);
    }

    res.json(datosPublicos(usuario));
  } catch (error) {
    responderError(res, error);
  }
};

// PUT /api/auth/password  (protegida, cualquier rol)
// Cambia la PROPIA contrasena. Pide la actual: si alguien deja la sesion
// abierta, otro no puede cambiarle la contrasena sin saberla.
export const cambiarPassword = async (req, res) => {
  const { password_actual, password_nueva } = req.body ?? {};

  if (!password_actual || !password_nueva) {
    return res
      .status(400)
      .json({ mensaje: "La contrasena actual y la nueva son obligatorias" });
  }
  if (!esPasswordValida(password_nueva)) {
    return res
      .status(400)
      .json({ mensaje: "La contrasena nueva tiene que tener al menos 6 caracteres" });
  }

  try {
    const usuario = await usuarioDeLaSesion(req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }
    if (estaSuspendido(usuario)) {
      return responderSuspendida(res);
    }

    if (!(await bcrypt.compare(String(password_actual), usuario.password))) {
      return res.status(400).json({ mensaje: "La contrasena actual no es correcta" });
    }
    if (password_actual === password_nueva) {
      return res
        .status(400)
        .json({ mensaje: "La contrasena nueva tiene que ser distinta de la actual" });
    }

    // La puso la misma persona: ya no tiene que cambiarla
    await pool.query(
      "UPDATE usuarios SET password = $1, debe_cambiar_password = FALSE WHERE id_usuario = $2",
      [await hashear(password_nueva), usuario.id_usuario]
    );

    res.json({ mensaje: MENSAJES_USUARIO.passwordActualizada });
  } catch (error) {
    responderError(res, error);
  }
};
