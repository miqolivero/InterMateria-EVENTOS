import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import dayjs from "dayjs";
import api from "../src/servicios/axiosConfig.js";
import * as catalogos from "../src/servicios/catalogosService.js";
import * as operacion from "../src/servicios/operacionService.js";
import { camposPermitidos, fechaAPI, opcionesActivos, nombreCompleto } from "../src/utils/formularios.js";
import { puedeCambiarTarea } from "../src/utils/tareas.js";

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
  await operacion.editarServicioEvento(2, { estado_proveedor: "confirmada" });
  assert.deepEqual(peticiones.at(-1).body, { estado_proveedor: "confirmada" });
  assert.equal(fechaAPI(dayjs("2026-11-01")), "2026-11-01");
  assert.equal(fechaAPI(null), null);
  await operacion.generarTareas(2, { id_empleado_responsable: 3, fechas: [1, 2, 3, 4].map((dia) => fechaAPI(dayjs(`2026-11-0${dia}`))) });
  assert.deepEqual(peticiones.at(-1).body.fechas, ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]);
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

test("secuencia: paso previo completo, reapertura y aislamiento entre servicios", () => {
  const primero = { id_tipo_tarea: 1, id_servicio_x_evento: 10, orden: 1, estado_tarea: "pendiente" };
  const segundo = { id_tipo_tarea: 2, id_servicio_x_evento: 10, orden: 2, estado_tarea: "pendiente" };
  assert.equal(puedeCambiarTarea(segundo, "en_curso", [primero, segundo]), false);
  assert.equal(puedeCambiarTarea(segundo, "completada", [{ ...primero, estado_tarea: "completada" }, segundo]), true);
  const completo = { ...primero, estado_tarea: "completada" };
  assert.equal(puedeCambiarTarea(completo, "pendiente", [completo, { ...segundo, estado_tarea: "en_curso" }]), false);
  assert.equal(puedeCambiarTarea(completo, "en_curso", [completo, { ...segundo, estado_tarea: "en_curso" }]), false);
  assert.equal(puedeCambiarTarea(segundo, "completada", [{ ...primero, id_servicio_x_evento: 99, estado_tarea: "completada" }, segundo]), false);
  assert.equal(puedeCambiarTarea({ id_tipo_tarea: null }, "completada", []), true);
});
