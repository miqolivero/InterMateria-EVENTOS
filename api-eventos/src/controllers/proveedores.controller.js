import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { construirFiltros } from "../utils/consultas.js";

// Proveedores: quien presta los servicios. Lo distinto de este recurso es que
// cada proveedor trae la lista de servicios que OFRECE (proveedores_x_servicio),
// que es lo que despues filtra el Select de proveedor del presupuesto.

const CAMPOS_BUSQUEDA = ["p.razon_social", "p.cuit", "p.email"];
const MENSAJES = { duplicado: "Ya existe un proveedor con ese CUIT" };

// El array servicios se arma en el SQL con un subselect agregado, no con un
// GROUP BY sobre el JOIN: asi un proveedor sin servicios devuelve [] en vez de
// desaparecer del listado o traer una fila con nulls.
// COALESCE deja [] cuando no hay ninguno, nunca null.
const SELECT_PROVEEDOR = `
  SELECT p.id_proveedor, p.razon_social, p.cuit, p.email, p.telefono,
         p.direccion, p.observaciones, p.activo,
         COALESCE(
           (SELECT json_agg(json_build_object('id_servicio', s.id_servicio,
                                              'nombre', s.nombre)
                            ORDER BY s.nombre)
            FROM proveedores_x_servicio pxs
            JOIN servicios s ON s.id_servicio = pxs.id_servicio
            WHERE pxs.id_proveedor = p.id_proveedor),
           '[]'
         ) AS servicios
  FROM proveedores p`;

// Devuelve el proveedor completo, con sus servicios. Se usa despues de crear,
// editar o cambiar la lista de servicios, para que todas las respuestas del
// recurso tengan la misma forma que dice el contrato.
const buscarProveedor = async (ejecutor, idProveedor, idEmpresa) => {
  const resultado = await ejecutor.query(
    `${SELECT_PROVEEDOR} WHERE p.id_proveedor = $1 AND p.id_empresa = $2`,
    [idProveedor, idEmpresa]
  );

  return resultado.rows[0] ?? null;
};

