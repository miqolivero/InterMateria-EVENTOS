import pool from "../data/db.js";
import { responderError } from "../utils/errores.js";
import { esEmpleadoActivo } from "../utils/consultas.js";
import {
  esIdValido,
  esFechaValida,
  esImporteValido,
  esEnteroPositivo,
  esVacio
} from "../utils/validaciones.js";
import {
  MENSAJES_CAMBIO,
  tieneTexto,
  leerTareasAfectadas,
  sonTareasDelEvento,
  registrarCambio,
  marcarAfectados
} from "../utils/cambios.js";
import {
  ESTADOS_EVENTO_ABIERTO,
  MENSAJE_EVENTO_CERRADO,
  SELECT_SERVICIO_EVENTO
} from "./eventos.controller.js";
import {
  SELECT_TAREA,
  objetoServicioEmpleado,
  responsableObligatorio
} from "./tareas.controller.js";
import {
  validarFormatoRenglon,
  validarRenglonEnEmpresa
} from "./presupuestos.controller.js";

// Servicios del evento: lo ACORDADO con cada proveedor (servicios_x_evento) y
// su estado. El estado del proveedor es independiente de las tareas internas
// (regla 6).
//
// Fase 11: lo acordado puede cambiar despues de confirmar. Cada cambio de lo
// acordado (alta, modificacion, cancelacion, proveedor) va con motivo y queda
// en cambios_evento, en la MISMA transaccion que el cambio. El seguimiento
// normal del proveedor (/estado) no es un cambio del acuerdo: no pide motivo.
//
// servicios_x_evento no tiene id_empresa: es de la empresa de su evento. Todo
// entra por JOIN eventos e ... AND e.id_empresa.

const MENSAJES = {
  noEncontrado: "Servicio del evento no encontrado",
  eventoNoEncontrado: "Evento no encontrado",
  estadoInvalido: "Estado de proveedor invalido",
  proveedorNoOfrece: "El proveedor no ofrece ese servicio",
  proveedorYaAsignado: "El proveedor ya esta asignado a este servicio",
  sinProveedor: "El servicio no tiene proveedor asignado",
  importesNegativos: "Los importes no pueden ser negativos",
  cantidadInvalida: "La cantidad tiene que ser mayor a 0",
  faltanDatosTareas: "Hay que indicar el responsable y al menos un paso",
  pasosRepetidos: "Hay pasos repetidos en el pedido",
  pasoInexistente: "Alguno de los pasos no existe",
  pasoExistente: "Ese paso ya tiene una tarea en este servicio",
  responsableInvalido: "El responsable no es un empleado activo de la empresa"
};

export const ESTADOS_PROVEEDOR = ["pendiente", "confirmado", "completado", "rechazado"];

// El texto que se guarda como motivo cuando se asigna el primer proveedor
const MOTIVO_ASIGNACION_INICIAL = "Asignacion inicial";

// El servicio del evento si es de la empresa, con lo que hace falta para
// validar un cambio. bloquear: FOR UPDATE, para los cambios en transaccion.
// idResponsable (rol empleado): ademas tiene que tener alguna tarea suya.
const datosServicio = async (ejecutor, idServicioEvento, idEmpresa, { bloquear = false, idResponsable = null } = {}) => {
  const resultado = await ejecutor.query(
    `SELECT sxe.id_servicio_x_evento, sxe.id_evento, sxe.id_servicio, sxe.id_proveedor,
            sxe.descripcion, sxe.cantidad, sxe.costo_acordado_proveedor,
            sxe.importe_acordado_cliente, sxe.estado_servicio,
            sv.nombre AS nombre_servicio, pr.razon_social AS nombre_proveedor,
            e.estado AS estado_evento
     FROM servicios_x_evento sxe
     JOIN eventos e ON e.id_evento = sxe.id_evento
     JOIN servicios sv ON sv.id_servicio = sxe.id_servicio
     LEFT JOIN proveedores pr ON pr.id_proveedor = sxe.id_proveedor
     WHERE sxe.id_servicio_x_evento = $1 AND e.id_empresa = $2
       AND ($3::int IS NULL OR EXISTS (
             SELECT 1 FROM tareas t
             WHERE t.id_servicio_x_evento = sxe.id_servicio_x_evento
               AND t.id_empleado_responsable = $3::int))
     ${bloquear ? "FOR UPDATE OF sxe" : ""}`,
    [idServicioEvento, idEmpresa, idResponsable]
  );

  return resultado.rows[0] ?? null;
};

