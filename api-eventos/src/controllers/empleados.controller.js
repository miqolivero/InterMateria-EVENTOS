import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { construirFiltros } from "../utils/consultas.js";
import { esVacio } from "../utils/validaciones.js";
import {
  insertarUsuario,
  aplicarCambiosUsuario,
  mensajesDuplicadoUsuario
} from "../utils/usuarios.js";

// Empleados: el personal de la empresa.
//
// Este recurso es distinto a los otros catalogos porque la tabla empleados NO
// tiene id_empresa: el vinculo esta en empleados_x_empresa, que guarda el
// historial (cargo, fecha_inicio, fecha_fin). Por eso:
//   - el filtro multitenant va por el JOIN, no por un WHERE id_empresa;
//   - el "activo" que ve el front es el del VINCULO, no el de la tabla
//     empleados (asi un empleado puede estar inactivo en una empresa y activo
//     en otra);
//   - crear y editar tocan dos tablas, asi que van en una transaccion.
//
// Fase 10: es tambien el panel donde la empresa decide quien entra al sistema.
// Cada empleado trae "acceso" (su usuario, o null), y el alta puede crear el
// empleado, su vinculo y su usuario en una sola transaccion.

const CAMPOS_BUSQUEDA = ["e.nombre", "e.apellido", "e.legajo"];
const MENSAJES = {
  duplicado: "Ya existe un empleado con ese legajo",
  noEncontrado: "Empleado no encontrado",
  accesoObligatorios: "El email, la contrasena y el rol del acceso son obligatorios",
  yaTieneAcceso: "El empleado ya tiene acceso al sistema",
  noActivo: "El empleado no esta activo en la empresa"
};

// El legajo es UNIQUE en empleados y el email en usuarios: un alta con acceso
// puede chocar con cualquiera de los dos, y cada uno tiene su mensaje.
const mensajesDuplicado = (errorPg) => ({
  duplicado:
    errorPg?.constraint === "empleados_legajo_key"
      ? MENSAJES.duplicado
      : mensajesDuplicadoUsuario(errorPg).duplicado
});

// El bloque acceso ({ email, password, rol }) esta completo?
const accesoIncompleto = (acceso) =>
  typeof acceso !== "object" ||
  [acceso.email, acceso.password, acceso.rol].some(
    (v) => esVacio(v) || String(v).trim() === ""
  );

// El JOIN es lo que hace el filtro por empresa: un empleado de otra empresa no
// aparece, y el endpoint responde 404 sin revelar que existe.
// acceso: el usuario del empleado EN ESTA EMPRESA (u.id_empresa), armado como
// objeto con json_build_object, o null si no tiene. Solo email, rol y activo:
// nunca el hash de la contrasena.
const SELECT_EMPLEADO = `
  SELECT e.id_empleado, e.legajo, e.nombre, e.apellido, e.rol,
         e.telefono, e.email,
         exe.cargo, exe.fecha_inicio, exe.fecha_fin, exe.activo,
         CASE WHEN u.id_usuario IS NULL THEN NULL
              ELSE json_build_object('id_usuario', u.id_usuario, 'email', u.email,
                                     'rol', u.rol, 'activo', u.activo)
         END AS acceso
  FROM empleados e
  JOIN empleados_x_empresa exe ON exe.id_empleado = e.id_empleado
  LEFT JOIN usuarios u ON u.id_empleado = e.id_empleado
                      AND u.id_empresa = exe.id_empresa`;

const buscarEmpleado = async (ejecutor, idEmpleado, idEmpresa) => {
  const resultado = await ejecutor.query(
    `${SELECT_EMPLEADO} WHERE e.id_empleado = $1 AND exe.id_empresa = $2`,
    [idEmpleado, idEmpresa]
  );

  return resultado.rows[0] ?? null;
};

