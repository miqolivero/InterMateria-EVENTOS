import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { construirFiltros } from "../utils/consultas.js";
import { esVacio } from "../utils/validaciones.js";
import {
  ROLES_EMPRESA,
  MENSAJES_USUARIO,
  SELECT_USUARIO,
  buscarUsuario,
  insertarUsuario,
  aplicarCambiosUsuario,
  resetearPassword,
  esPasswordValida,
  mensajesDuplicadoUsuario,
  enTransaccion
} from "../utils/usuarios.js";

// Usuarios de mi empresa (Fase 10). Solo el admin llega aca (index.js).
// Todo se filtra por req.usuario.id_empresa: un id de otra empresa da 404.
// Las reglas (ultimo admin, uno mismo, vinculo con empleado) estan en
// utils/usuarios.js porque las comparte con el superadmin y con Personal.

// GET /api/usuarios?activo=&rol=&buscar=
export const obtenerUsuarios = async (req, res) => {
  const condicionesBase = ["u.id_empresa = $1"];
  const valoresBase = [req.usuario.id_empresa];

  // Un rol que no existe se ignora, como los demas filtros invalidos
  if (ROLES_EMPRESA.includes(req.query.rol)) {
    valoresBase.push(req.query.rol);
    condicionesBase.push(`u.rol = $${valoresBase.length}`);
  }

  const { where, valores } = construirFiltros(req.query, ["u.nombre", "u.email"], {
    condicionesBase,
    valoresBase,
    columnaActivo: "u.activo"
  });

  try {
    const resultado = await pool.query(
      `${SELECT_USUARIO} ${where} ORDER BY u.nombre, u.id_usuario`,
      valores
    );
    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/usuarios/:id
export const obtenerUsuarioPorId = async (req, res) => {
  try {
    const usuario = await buscarUsuario(pool, req.params.id, req.usuario.id_empresa);
    if (!usuario) {
      return res.status(404).json({ mensaje: MENSAJES_USUARIO.noEncontrado });
    }
    res.json(usuario);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/usuarios
// Un usuario sin empleado (por ejemplo, un socio) o vinculado a uno.
export const crearUsuario = async (req, res) => {
  const { nombre, email, password, rol, id_empleado } = req.body ?? {};

  if ([nombre, email, password, rol].some((v) => esVacio(v) || String(v).trim() === "")) {
    return res
      .status(400)
      .json({ mensaje: "El nombre, el email, la contrasena y el rol son obligatorios" });
  }

  await enTransaccion(
    pool,
    res,
    async (client) => {
      const { usuario, error } = await insertarUsuario(client, req.usuario.id_empresa, {
        nombre, email, password, rol, id_empleado
      });
      return error ? { error } : { respuesta: usuario };
    },
    { status: 201, mensajesError: mensajesDuplicadoUsuario }
  );
};

// PUT /api/usuarios/:id
// Reemplaza nombre, email, rol e id_empleado (si no viene, queda sin vinculo).
// La contrasena y el activo tienen sus propios endpoints.
export const editarUsuario = async (req, res) => {
  const { nombre, email, rol, id_empleado } = req.body ?? {};

  if ([nombre, email, rol].some((v) => esVacio(v) || String(v).trim() === "")) {
    return res
      .status(400)
      .json({ mensaje: "El nombre, el email y el rol son obligatorios" });
  }

  await enTransaccion(
    pool,
    res,
    async (client) => {
      const { usuario, error } = await aplicarCambiosUsuario(
        client,
        req.usuario.id_empresa,
        req.params.id,
        { nombre, email, rol, id_empleado: id_empleado ?? null },
        req.usuario.id
      );
      return error ? { error } : { respuesta: usuario };
    },
    { mensajesError: mensajesDuplicadoUsuario }
  );
};

// PATCH /api/usuarios/:id/activo
export const cambiarActivoUsuario = async (req, res) => {
  const { activo } = req.body ?? {};

  if (typeof activo !== "boolean") {
    return res.status(400).json({ mensaje: MENSAJES_USUARIO.activoInvalido });
  }

  await enTransaccion(pool, res, async (client) => {
    const { usuario, error } = await aplicarCambiosUsuario(
      client,
      req.usuario.id_empresa,
      req.params.id,
      { activo },
      req.usuario.id
    );
    return error ? { error } : { respuesta: usuario };
  });
};

// PUT /api/usuarios/:id/password
// Reset hecho por el admin: el usuario tiene que cambiarla al entrar.
export const resetearPasswordUsuario = async (req, res) => {
  const { password_nueva } = req.body ?? {};

  if (!esPasswordValida(password_nueva)) {
    return res.status(400).json({ mensaje: MENSAJES_USUARIO.passwordCorta });
  }

  try {
    const existe = await resetearPassword(pool, req.params.id, req.usuario.id_empresa, password_nueva);
    if (!existe) {
      return res.status(404).json({ mensaje: MENSAJES_USUARIO.noEncontrado });
    }
    res.json({ mensaje: MENSAJES_USUARIO.passwordActualizada });
  } catch (error) {
    responderError(res, error);
  }
};