// 404, evento cerrado o servicio cancelado: los tres cortan cualquier cambio
const errorDeServicio = (servicio, mensajeNoEncontrado = MENSAJES.noEncontrado) => {
  if (!servicio) return { status: 404, mensaje: mensajeNoEncontrado };
  if (!ESTADOS_EVENTO_ABIERTO.includes(servicio.estado_evento)) {
    return { status: 409, mensaje: MENSAJE_EVENTO_CERRADO };
  }
  if (servicio.estado_servicio === "cancelado") {
    return { status: 409, mensaje: MENSAJES_CAMBIO.servicioCancelado };
  }
  return null;
};

const buscarServicioEvento = async (ejecutor, idServicioEvento) => {
  const resultado = await ejecutor.query(
    `${SELECT_SERVICIO_EVENTO} WHERE sxe.id_servicio_x_evento = $1`,
    [idServicioEvento]
  );

  return resultado.rows[0];
};

// El proveedor tiene que ser de la empresa, estar activo y ofrecer ESE servicio
const proveedorOfrece = async (ejecutor, idProveedor, idServicio, idEmpresa) => {
  const ofrece = await ejecutor.query(
    `SELECT 1 FROM proveedores_x_servicio pxs
     JOIN proveedores pr ON pr.id_proveedor = pxs.id_proveedor
     WHERE pxs.id_proveedor = $1 AND pxs.id_servicio = $2
       AND pr.id_empresa = $3 AND pr.activo = TRUE`,
    [idProveedor, idServicio, idEmpresa]
  );

  return ofrece.rows.length > 0;
};

// Corre fn dentro de una transaccion. fn devuelve { error } (se hace ROLLBACK
// y se responde ese error) o { status, respuesta }. Cualquier excepcion, por
// ejemplo que falle el INSERT del registro del cambio, tambien hace ROLLBACK:
// el cambio no queda guardado sin su registro.
const enTransaccion = async (res, fn, mensajesError = {}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const resultado = await fn(client);

    if (resultado.error) {
      await client.query("ROLLBACK");
      return res.status(resultado.error.status).json({ mensaje: resultado.error.mensaje });
    }

    await client.query("COMMIT");
    return res.status(resultado.status ?? 200).json(resultado.respuesta);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505" && mensajesError.duplicado409) {
      return res.status(409).json({ mensaje: mensajesError.duplicado409 });
    }
    return responderError(res, error);
  } finally {
    client.release();
  }
};

// El motivo y las tareas afectadas, comunes a todos los cambios. Devuelve un
// error o las tareas validadas.
const validarMotivoYTareas = async (client, body, idEvento, { motivoObligatorio = true } = {}) => {
  if (motivoObligatorio && !tieneTexto(body.motivo)) {
    return { error: { status: 400, mensaje: MENSAJES_CAMBIO.motivoObligatorio } };
  }
  const tareas = leerTareasAfectadas(body.tareas_afectadas);
  if (!tareas || !(await sonTareasDelEvento(client, idEvento, tareas))) {
    return { error: { status: 400, mensaje: MENSAJES_CAMBIO.tareasAjenas } };
  }
  return { tareas };
};

// Resumen legible de lo acordado: "cantidad: 180 · importe cliente: 1300000".
// Va en valor_anterior y valor_nuevo, que el empleado no recibe.
const ETIQUETAS = {
  descripcion: "descripcion",
  cantidad: "cantidad",
  costo_acordado_proveedor: "costo proveedor",
  importe_acordado_cliente: "importe cliente"
};
const resumirCampos = (datos, campos) =>
  campos.map((campo) => `${ETIQUETAS[campo]}: ${datos[campo] ?? "-"}`).join(" · ");

