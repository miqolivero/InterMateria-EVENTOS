import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import dayjs from "dayjs";
import api from "../src/servicios/axiosConfig.js";
import * as catalogos from "../src/servicios/catalogosService.js";
import * as operacion from "../src/servicios/operacionService.js";
import { camposPermitidos, fechaAPI, opcionesActivos, nombreCompleto } from "../src/utils/formularios.js";

let peticiones;
beforeEach(() => {
  peticiones = [];
  globalThis.localStorage = { getItem: () => "token-contrato" };
  api.defaults.adapter = async (config) => {
    peticiones.push({ metodo: config.method, url: config.url, params: config.params,
      body: config.data ? JSON.parse(config.data) : undefined });
    return { status: 200, data: {}, headers: {}, config };
  };
});

test("catálogos: filtros, PK y baja lógica según el contrato", async () => {
  for (const [recurso, ruta] of Object.entries({ clientes: "clientes", tipos: "tipos-eventos", servicios: "servicios", proveedores: "proveedores", empleados: "empleados" })) {
    await catalogos.listarCatalogo(recurso, { activo: false, buscar: "Ana" });
    assert.deepEqual(peticiones.at(-1), { metodo: "get", url: `/${ruta}`, params: { activo: false, buscar: "Ana" }, body: undefined });
    await catalogos.activarCatalogo(recurso, 4, false);
    assert.equal(peticiones.at(-1).url, `/${ruta}/4/activo`);
    assert.deepEqual(peticiones.at(-1).body, { activo: false });
  }
  await catalogos.guardarServiciosProveedor(2, [1, 3]);
  assert.deepEqual(peticiones.at(-1).body, { ids_servicios: [1, 3] });
});

test("presupuestos: versiones y detalle usan rutas exactas y no inventan totales", async () => {
  await operacion.crearPresupuesto(8);
  assert.equal(peticiones.at(-1).url, "/solicitudes/8/presupuestos");
  const detalle = { id_servicio: 2, id_proveedor: null, cantidad: 80, costo_proveedor: 100, importe_cliente: 150 };
  await operacion.agregarRenglon(3, detalle);
  assert.deepEqual(peticiones.at(-1).body, detalle);
  await operacion.editarRenglon(3, 7, detalle);
  assert.equal(peticiones.at(-1).url, "/presupuestos/3/detalle/7");
  await operacion.quitarRenglon(3, 7);
  assert.equal(peticiones.at(-1).metodo, "delete");
  await operacion.versionarPresupuesto(3);
  assert.equal(peticiones.at(-1).url, "/presupuestos/3/nueva-version");
});

test("tareas y proveedor envían estados separados y fechas ISO sin hora", async () => {
  await operacion.cambiarEstadoTarea(5, "completada");
  assert.deepEqual(peticiones.at(-1).body, { estado_tarea: "completada" });
  await operacion.estadoProveedor(2, { estado_proveedor: "confirmado" });
  assert.deepEqual(peticiones.at(-1), { metodo: "patch", url: "/servicios-evento/2/estado", params: undefined, body: { estado_proveedor: "confirmado" } });
  assert.equal(fechaAPI(dayjs("2026-11-01")), "2026-11-01");
  assert.equal(fechaAPI(null), null);
  await operacion.generarTareas(2, { id_empleado_responsable: 3, pasos: [{ id_tipo_tarea: 3, fecha_prevista: fechaAPI(dayjs("2026-11-01")) }] });
  assert.deepEqual(peticiones.at(-1).body.pasos, [{ id_tipo_tarea: 3, fecha_prevista: "2026-11-01" }]);
});