// GET /api/proveedores?activo=true|false&buscar=texto&id_servicio=3
export const obtenerProveedores = async (req, res) => {
  const condicionesBase = ["p.id_empresa = $1"];
  const valoresBase = [req.usuario.id_empresa];

  // Filtro extra del contrato: solo los proveedores que ofrecen ese servicio.
  // Va con EXISTS y no con un JOIN para no duplicar filas.
  if (req.query.id_servicio) {
    valoresBase.push(req.query.id_servicio);
    condicionesBase.push(
      `EXISTS (SELECT 1 FROM proveedores_x_servicio pxs
               WHERE pxs.id_proveedor = p.id_proveedor
                 AND pxs.id_servicio = $${valoresBase.length})`
    );
  }

  const { where, valores } = construirFiltros(req.query, CAMPOS_BUSQUEDA, {
    condicionesBase,
    valoresBase,
    columnaActivo: "p.activo"
  });

  try {
    const resultado = await pool.query(
      `${SELECT_PROVEEDOR} ${where} ORDER BY p.razon_social`,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/proveedores/:id
export const obtenerProveedorPorId = async (req, res) => {
  try {
    const proveedor = await buscarProveedor(
      pool,
      req.params.id,
      req.usuario.id_empresa
    );

    if (!proveedor) {
      return res.status(404).json({ mensaje: "Proveedor no encontrado" });
    }

    res.json(proveedor);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/proveedores
export const crearProveedor = async (req, res) => {
  const { razon_social, cuit, email, telefono, direccion, observaciones } =
    req.body;

  if (!razon_social) {
    return res.status(400).json({ mensaje: "La razon social es obligatoria" });
  }

  try {
    const creado = await pool.query(
      `INSERT INTO proveedores (id_empresa, razon_social, cuit, email,
                                telefono, direccion, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_proveedor`,
      [
        req.usuario.id_empresa,
        razon_social,
        cuit ?? null,
        email ?? null,
        telefono ?? null,
        direccion ?? null,
        observaciones ?? null
      ]
    );

    // Se vuelve a leer para devolver tambien servicios: [] y que la respuesta
    // tenga la misma forma que el GET.
    const proveedor = await buscarProveedor(
      pool,
      creado.rows[0].id_proveedor,
      req.usuario.id_empresa
    );

    res.status(201).json(proveedor);
  } catch (error) {
    responderError(res, error, MENSAJES);
  }
};

// PUT /api/proveedores/:id
// La lista de servicios NO se toca acá: tiene su propio endpoint, como dice el
// contrato.
export const editarProveedor = async (req, res) => {
  const {
    razon_social,
    cuit,
    email,
    telefono,
    direccion,
    observaciones,
    activo
  } = req.body;

  if (!razon_social) {
    return res.status(400).json({ mensaje: "La razon social es obligatoria" });
  }

  try {
    const actualizado = await pool.query(
      `UPDATE proveedores
       SET razon_social = $1,
           cuit = $2,
           email = $3,
           telefono = $4,
           direccion = $5,
           observaciones = $6,
           activo = COALESCE($7, activo)
       WHERE id_proveedor = $8 AND id_empresa = $9
       RETURNING id_proveedor`,
      [
        razon_social,
        cuit ?? null,
        email ?? null,
        telefono ?? null,
        direccion ?? null,
        observaciones ?? null,
        activo ?? null,
        req.params.id,
        req.usuario.id_empresa
      ]
    );

    if (actualizado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Proveedor no encontrado" });
    }

    const proveedor = await buscarProveedor(
      pool,
      req.params.id,
      req.usuario.id_empresa
    );

    res.json(proveedor);
  } catch (error) {
    responderError(res, error, MENSAJES);
  }
};

// PATCH /api/proveedores/:id/activo
export const cambiarActivoProveedor = async (req, res) => {
  const { activo } = req.body;

  if (typeof activo !== "boolean") {
    return res
      .status(400)
      .json({ mensaje: "El campo activo tiene que ser true o false" });
  }

  try {
    const actualizado = await pool.query(
      `UPDATE proveedores SET activo = $1
       WHERE id_proveedor = $2 AND id_empresa = $3
       RETURNING id_proveedor`,
      [activo, req.params.id, req.usuario.id_empresa]
    );

    if (actualizado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Proveedor no encontrado" });
    }

    const proveedor = await buscarProveedor(
      pool,
      req.params.id,
      req.usuario.id_empresa
    );

    res.json(proveedor);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/proveedores/:id/servicios
export const obtenerServiciosDelProveedor = async (req, res) => {
  try {
    // Primero se verifica el proveedor: si es de otra empresa, 404. Sin esta
    // comprobacion se podria averiguar que servicios ofrece un proveedor
    // ajeno.
    const proveedor = await buscarProveedor(
      pool,
      req.params.id,
      req.usuario.id_empresa
    );

    if (!proveedor) {
      return res.status(404).json({ mensaje: "Proveedor no encontrado" });
    }

    res.json(proveedor.servicios);
  } catch (error) {
    responderError(res, error);
  }
};

// PUT /api/proveedores/:id/servicios
// Reemplaza la lista completa de servicios que ofrece el proveedor.
export const reemplazarServiciosDelProveedor = async (req, res) => {
  const { ids_servicios } = req.body;

  if (!Array.isArray(ids_servicios)) {
    return res
      .status(400)
      .json({ mensaje: "ids_servicios tiene que ser una lista" });
  }

  // Se saca lo repetido: el UNIQUE (id_proveedor, id_servicio) de la base
  // rechazaria el INSERT y seria un 400 confuso para el front.
  const idsUnicos = [...new Set(ids_servicios.map(Number))];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const proveedor = await buscarProveedor(
      client,
      req.params.id,
      req.usuario.id_empresa
    );

    if (!proveedor) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: "Proveedor no encontrado" });
    }

    // Todos los servicios tienen que ser de la misma empresa. Se cuentan en
    // una sola consulta: si faltan, alguno no existe o es de otra empresa.
    if (idsUnicos.length > 0) {
      const validos = await client.query(
        `SELECT COUNT(*)::int AS cantidad FROM servicios
         WHERE id_servicio = ANY($1::int[]) AND id_empresa = $2`,
        [idsUnicos, req.usuario.id_empresa]
      );

      if (validos.rows[0].cantidad !== idsUnicos.length) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ mensaje: "Alguno de los servicios no existe" });
      }
    }

    // Borrar e insertar van en la misma transaccion: si fallara el INSERT, el
    // proveedor no puede quedarse sin ningun servicio.
    await client.query(
      "DELETE FROM proveedores_x_servicio WHERE id_proveedor = $1",
      [req.params.id]
    );

    if (idsUnicos.length > 0) {
      // UNNEST inserta todos los ids en una sola sentencia
      await client.query(
        `INSERT INTO proveedores_x_servicio (id_proveedor, id_servicio)
         SELECT $1, UNNEST($2::int[])`,
        [req.params.id, idsUnicos]
      );
    }

    const actualizado = await buscarProveedor(
      client,
      req.params.id,
      req.usuario.id_empresa
    );

    await client.query("COMMIT");

    res.json(actualizado);
  } catch (error) {
    await client.query("ROLLBACK");
    responderError(res, error);
  } finally {
    // Siempre se devuelve el client al pool, pase lo que pase
    client.release();
  }
};