// ---------------------------------------------------------------------------
// Cambios de lo acordado (Fase 11)
// ---------------------------------------------------------------------------

// POST /api/eventos/:id/servicios
// Un servicio nuevo despues de confirmar. Nace con el proveedor 'pendiente'
// (DEFAULT), asi que ya cuenta como "sin confirmar": no hace falta marcarlo.
export const agregarServicioEvento = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const body = req.body ?? {};

  // Mismas validaciones que un renglon del presupuesto
  const renglon = {
    id_servicio: body.id_servicio,
    id_proveedor: body.id_proveedor,
    cantidad: body.cantidad,
    costo_proveedor: body.costo_acordado_proveedor,
    importe_cliente: body.importe_acordado_cliente
  };
  const errorFormato = validarFormatoRenglon(renglon);
  if (errorFormato) {
    return res.status(400).json({ mensaje: errorFormato });
  }
  if (!tieneTexto(body.motivo)) {
    return res.status(400).json({ mensaje: MENSAJES_CAMBIO.motivoObligatorio });
  }

  await enTransaccion(res, async (client) => {
    const evento = await client.query(
      "SELECT estado FROM eventos WHERE id_evento = $1 AND id_empresa = $2 FOR UPDATE",
      [req.params.id, idEmpresa]
    );
    if (evento.rows.length === 0) {
      return { error: { status: 404, mensaje: MENSAJES.eventoNoEncontrado } };
    }
    if (!ESTADOS_EVENTO_ABIERTO.includes(evento.rows[0].estado)) {
      return { error: { status: 409, mensaje: MENSAJE_EVENTO_CERRADO } };
    }

    const errorEmpresa = await validarRenglonEnEmpresa(client, renglon, idEmpresa);
    if (errorEmpresa) {
      return { error: { status: 400, mensaje: errorEmpresa } };
    }

    const validacion = await validarMotivoYTareas(client, body, req.params.id);
    if (validacion.error) return validacion;

    const valores = {
      descripcion: tieneTexto(body.descripcion) ? body.descripcion.trim() : null,
      cantidad: esVacio(body.cantidad) ? 1 : Number(body.cantidad),
      costo_acordado_proveedor: esVacio(body.costo_acordado_proveedor) ? 0 : Number(body.costo_acordado_proveedor),
      importe_acordado_cliente: Number(body.importe_acordado_cliente)
    };

    const nuevo = await client.query(
      `INSERT INTO servicios_x_evento (id_evento, id_servicio, id_proveedor, descripcion,
                                       cantidad, costo_acordado_proveedor,
                                       importe_acordado_cliente)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_servicio_x_evento`,
      [
        req.params.id,
        body.id_servicio,
        esVacio(body.id_proveedor) ? null : body.id_proveedor,
        valores.descripcion,
        valores.cantidad,
        valores.costo_acordado_proveedor,
        valores.importe_acordado_cliente
      ]
    );
    const idServicioEvento = nuevo.rows[0].id_servicio_x_evento;
    const servicio = await buscarServicioEvento(client, idServicioEvento);

    const idCambio = await registrarCambio(client, {
      idEvento: req.params.id,
      idUsuario: req.usuario.id,
      tipo: "servicio_agregado",
      idServicioEvento,
      descripcion: `Se agrego el servicio ${servicio.nombre_servicio}`,
      valorNuevo: resumirCampos(valores, Object.keys(ETIQUETAS)),
      motivo: body.motivo
    });
    await marcarAfectados(client, idCambio, { tareas: validacion.tareas });

    return { status: 201, respuesta: await buscarServicioEvento(client, idServicioEvento) };
  });
};

