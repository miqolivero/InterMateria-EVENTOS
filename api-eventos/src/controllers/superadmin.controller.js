import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { construirFiltros } from "../utils/consultas.js";
import { esVacio } from "../utils/validaciones.js";
import { ESTADOS_EVENTO_ABIERTO } from "./eventos.controller.js";
import {
  MENSAJES_USUARIO,
  insertarUsuario,
  aplicarCambiosUsuario,
  resetearPassword,
  esPasswordValida,
  listarUsuariosDeEmpresa,
  mensajesDuplicadoUsuario,
  enTransaccion
} from "../utils/usuarios.js";

// Panel de superadmin (Fase 10). Solo llega el rol superadmin (index.js).
//
// Decision de privacidad: el superadmin ve los datos de contacto de cada
// empresa y METRICAS (cantidades), nunca su informacion operativa. Por eso
// ninguna consulta de este archivo devuelve un cliente, un evento o una tarea:
// solo COUNT y MAX. Los datos de los clientes de cada empresa son de esa
// empresa, no nuestros.

const MENSAJES = {
  noEncontrada: "Empresa no encontrada",
  obligatoriosEmpresa: "El nombre y el cuit de la empresa son obligatorios",
  obligatoriosAdmin:
    "El nombre, el email y la contrasena del administrador son obligatorios",
  obligatoriosUsuario: "El nombre, el email, la contrasena y el rol son obligatorios",
  cuitRepetido: "Ya existe una empresa con ese cuit",
  conDatos: "La empresa tiene datos asociados. Suspendela en lugar de eliminarla",
  sinDatos: "No hay datos para actualizar"
};

// Un texto obligatorio: tiene que venir y no ser solo espacios
const faltaTexto = (valor) => esVacio(valor) || String(valor).trim() === "";

// El objeto EmpresaPanel: los datos de la empresa y sus metricas. Cada metrica
// es una subconsulta agregada sobre la empresa de la fila. $1 son los estados
// de evento abierto (confirmado, en_preparacion).
// COUNT devuelve bigint, que pg entrega como string: el ::int lo deja numero.
const SELECT_EMPRESA_PANEL = `
  SELECT e.id_empresa, e.nombre, e.cuit, e.email, e.telefono, e.direccion,
         e.activo, e.fecha_creacion,
         (SELECT COUNT(*)::int FROM usuarios u
           WHERE u.id_empresa = e.id_empresa AND u.activo = TRUE) AS usuarios_activos,
         (SELECT COUNT(*)::int FROM empleados_x_empresa exe
           JOIN empleados emp ON emp.id_empleado = exe.id_empleado
           WHERE exe.id_empresa = e.id_empresa AND exe.activo = TRUE
             AND emp.activo = TRUE) AS empleados_activos,
         (SELECT COUNT(*)::int FROM clientes c
           WHERE c.id_empresa = e.id_empresa) AS clientes,
         (SELECT COUNT(*)::int FROM eventos ev
           WHERE ev.id_empresa = e.id_empresa AND ev.estado = ANY($1)) AS eventos_abiertos,
         (SELECT COUNT(*)::int FROM eventos ev
           WHERE ev.id_empresa = e.id_empresa AND ev.estado = 'realizado') AS eventos_realizados,
         (SELECT MAX(ev.fecha_creacion)::date FROM eventos ev
           WHERE ev.id_empresa = e.id_empresa) AS ultimo_evento_creado
  FROM empresas e`;

const buscarEmpresaPanel = async (ejecutor, idEmpresa) => {
  const resultado = await ejecutor.query(
    `${SELECT_EMPRESA_PANEL} WHERE e.id_empresa = $2`,
    [ESTADOS_EVENTO_ABIERTO, idEmpresa]
  );
  return resultado.rows[0] ?? null;
};

// EmpresaPanel + la lista de sus usuarios (para el soporte)
const buscarDetalle = async (ejecutor, idEmpresa) => {
  const empresa = await buscarEmpresaPanel(ejecutor, idEmpresa);
  if (!empresa) return null;
  return { ...empresa, usuarios: await listarUsuariosDeEmpresa(ejecutor, idEmpresa) };
};

const existeEmpresa = async (ejecutor, idEmpresa) => {
  const resultado = await ejecutor.query(
    "SELECT 1 FROM empresas WHERE id_empresa = $1",
    [idEmpresa]
  );
  return resultado.rows.length > 0;
};

// El cuit es UNIQUE en empresas y el email en usuarios: en el alta pueden
// fallar los dos, y cada uno tiene su mensaje.
const mensajesDuplicadoEmpresa = (errorPg) => ({
  duplicado:
    errorPg?.constraint === "empresas_cuit_key"
      ? MENSAJES.cuitRepetido
      : mensajesDuplicadoUsuario(errorPg).duplicado
});