test("formularios excluyen empresa, ids, estados y campos calculados no editables", () => {
  const body = camposPermitidos({ nombre: " Ana ", apellido: " Pérez ", id_empresa: 2, id_cliente: 5, activo: false, importe_total: 100 }, ["nombre", "apellido", "email"]);
  assert.deepEqual(body, { nombre: "Ana", apellido: "Pérez", email: null });
  const opciones = opcionesActivos([{ id_cliente: 1, nombre: "Activo", activo: true }, { id_cliente: 2, nombre: "Inactivo", activo: false }], "id_cliente", "nombre", 2);
  assert.equal(opciones[1].disabled, true);
  assert.equal(nombreCompleto({ nombre: "Grupo Demo SA", apellido: "-" }), "Grupo Demo SA");
});

test("aceptación, cierre y feedback mantienen las rutas y los campos del contrato final", async () => {
  const acuerdo = { fecha_evento_confirmada: "2027-11-14", sede_acordada: "Salón", condiciones_acordadas: "Según propuesta", id_empleado_coordinador: null };
  await operacion.aceptarPresupuesto(2, acuerdo);
  assert.deepEqual(peticiones.at(-1), { metodo: "post", url: "/presupuestos/2/aceptar", params: undefined, body: acuerdo });
  await operacion.editarEvento(1, acuerdo);
  assert.equal(peticiones.at(-1).metodo, "put");
  assert.deepEqual(peticiones.at(-1).body, acuerdo);
  await operacion.cerrarEvento(1, { estado: "cancelado", observaciones_cierre: "Pedido del cliente" });
  assert.equal(peticiones.at(-1).url, "/eventos/1/cerrar");
  assert.equal(peticiones.at(-1).metodo, "patch");
  await operacion.guardarFeedback(1, { feedback_cliente: "Buena atención" });
  assert.deepEqual(peticiones.at(-1).body, { feedback_cliente: "Buena atención" });
  await operacion.resumenSeguimiento(15);
  assert.deepEqual(peticiones.at(-1).params, { dias: 15 });
});

test("fase 11: cambios con motivo, revisiones y consultas nuevas usan las rutas del contrato", async () => {
  const cambio = { motivo: "El cliente lo pidió", tareas_afectadas: [7] };
  const casos = [
    [() => operacion.editarEvento(1, { cantidad_asistentes: 200, ...cambio }), "put", "/eventos/1"],
    [() => operacion.agregarServicio(1, { id_servicio: 5, ...cambio }), "post", "/eventos/1/servicios"],
    [() => operacion.modificarServicio(4, { cantidad: 2, ...cambio }), "put", "/servicios-evento/4"],
    [() => operacion.cambiarProveedor(4, { id_proveedor: 6, ...cambio }), "put", "/servicios-evento/4/proveedor"],
    [() => operacion.cancelarServicio(4, cambio), "patch", "/servicios-evento/4/cancelar"]
  ];
  for (const [llamar, metodo, url] of casos) {
    await llamar();
    assert.equal(peticiones.at(-1).metodo, metodo);
    assert.equal(peticiones.at(-1).url, url);
    assert.equal(peticiones.at(-1).body.motivo, "El cliente lo pidió");
    assert.deepEqual(peticiones.at(-1).body.tareas_afectadas, [7]);
  }
  await operacion.marcarRevisado(12, "Confirma igual");
  assert.deepEqual(peticiones.at(-1), { metodo: "patch", url: "/revisiones/12", params: undefined, body: { nota_revision: "Confirma igual" } });
  await operacion.revisionesEvento(1, { revisado: "false" });
  assert.deepEqual(peticiones.at(-1).params, { revisado: "false" });
  await operacion.cambiosEvento(1, { tipo: "fecha" });
  assert.equal(peticiones.at(-1).url, "/eventos/1/cambios");
  await operacion.resumenEvento(1);
  assert.equal(peticiones.at(-1).url, "/eventos/1/resumen");
  await operacion.eventosPorEstado({ situacion: "esperando_respuesta" });
  assert.deepEqual(peticiones.at(-1).params, { situacion: "esperando_respuesta" });
  assert.equal(operacion.editarServicioEvento, undefined);
});