// PUT /api/servicios-evento/:id
// Modifica lo acordado. PARCIAL: se comparan solo los campos que vienen, asi
// un campo que el front no manda no borra un importe. El servicio queda a
// revisar (lo acordado con el proveedor cambio).
export const modificarServicioEvento = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const body = req.body ?? {};
  const vino = (campo) => Object.hasOwn(body, campo);

  if (vino("cantidad") && !esEnteroPositivo(body.cantidad)) {
    return res.status(400).json({ mensaje: MENSAJES.cantidadInvalida });
  }
  const importeMal = ["costo_acordado_proveedor", "importe_acordado_cliente"].some(
    (campo) => vino(campo) && !esImporteValido(body[campo])
  );
  if (importeMal) {
    return res.status(400).json({ mensaje: MENSAJES.importesNegativos });
  }

  await enTransaccion(res, async (client) => {
    const servicio = await datosServicio(client, req.params.id, idEmpresa, { bloquear: true });
    const errorServicio = errorDeServicio(servicio);
    if (errorServicio) return { error: errorServicio };

    // Lo que vino y es distinto de lo guardado
    const nuevo = {};
    if (vino("descripcion")) {
      nuevo.descripcion = tieneTexto(body.descripcion) ? body.descripcion.trim() : null;
    }
    for (const campo of ["cantidad", "costo_acordado_proveedor", "importe_acordado_cliente"]) {
      if (vino(campo)) nuevo[campo] = Number(body[campo]);
    }
    const cambiados = Object.keys(nuevo).filter((campo) => nuevo[campo] !== servicio[campo]);

    if (cambiados.length === 0) {
      return { error: { status: 400, mensaje: MENSAJES_CAMBIO.sinCambios } };
    }

    const validacion = await validarMotivoYTareas(client, body, servicio.id_evento);
    if (validacion.error) return validacion;

    // Los nombres de columna salen de la lista fija de arriba, nunca del
    // request; los valores van parametrizados.
    const valores = cambiados.map((campo) => nuevo[campo]);
    await client.query(
      `UPDATE servicios_x_evento
       SET ${cambiados.map((campo, i) => `${campo} = $${i + 1}`).join(", ")}
       WHERE id_servicio_x_evento = $${cambiados.length + 1}`,
      [...valores, req.params.id]
    );

    // La descripcion la ve el empleado: dice QUE cambio, nunca los montos
    const nombresCampos = [...new Set(cambiados.map((campo) =>
      campo.endsWith("_proveedor") || campo.endsWith("_cliente") ? "importes" : campo))];

    const idCambio = await registrarCambio(client, {
      idEvento: servicio.id_evento,
      idUsuario: req.usuario.id,
      tipo: "servicio_modificado",
      idServicioEvento: servicio.id_servicio_x_evento,
      descripcion: `Cambio en lo acordado de ${servicio.nombre_servicio}: ${nombresCampos.join(", ")}`,
      valorAnterior: resumirCampos(servicio, cambiados),
      valorNuevo: resumirCampos(nuevo, cambiados),
      motivo: body.motivo
    });
    await marcarAfectados(client, idCambio, {
      servicios: [servicio.id_servicio_x_evento],
      tareas: validacion.tareas
    });

    return { respuesta: await buscarServicioEvento(client, req.params.id) };
  });
};