// GET /api/superadmin/resumen
export const obtenerResumen = async (req, res) => {
  try {
    // usuarios_activos no cuenta a los superadmin: son usuarios del sistema,
    // no de las empresas. Las metricas de eventos suman todas las empresas.
    const resultado = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM empresas WHERE activo = TRUE)  AS empresas_activas,
         (SELECT COUNT(*)::int FROM empresas WHERE activo = FALSE) AS empresas_suspendidas,
         (SELECT COUNT(*)::int FROM usuarios
           WHERE activo = TRUE AND rol <> 'superadmin')            AS usuarios_activos,
         (SELECT COUNT(*)::int FROM eventos WHERE estado = ANY($1)) AS eventos_abiertos,
         (SELECT COUNT(*)::int FROM eventos
           WHERE estado = ANY($1)
             AND fecha_evento_confirmada BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)
                                                                  AS eventos_proximos_30_dias,
         (SELECT COUNT(*)::int FROM eventos WHERE estado = 'realizado') AS eventos_realizados`,
      [ESTADOS_EVENTO_ABIERTO]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/superadmin/empresas?activo=&buscar=   (buscar: nombre o cuit)
export const obtenerEmpresas = async (req, res) => {
  const { where, valores } = construirFiltros(req.query, ["e.nombre", "e.cuit"], {
    condicionesBase: [],
    // $1 queda reservado para los estados de evento abierto del SELECT
    valoresBase: [ESTADOS_EVENTO_ABIERTO],
    columnaActivo: "e.activo"
  });

  try {
    const resultado = await pool.query(
      `${SELECT_EMPRESA_PANEL} ${where} ORDER BY e.nombre`,
      valores
    );
    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/superadmin/empresas/:id
export const obtenerEmpresaPorId = async (req, res) => {
  try {
    const detalle = await buscarDetalle(pool, req.params.id);
    if (!detalle) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrada });
    }
    res.json(detalle);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/superadmin/empresas
// La empresa y su admin, en UNA transaccion: una empresa sin admin no la
// podria usar nadie, y un admin sin empresa no puede existir.
export const crearEmpresa = async (req, res) => {
  const empresa = req.body?.empresa ?? {};
  const admin = req.body?.admin ?? {};

  if (faltaTexto(empresa.nombre) || faltaTexto(empresa.cuit)) {
    return res.status(400).json({ mensaje: MENSAJES.obligatoriosEmpresa });
  }
  if (faltaTexto(admin.nombre) || faltaTexto(admin.email) || esVacio(admin.password)) {
    return res.status(400).json({ mensaje: MENSAJES.obligatoriosAdmin });
  }
  if (!esPasswordValida(admin.password)) {
    return res.status(400).json({ mensaje: MENSAJES_USUARIO.passwordCorta });
  }

  await enTransaccion(
    pool,
    res,
    async (client) => {
      const creada = await client.query(
        `INSERT INTO empresas (nombre, cuit, email, telefono, direccion)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id_empresa`,
        [String(empresa.nombre).trim(), String(empresa.cuit).trim(),
          empresa.email ?? null, empresa.telefono ?? null, empresa.direccion ?? null]
      );
      const idEmpresa = creada.rows[0].id_empresa;

      // El admin nace con debe_cambiar_password (lo hace insertarUsuario)
      const { error } = await insertarUsuario(client, idEmpresa, {
        nombre: admin.nombre,
        email: admin.email,
        password: admin.password,
        rol: "admin"
      });
      if (error) return { error };

      return { respuesta: await buscarDetalle(client, idEmpresa) };
    },
    { status: 201, mensajesError: mensajesDuplicadoEmpresa }
  );
};

// PUT /api/superadmin/empresas/:id
// El superadmin es el unico que puede corregir el cuit.
export const editarEmpresa = async (req, res) => {
  const { nombre, cuit, email, telefono, direccion } = req.body ?? {};

  if (faltaTexto(nombre) || faltaTexto(cuit)) {
    return res.status(400).json({ mensaje: MENSAJES.obligatoriosEmpresa });
  }

  try {
    const resultado = await pool.query(
      `UPDATE empresas
       SET nombre = $1, cuit = $2, email = $3, telefono = $4, direccion = $5
       WHERE id_empresa = $6
       RETURNING id_empresa`,
      [String(nombre).trim(), String(cuit).trim(), email ?? null,
        telefono ?? null, direccion ?? null, req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrada });
    }
    res.json(await buscarEmpresaPanel(pool, req.params.id));
  } catch (error) {
    responderError(res, error, { duplicado: MENSAJES.cuitRepetido });
  }
};

// PATCH /api/superadmin/empresas/:id/activo
// Suspender no borra nada: sus usuarios dejan de entrar (soloEmpresa lo mira en
// cada pedido) y al reactivarla todo vuelve a estar como estaba.
export const cambiarActivoEmpresa = async (req, res) => {
  const { activo } = req.body ?? {};

  if (typeof activo !== "boolean") {
    return res.status(400).json({ mensaje: MENSAJES_USUARIO.activoInvalido });
  }

  try {
    const resultado = await pool.query(
      "UPDATE empresas SET activo = $1 WHERE id_empresa = $2 RETURNING id_empresa",
      [activo, req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrada });
    }
    res.json(await buscarEmpresaPanel(pool, req.params.id));
  } catch (error) {
    responderError(res, error);
  }
};

// DELETE /api/superadmin/empresas/:id
// Solo para una empresa recien creada por error. Se borran sus usuarios y la
// empresa; si tiene cualquier otro dato (clientes, catalogos, personal...), la
// FK lo impide (23503), se deshace todo y se responde 409. Asi no hay que
// mantener a mano la lista de tablas que cuentan como "datos".
export const eliminarEmpresa = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (!(await existeEmpresa(client, req.params.id))) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.noEncontrada });
    }

    await client.query("DELETE FROM usuarios WHERE id_empresa = $1", [req.params.id]);
    await client.query("DELETE FROM empresas WHERE id_empresa = $1", [req.params.id]);

    await client.query("COMMIT");
    res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error, { asociado: MENSAJES.conDatos });
  } finally {
    client.release();
  }
};

// ---- Soporte de usuarios de una empresa --------------------------------------
// Valen las mismas reglas que en /usuarios (utils/usuarios.js). La unica que no
// aplica es "uno mismo": el superadmin no es usuario de la empresa.

// POST /api/superadmin/empresas/:id/usuarios
// No recibe id_empleado: la lista de empleados es informacion de la empresa.
// Por eso un usuario con rol empleado se crea desde Personal, no desde aca.
export const crearUsuarioDeEmpresa = async (req, res) => {
  const { nombre, email, password, rol } = req.body ?? {};

  if ([nombre, email, password, rol].some(faltaTexto)) {
    return res.status(400).json({ mensaje: MENSAJES.obligatoriosUsuario });
  }

  await enTransaccion(
    pool,
    res,
    async (client) => {
      if (!(await existeEmpresa(client, req.params.id))) {
        return { error: { status: 404, mensaje: MENSAJES.noEncontrada } };
      }
      const { usuario, error } = await insertarUsuario(client, req.params.id, {
        nombre, email, password, rol
      });
      return error ? { error } : { respuesta: usuario };
    },
    { status: 201, mensajesError: mensajesDuplicadoUsuario }
  );
};

// PATCH /api/superadmin/empresas/:id/usuarios/:idUsuario   (rol y/o activo)
export const actualizarUsuarioDeEmpresa = async (req, res) => {
  const body = req.body ?? {};
  const cambios = {};

  if (Object.hasOwn(body, "rol")) cambios.rol = body.rol;
  if (Object.hasOwn(body, "activo")) {
    if (typeof body.activo !== "boolean") {
      return res.status(400).json({ mensaje: MENSAJES_USUARIO.activoInvalido });
    }
    cambios.activo = body.activo;
  }
  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ mensaje: MENSAJES.sinDatos });
  }

  await enTransaccion(pool, res, async (client) => {
    if (!(await existeEmpresa(client, req.params.id))) {
      return { error: { status: 404, mensaje: MENSAJES.noEncontrada } };
    }
    const { usuario, error } = await aplicarCambiosUsuario(
      client,
      req.params.id,
      req.params.idUsuario,
      cambios
    );
    return error ? { error } : { respuesta: usuario };
  });
};

// PUT /api/superadmin/empresas/:id/usuarios/:idUsuario/password
export const resetearPasswordDeEmpresa = async (req, res) => {
  const { password_nueva } = req.body ?? {};

  if (!esPasswordValida(password_nueva)) {
    return res.status(400).json({ mensaje: MENSAJES_USUARIO.passwordCorta });
  }

  try {
    if (!(await existeEmpresa(pool, req.params.id))) {
      return res.status(404).json({ mensaje: MENSAJES.noEncontrada });
    }
    const existe = await resetearPassword(pool, req.params.idUsuario, req.params.id, password_nueva);
    if (!existe) {
      return res.status(404).json({ mensaje: MENSAJES_USUARIO.noEncontrado });
    }
    res.json({ mensaje: MENSAJES_USUARIO.passwordActualizada });
  } catch (error) {
    responderError(res, error);
  }
};