// GET /api/empleados?activo=true|false&buscar=texto
export const obtenerEmpleados = async (req, res) => {
  const { where, valores } = construirFiltros(req.query, CAMPOS_BUSQUEDA, {
    condicionesBase: ["exe.id_empresa = $1"],
    valoresBase: [req.usuario.id_empresa],
    // El activo del vinculo, no el de la tabla empleados
    columnaActivo: "exe.activo"
  });

  try {
    const resultado = await pool.query(
      `${SELECT_EMPLEADO} ${where} ORDER BY e.apellido, e.nombre`,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/empleados/:id
export const obtenerEmpleadoPorId = async (req, res) => {
  try {
    const empleado = await buscarEmpleado(
      pool,
      req.params.id,
      req.usuario.id_empresa
    );

    if (!empleado) {
      return res.status(404).json({ mensaje: "Empleado no encontrado" });
    }

    res.json(empleado);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/empleados   (solo admin)
// Crea el empleado y su vinculo con la empresa del usuario, en una sola
// transaccion: un empleado sin vinculo no lo veria nadie (el listado va por el
// JOIN), asi que quedaria invisible y huerfano.
// Si viene el bloque "acceso", en la MISMA transaccion se crea su usuario: si
// el email esta repetido, no queda el empleado creado a medias.
export const crearEmpleado = async (req, res) => {
  const {
    legajo,
    nombre,
    apellido,
    rol,
    email,
    telefono,
    cargo,
    fecha_inicio,
    acceso
  } = req.body;

  if (!legajo || !nombre || !apellido) {
    return res
      .status(400)
      .json({ mensaje: "El legajo, el nombre y el apellido son obligatorios" });
  }

  const conAcceso = !esVacio(acceso);
  if (conAcceso && accesoIncompleto(acceso)) {
    return res.status(400).json({ mensaje: MENSAJES.accesoObligatorios });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const empleado = await client.query(
      `INSERT INTO empleados (legajo, nombre, apellido, rol, email, telefono)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_empleado`,
      [
        legajo,
        nombre,
        apellido,
        rol ?? null,
        email ?? null,
        telefono ?? null
      ]
    );

    const idEmpleado = empleado.rows[0].id_empleado;

    // Si fecha_inicio no viene, la base pone CURRENT_DATE (lo dice el
    // contrato), por eso se manda null y se resuelve con COALESCE.
    await client.query(
      `INSERT INTO empleados_x_empresa (id_empleado, id_empresa, cargo,
                                        fecha_inicio)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE))`,
      [idEmpleado, req.usuario.id_empresa, cargo ?? null, fecha_inicio ?? null]
    );

    if (conAcceso) {
      const { error } = await insertarUsuario(client, req.usuario.id_empresa, {
        nombre: `${nombre} ${apellido}`,
        email: acceso.email,
        password: acceso.password,
        rol: acceso.rol,
        id_empleado: idEmpleado
      });

      if (error) {
        await client.query("ROLLBACK");
        return res.status(error.status).json({ mensaje: error.mensaje });
      }
    }

    const creado = await buscarEmpleado(
      client,
      idEmpleado,
      req.usuario.id_empresa
    );

    await client.query("COMMIT");

    res.status(201).json(creado);
  } catch (error) {
    await client.query("ROLLBACK");
    // El legajo SI tiene UNIQUE en la base (es unico en todo el sistema), asi
    // que el duplicado llega como 23505 y lo traduce el helper. Lo mismo el
    // email del acceso.
    responderError(res, error, mensajesDuplicado(error));
  } finally {
    client.release();
  }
};

// PUT /api/empleados/:id
// El objeto del contrato mezcla campos de las dos tablas: legajo, nombre,
// apellido, rol, email y telefono son del empleado; cargo y fecha_inicio son
// del vinculo. Por eso el PUT actualiza las dos en una transaccion.
export const editarEmpleado = async (req, res) => {
  const {
    legajo,
    nombre,
    apellido,
    rol,
    email,
    telefono,
    cargo,
    fecha_inicio
  } = req.body;

  if (!legajo || !nombre || !apellido) {
    return res
      .status(400)
      .json({ mensaje: "El legajo, el nombre y el apellido son obligatorios" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Primero se comprueba que el empleado sea de esta empresa. Sin esto se
    // podrian editar los datos de un empleado de otra empresa, porque la tabla
    // empleados es compartida.
    const existente = await buscarEmpleado(
      client,
      req.params.id,
      req.usuario.id_empresa
    );

    if (!existente) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: "Empleado no encontrado" });
    }

    await client.query(
      `UPDATE empleados
       SET legajo = $1, nombre = $2, apellido = $3,
           rol = $4, email = $5, telefono = $6
       WHERE id_empleado = $7`,
      [
        legajo,
        nombre,
        apellido,
        rol ?? null,
        email ?? null,
        telefono ?? null,
        req.params.id
      ]
    );

    await client.query(
      `UPDATE empleados_x_empresa
       SET cargo = $1,
           fecha_inicio = COALESCE($2::date, fecha_inicio)
       WHERE id_empleado = $3 AND id_empresa = $4`,
      [cargo ?? null, fecha_inicio ?? null, req.params.id, req.usuario.id_empresa]
    );

    const actualizado = await buscarEmpleado(
      client,
      req.params.id,
      req.usuario.id_empresa
    );

    await client.query("COMMIT");

    res.json(actualizado);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error, MENSAJES);
  } finally {
    client.release();
  }
};


// PATCH /api/empleados/:id/activo   (solo admin)
// La baja cierra el vinculo: activo = false y fecha_fin = hoy. Reactivar lo
// vuelve a abrir (fecha_fin = null). El empleado nunca se borra, porque quedan
// tareas y eventos a su nombre.
//
// Fase 10 (regla 10): la baja tambien desactiva su usuario, en la misma
// transaccion. Valen las reglas de usuarios: si es el ultimo admin activo, o
// el admin dandose de baja a si mismo, no se hace nada (409).
// Reactivar al empleado NO reactiva su usuario: devolverle el acceso es una
// decision aparte, que se toma en Usuarios.
export const cambiarActivoEmpleado = async (req, res) => {
  const { activo } = req.body;

  if (typeof activo !== "boolean") {
    return res
      .status(400)
      .json({ mensaje: "El campo activo tiene que ser true o false" });
  }

  const idEmpresa = req.usuario.id_empresa;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // activo y fecha_fin se mueven juntos, en un solo UPDATE: no pueden quedar
    // en estados contradictorios (inactivo sin fecha de salida).
    const actualizado = await client.query(
      `UPDATE empleados_x_empresa
       SET activo = $1,
           fecha_fin = CASE WHEN $1 THEN NULL ELSE CURRENT_DATE END
       WHERE id_empleado = $2 AND id_empresa = $3
       RETURNING id_empleado`,
      [activo, req.params.id, idEmpresa]
    );

    if (actualizado.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }

    if (!activo) {
      const usuario = await client.query(
        `SELECT id_usuario FROM usuarios
         WHERE id_empleado = $1 AND id_empresa = $2 AND activo = TRUE`,
        [req.params.id, idEmpresa]
      );

      if (usuario.rows.length > 0) {
        const { error } = await aplicarCambiosUsuario(
          client,
          idEmpresa,
          usuario.rows[0].id_usuario,
          { activo: false },
          req.usuario.id
        );

        if (error) {
          await client.query("ROLLBACK");
          return res.status(error.status).json({ mensaje: error.mensaje });
        }
      }
    }

    const empleado = await buscarEmpleado(client, req.params.id, idEmpresa);

    await client.query("COMMIT");
    res.json(empleado);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error);
  } finally {
    client.release();
  }
};

// POST /api/empleados/:id/acceso   (solo admin)
// Le da usuario a un empleado que ya existe. Para cambiar el rol, desactivar el
// acceso o resetear la contrasena se usa /usuarios.
export const darAcceso = async (req, res) => {
  const acceso = req.body ?? {};
  const idEmpresa = req.usuario.id_empresa;

  if (accesoIncompleto(acceso)) {
    return res.status(400).json({ mensaje: MENSAJES.accesoObligatorios });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // FOR UPDATE del vinculo: dos "Dar acceso" a la vez sobre el mismo
    // empleado se esperan, y el segundo ve que ya tiene acceso.
    const vinculo = await client.query(
      `SELECT 1 FROM empleados_x_empresa
       WHERE id_empleado = $1 AND id_empresa = $2 FOR UPDATE`,
      [req.params.id, idEmpresa]
    );
    const empleado = vinculo.rows.length
      ? await buscarEmpleado(client, req.params.id, idEmpresa)
      : null;

    if (!empleado) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: MENSAJES.noEncontrado });
    }
    if (empleado.acceso) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.yaTieneAcceso });
    }
    if (!empleado.activo) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: MENSAJES.noActivo });
    }

    const { error } = await insertarUsuario(client, idEmpresa, {
      nombre: `${empleado.nombre} ${empleado.apellido}`,
      email: acceso.email,
      password: acceso.password,
      rol: acceso.rol,
      id_empleado: req.params.id
    });

    if (error) {
      await client.query("ROLLBACK");
      return res.status(error.status).json({ mensaje: error.mensaje });
    }

    const actualizado = await buscarEmpleado(client, req.params.id, idEmpresa);

    await client.query("COMMIT");
    res.status(201).json(actualizado);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error, mensajesDuplicadoUsuario(error));
  } finally {
    client.release();
  }
};
