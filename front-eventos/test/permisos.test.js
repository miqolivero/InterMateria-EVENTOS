import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { App as AppAntd } from "antd";

test("las rutas de administración ocultan el formulario a usuarios comunes", async () => {
  // Compila los componentes reales en memoria; no levanta una API ni toca datos.
  const vite = await createServer({ configFile: false, plugins: [react()],
    server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  try {
    const { default: RutaProtegida } = await vite.ssrLoadModule("/src/componentes/RutaProtegida.jsx");
    const { SesionContexto } = await vite.ssrLoadModule("/src/contexto/SesionContexto.js");
    globalThis.localStorage = { getItem: () => "token-de-prueba" };
    const contenido = (sesion) => renderToString(createElement(MemoryRouter, null,
      createElement(SesionContexto.Provider, { value: sesion },
        createElement(RutaProtegida, { soloAdmin: true }, createElement("form", { id: "formulario-admin" })))));
    const base = { cargando: false, errorSesion: "", reintentar() {}, salir() {} };
    const comun = contenido({ ...base, usuario: { nombre: "Ana", rol: "usuario" } });
    assert.match(comun, /Acceso de administrador/);
    assert.doesNotMatch(comun, /id="formulario-admin"/);
    const admin = contenido({ ...base, usuario: { nombre: "Admin", rol: "admin" } });
    assert.match(admin, /id="formulario-admin"/);
    const verificando = contenido({ ...base, cargando: true, usuario: { rol: "admin" } });
    assert.match(verificando, /Verificando tu sesión/);
    assert.doesNotMatch(verificando, /id="formulario-admin"/);
    const fallo = contenido({ ...base, errorSesion: "Servidor no disponible", usuario: { rol: "admin" } });
    assert.match(fallo, /Servidor no disponible/);
    assert.match(fallo, /Reintentar/);
    assert.doesNotMatch(fallo, /id="formulario-admin"/);
  } finally { await vite.close(); }
});

test("el cierre de un evento realizado permite feedback; uno cancelado queda sin acciones", async () => {
  const vite = await createServer({ configFile: false, plugins: [react()],
    server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  try {
    const { default: CierreEvento } = await vite.ssrLoadModule("/src/componentes/CierreEvento.jsx");
    const contenido = (evento) => renderToString(createElement(AppAntd, null,
      createElement(CierreEvento, { evento, actualizado() {} })));
    const realizado = contenido({ id_evento: 2, estado: "realizado", editable: false, fecha_cierre: "2026-10-20", feedback_cliente: "Buena atención" });
    assert.match(realizado, /Evento realizado/);
    assert.match(realizado, /Guardar feedback/);
    assert.doesNotMatch(realizado, /Confirmar cierre/);
    const cancelado = contenido({ id_evento: 3, estado: "cancelado", editable: false, observaciones_cierre: "Pedido del cliente" });
    assert.match(cancelado, /Evento cancelado/);
    assert.match(cancelado, /Pedido del cliente/);
    assert.doesNotMatch(cancelado, /Guardar feedback/);
    assert.doesNotMatch(cancelado, /Cerrar evento/);
  } finally { await vite.close(); }
});
