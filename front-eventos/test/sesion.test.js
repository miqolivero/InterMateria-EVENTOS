import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import api from "../src/servicios/axiosConfig.js";
import { usuarioGuardado, cerrarSesion } from "../src/servicios/authService.js";
import { mensajeError } from "../src/utils/errores.js";
import { formatearFecha, formatearMoneda } from "../src/utils/formato.js";
import { estados } from "../src/utils/estados.js";

beforeEach(() => {
  const valores = new Map();
  globalThis.localStorage = {
    getItem: (key) => valores.get(key) ?? null,
    setItem: (key, valor) => valores.set(key, String(valor)),
    removeItem: (key) => valores.delete(key)
  };
  globalThis.window = new EventTarget();
  api.defaults.adapter = async (config) => ({ status: 200, data: {}, headers: {}, config });
});

test("un usuario guardado corrupto no rompe la aplicación", () => {
  for (const valor of ["{invalido", "null", "123", '"texto"', "[]"]) {
    localStorage.setItem("usuario", valor);
    assert.equal(usuarioGuardado(), null);
  }
  localStorage.setItem("usuario", JSON.stringify({ nombre: "Ana", rol: "usuario" }));
  assert.equal(usuarioGuardado().nombre, "Ana");
});

test("el interceptor envía el token y cerrar sesión lo elimina", async () => {
  localStorage.setItem("token", "token-prueba");
  localStorage.setItem("usuario", "{}");
  const respuesta = await api.get("/auth/perfil");
  assert.equal(respuesta.config.headers.Authorization, "Bearer token-prueba");
  cerrarSesion();
  assert.equal(localStorage.getItem("token"), null);
  assert.equal(localStorage.getItem("usuario"), null);
  assert.equal((await api.get("/empresas")).config.headers.Authorization, undefined);
});

function responderError(status) {
  api.defaults.adapter = async (config) => {
    const error = new Error("Respuesta de prueba");
    error.config = config;
    error.response = { status, data: { mensaje: "Mensaje del servidor" } };
    throw error;
  };
}

test("401 de login permanece en el formulario; 401 protegido expira la sesión", async () => {
  let expiraciones = 0;
  window.addEventListener("sesion-expirada", () => { expiraciones += 1; });
  localStorage.setItem("token", "token-prueba");
  responderError(401);
  await assert.rejects(api.post("/auth/login", {}));
  assert.equal(expiraciones, 0);
  assert.equal(localStorage.getItem("token"), "token-prueba");
  await assert.rejects(api.get("/auth/perfil"));
  assert.equal(expiraciones, 1);
  assert.equal(localStorage.getItem("token"), null);
});

test("403 y 409 conservan la sesión y muestran el mensaje del backend", async () => {
  for (const status of [403, 409]) {
    localStorage.setItem("token", "token-prueba");
    responderError(status);
    try { await api.put("/empresas/1", {}); assert.fail("Debía fallar"); }
    catch (error) { assert.equal(mensajeError(error), "Mensaje del servidor"); }
    assert.equal(localStorage.getItem("token"), "token-prueba");
  }
  assert.match(mensajeError(new Error("Sin red")), /conectar con el servidor/);
});

test("un 401 tardío de una cuenta anterior no cierra una sesión nueva", async () => {
  localStorage.setItem("token", "anterior");
  api.defaults.adapter = async (config) => {
    localStorage.setItem("token", "nueva");
    const error = new Error("Token anterior vencido");
    error.config = config; error.response = { status: 401 };
    throw error;
  };
  let expirada = false;
  window.addEventListener("sesion-expirada", () => { expirada = true; });
  await assert.rejects(api.get("/auth/perfil"));
  assert.equal(localStorage.getItem("token"), "nueva");
  assert.equal(expirada, false);
});

test("fechas, moneda argentina y estados independientes", () => {
  assert.equal(formatearFecha("2026-10-20"), "20/10/2026");
  assert.equal(formatearFecha(null), "—");
  assert.equal(formatearFecha("invalida"), "—");
  assert.match(formatearMoneda(1250.5), /1\.250,50/);
  assert.match(formatearMoneda(0), /0,00/);
  assert.equal(formatearMoneda(null), "—");
  assert.equal(estados.completada.texto, "Completada");
  assert.equal(estados.confirmada.texto, "Confirmada");
});