// PUT /api/servicios-evento/:id/proveedor
// Asigna, reemplaza o quita el proveedor. El anterior queda en el historial
// (id_proveedor_anterior), asi se sabe quien estuvo a cargo. El proveedor
// nuevo arranca 'pendiente': el sistema no da nada por confirmado.
export const cambiarProveedor = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const body = req.body ?? {};

  if (!Object.hasOwn(body, "id_proveedor")) {
    return res.status(400).json({ mensaje: MENSAJES_CAMBIO.sinCambios });
  }
  const idNuevo = esVacio(body.id_proveedor) ? null : body.id_proveedor;
  if (idNuevo !== null && !esIdValido(idNuevo)) {
    return res.status(400).json({ mensaje: MENSAJES.proveedorNoOfrece });
  }

  await enTransaccion(res, async (client) => {
    const servicio = await datosServicio(client, req.params.id, idEmpresa, { bloquear: true });
    const errorServicio = errorDeServicio(servicio);
    if (errorServicio) return { error: errorServicio };

    const idAnterior = servicio.id_proveedor;
    if (idAnterior === null && idNuevo === null) {
      return { error: { status: 400, mensaje: MENSAJES_CAMBIO.sinCambios } };
    }
    if (idNuevo !== null && Number(idNuevo) === idAnterior) {
      return { error: { status: 400, mensaje: MENSAJES.proveedorYaAsignado } };
    }
    if (idNuevo !== null && !(await proveedorOfrece(client, idNuevo, servicio.id_servicio, idEmpresa))) {
      return { error: { status: 400, mensaje: MENSAJES.proveedorNoOfrece } };
    }

    // Reemplazar o quitar un proveedor es un cambio del acuerdo: motivo
    // obligatorio. La primera asignacion no reemplaza a nadie.
    const validacion = await validarMotivoYTareas(client, body, servicio.id_evento, {
      motivoObligatorio: idAnterior !== null
    });
    if (validacion.error) return validacion;

    const nuevo = await client.query(
      `UPDATE servicios_x_evento
       SET id_proveedor = $1, estado_proveedor = 'pendiente',
           fecha_confirmacion_proveedor = NULL
       WHERE id_servicio_x_evento = $2
       RETURNING (SELECT razon_social FROM proveedores WHERE id_proveedor = $1::int) AS razon_social`,
      [idNuevo, req.params.id]
    );

    const nombre = servicio.nombre_servicio;
    let descripcion = `Cambio de proveedor de ${nombre}`;
    if (idAnterior === null) descripcion = `Se asigno proveedor a ${nombre}`;
    if (idNuevo === null) descripcion = `Se quito el proveedor de ${nombre}`;

    const idCambio = await registrarCambio(client, {
      idEvento: servicio.id_evento,
      idUsuario: req.usuario.id,
      tipo: "proveedor_cambiado",
      idServicioEvento: servicio.id_servicio_x_evento,
      idProveedorAnterior: idAnterior,
      idProveedorNuevo: idNuevo,
      descripcion,
      valorAnterior: servicio.nombre_proveedor,
      valorNuevo: nuevo.rows[0].razon_social,
      motivo: tieneTexto(body.motivo) ? body.motivo : MOTIVO_ASIGNACION_INICIAL
    });
    await marcarAfectados(client, idCambio, { tareas: validacion.tareas });

    return { respuesta: await buscarServicioEvento(client, req.params.id) };
  });
};

// PATCH /api/servicios-evento/:id/cancelar
// Quita el servicio SIN borrarlo. Sus tareas no se cancelan ni se borran
// solas: las que el usuario elige quedan a revisar, y el resto sigue igual.
export const cancelarServicio = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const body = req.body ?? {};

  if (!tieneTexto(body.motivo)) {
    return res.status(400).json({ mensaje: MENSAJES_CAMBIO.motivoObligatorio });
  }

  await enTransaccion(res, async (client) => {
    const servicio = await datosServicio(client, req.params.id, idEmpresa, { bloquear: true });
    const errorServicio = errorDeServicio(servicio);
    if (errorServicio) return { error: errorServicio };

    const validacion = await validarMotivoYTareas(client, body, servicio.id_evento);
    if (validacion.error) return validacion;

    await client.query(
      "UPDATE servicios_x_evento SET estado_servicio = 'cancelado' WHERE id_servicio_x_evento = $1",
      [req.params.id]
    );

    const idCambio = await registrarCambio(client, {
      idEvento: servicio.id_evento,
      idUsuario: req.usuario.id,
      tipo: "servicio_cancelado",
      idServicioEvento: servicio.id_servicio_x_evento,
      descripcion: `Se cancelo el servicio ${servicio.nombre_servicio}`,
      valorAnterior: "acordado",
      valorNuevo: "cancelado",
      motivo: body.motivo
    });
    await marcarAfectados(client, idCambio, { tareas: validacion.tareas });

    return { respuesta: await buscarServicioEvento(client, req.params.id) };
  });
};

// ---------------------------------------------------------------------------
// Seguimiento del proveedor (no es un cambio del acuerdo)
// ---------------------------------------------------------------------------

// El empleado gestiona al proveedor de los servicios donde tiene tareas: solo
// el estado y las observaciones. El proveedor asignado y los importes son
// decisiones del coordinador, y los importes ni siquiera los puede ver.
const CAMPOS_EMPLEADO = ["estado_proveedor", "observaciones"];

const MENSAJES_EMPLEADO = {
  camposProhibidos: "Solo podes actualizar el estado y las observaciones del proveedor",
  noEncontrado: "Servicio no encontrado"
};

// PATCH /api/servicios-evento/:id/estado
// Reemplaza al PATCH /:id de la Fase 6. Sin motivo y sin historial. Las
// transiciones son libres entre los 4 estados; lo unico que se exige es que
// haya un proveedor para darlo por confirmado o completado.
// Regla 6: no modifica ninguna tarea.
export const cambiarEstadoProveedor = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const idEmpleado = responsableObligatorio(req.usuario);
  const esEmpleado = idEmpleado !== null;
  const body = req.body ?? {};
  const vino = (campo) => Object.hasOwn(body, campo);

  // El 403 va antes que la base, asi no revela si el servicio existe
  if (esEmpleado && Object.keys(body).some((campo) => !CAMPOS_EMPLEADO.includes(campo))) {
    return res.status(403).json({ mensaje: MENSAJES_EMPLEADO.camposProhibidos });
  }
  if (vino("estado_proveedor") && !ESTADOS_PROVEEDOR.includes(body.estado_proveedor)) {
    return res.status(400).json({ mensaje: MENSAJES.estadoInvalido });
  }

  try {
    // Regla 11: el empleado solo encuentra los servicios donde tiene tareas
    const servicio = await datosServicio(pool, req.params.id, idEmpresa, { idResponsable: idEmpleado });
    const errorServicio = errorDeServicio(
      servicio,
      esEmpleado ? MENSAJES_EMPLEADO.noEncontrado : MENSAJES.noEncontrado
    );
    if (errorServicio) {
      return res.status(errorServicio.status).json({ mensaje: errorServicio.mensaje });
    }

    if (["confirmado", "completado"].includes(body.estado_proveedor) && servicio.id_proveedor === null) {
      return res.status(409).json({ mensaje: MENSAJES.sinProveedor });
    }

    const sets = [];
    const valores = [];
    if (vino("estado_proveedor")) {
      // La fecha de confirmacion: se pone hoy al confirmar (si ya estaba
      // confirmado o completado, se conserva), se completa si se salta
      // directo a completado y se limpia si vuelve a pendiente o rechaza.
      // En el SET, estado_proveedor todavia es el valor viejo. El ::varchar
      // evita que PostgreSQL deduzca dos tipos para el mismo parametro.
      valores.push(body.estado_proveedor);
      const n = valores.length;
      sets.push(`estado_proveedor = $${n}`);
      sets.push(`fecha_confirmacion_proveedor = CASE
        WHEN $${n}::varchar = 'confirmado' AND estado_proveedor NOT IN ('confirmado', 'completado') THEN CURRENT_DATE
        WHEN $${n}::varchar IN ('confirmado', 'completado') THEN COALESCE(fecha_confirmacion_proveedor, CURRENT_DATE)
        ELSE NULL END`);
    }
    if (vino("observaciones")) {
      valores.push(body.observaciones ?? null);
      sets.push(`observaciones = $${valores.length}`);
    }

    // Un body vacio no es un error: devuelve el servicio como esta
    if (sets.length > 0) {
      valores.push(req.params.id);
      await pool.query(
        `UPDATE servicios_x_evento SET ${sets.join(", ")}
         WHERE id_servicio_x_evento = $${valores.length}`,
        valores
      );
    }

    if (!esEmpleado) {
      return res.json(await buscarServicioEvento(pool, req.params.id));
    }

    // Para el empleado, el objeto "servicio" de /tareas/mias: sin importes
    const respuesta = await pool.query(
      `SELECT ${objetoServicioEmpleado("sxe", "sv", "pr")} AS servicio
       FROM servicios_x_evento sxe
       JOIN servicios sv ON sv.id_servicio = sxe.id_servicio
       LEFT JOIN proveedores pr ON pr.id_proveedor = sxe.id_proveedor
       WHERE sxe.id_servicio_x_evento = $1`,
      [req.params.id]
    );

    res.json(respuesta.rows[0].servicio);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/servicios-evento/:id/generar-tareas
// Crea los pasos ELEGIDOS (Fase 11), con su fecha cada uno, en cualquier
// orden. Se puede volver a llamar para sumar los que falten. Un paso que ya
// tiene tarea en el servicio responde 409: el indice unico de la base lo
// asegura aunque dos pedidos lleguen a la vez.
export const generarTareas = async (req, res) => {
  const idEmpresa = req.usuario.id_empresa;
  const { id_empleado_responsable, pasos } = req.body ?? {};

  const pasosOk =
    Array.isArray(pasos) &&
    pasos.length > 0 &&
    pasos.every((paso) => paso && esIdValido(paso.id_tipo_tarea) && esFechaValida(paso.fecha_prevista));

  if (esVacio(id_empleado_responsable) || !pasosOk) {
    return res.status(400).json({ mensaje: MENSAJES.faltanDatosTareas });
  }
  if (!esIdValido(id_empleado_responsable)) {
    return res.status(400).json({ mensaje: MENSAJES.responsableInvalido });
  }

  const tipos = pasos.map((paso) => Number(paso.id_tipo_tarea));
  if (new Set(tipos).size !== tipos.length) {
    return res.status(400).json({ mensaje: MENSAJES.pasosRepetidos });
  }

  await enTransaccion(res, async (client) => {
    const servicio = await datosServicio(client, req.params.id, idEmpresa, { bloquear: true });
    const errorServicio = errorDeServicio(servicio);
    if (errorServicio) return { error: errorServicio };

    const existentes = await client.query(
      "SELECT COUNT(*)::int AS cantidad FROM tipos_tarea WHERE id_tipo_tarea = ANY($1::int[])",
      [tipos]
    );
    if (existentes.rows[0].cantidad !== tipos.length) {
      return { error: { status: 400, mensaje: MENSAJES.pasoInexistente } };
    }

    const repetidos = await client.query(
      `SELECT 1 FROM tareas
       WHERE id_servicio_x_evento = $1 AND id_tipo_tarea = ANY($2::int[]) LIMIT 1`,
      [req.params.id, tipos]
    );
    if (repetidos.rows.length > 0) {
      return { error: { status: 409, mensaje: MENSAJES.pasoExistente } };
    }

    // Regla 9: el responsable trabaja hoy en la empresa
    if (!(await esEmpleadoActivo(client, id_empleado_responsable, idEmpresa))) {
      return { error: { status: 400, mensaje: MENSAJES.responsableInvalido } };
    }

    // Todas en un INSERT ... SELECT: unnest arma una fila por paso con su
    // fecha. La descripcion se arma sola: "<paso> · <servicio> (<proveedor>)";
    // sin proveedor, el parentesis no va (null || texto = null).
    const creadas = await client.query(
      `INSERT INTO tareas (id_evento, id_empleado_responsable, id_servicio_x_evento,
                           id_tipo_tarea, descripcion, fecha_prevista)
       SELECT sxe.id_evento, $2, sxe.id_servicio_x_evento, tt.id_tipo_tarea,
              tt.nombre || ' · ' || sv.nombre ||
                COALESCE(' (' || pr.razon_social || ')', ''),
              p.fecha
       FROM unnest($3::int[], $4::date[]) AS p(id_tipo_tarea, fecha)
       JOIN tipos_tarea tt ON tt.id_tipo_tarea = p.id_tipo_tarea
       CROSS JOIN servicios_x_evento sxe
       JOIN servicios sv ON sv.id_servicio = sxe.id_servicio
       LEFT JOIN proveedores pr ON pr.id_proveedor = sxe.id_proveedor
       WHERE sxe.id_servicio_x_evento = $1
       RETURNING id_tarea`,
      [req.params.id, id_empleado_responsable, tipos, pasos.map((paso) => paso.fecha_prevista)]
    );

    const tareas = await client.query(
      `${SELECT_TAREA} WHERE t.id_tarea = ANY($1::int[]) ORDER BY tt.orden`,
      [creadas.rows.map((fila) => fila.id_tarea)]
    );

    return { status: 201, respuesta: tareas.rows };
  }, { duplicado409: MENSAJES.pasoExistente });
};
