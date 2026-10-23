import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { App as AppAntd } from "antd";

test("cada rol entra solo a sus rutas y la contraseña temporal va primero", async () => {
  // Compila los componentes reales en memoria; no levanta una API ni toca datos.
  const vite = await createServer({ configFile: false, plugins: [react()],
    server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  try {
    const { default: RutaProtegida } = await vite.ssrLoadModule("/src/componentes/RutaProtegida.jsx");
    const { SesionContexto } = await vite.ssrLoadModule("/src/contexto/SesionContexto.js");
    globalThis.localStorage = { getItem: () => "token-de-prueba" };
    // <Navigate> no dibuja nada: si la guarda redirige, el resultado es ""
    const contenido = (sesion, ruta) => renderToString(createElement(MemoryRouter, { initialEntries: [ruta] },
      createElement(SesionContexto.Provider, { value: sesion },
        createElement(RutaProtegida, null, createElement("main", { id: "pantalla" })))));
    const base = { cargando: false, errorSesion: "", reintentar() {}, salir() {} };
    const como = (rol, extra = {}) => ({ ...base, usuario: { nombre: "Ana", rol, ...extra } });
    assert.match(contenido(como("coordinador"), "/clientes"), /id="pantalla"/);
    assert.equal(contenido(como("empleado"), "/clientes"), "");
    assert.match(contenido(como("empleado"), "/mis-tareas"), /id="pantalla"/);
    assert.equal(contenido(como("coordinador"), "/usuarios"), "");
    assert.match(contenido(como("admin"), "/usuarios"), /id="pantalla"/);
    assert.equal(contenido(como("admin"), "/superadmin/empresas"), "");
    assert.match(contenido(como("superadmin"), "/superadmin/empresas/3"), /id="pantalla"/);
    assert.equal(contenido(como("superadmin"), "/eventos"), "");
    // Una ruta que no existe se deja pasar: la muestra la página 404
    assert.match(contenido(como("empleado"), "/no-existe"), /id="pantalla"/);
    // Contraseña temporal: ninguna pantalla antes de cambiarla
    assert.equal(contenido(como("admin", { debe_cambiar_password: true }), "/seguimiento"), "");
    assert.match(contenido(como("admin", { debe_cambiar_password: true }), "/cambiar-password"), /id="pantalla"/);
    const verificando = contenido({ ...base, cargando: true, usuario: { rol: "admin" } }, "/seguimiento");
    assert.match(verificando, /Verificando tu sesión/);
    assert.doesNotMatch(verificando, /id="pantalla"/);
    const fallo = contenido({ ...base, errorSesion: "Servidor no disponible", usuario: { rol: "admin" } }, "/seguimiento");
    assert.match(fallo, /Servidor no disponible/);
    assert.match(fallo, /Reintentar/);
    assert.doesNotMatch(fallo, /id="pantalla"/);
    // Un perfil guardado o un error anterior no habilitan acceso sin token.
    globalThis.localStorage = { getItem: () => null };
    assert.equal(contenido(como("admin"), "/seguimiento"), "");
    assert.equal(contenido({ ...base, cargando: true, usuario: null }, "/seguimiento"), "");
    globalThis.localStorage = { getItem: () => "token-de-prueba" };
    assert.equal(contenido({ ...base, usuario: null }, "/seguimiento"), "");
  } finally { await vite.close(); }
});

test("el menú sale de una sola definición y cada rol ve solo lo suyo", async () => {
  const vite = await createServer({ configFile: false, plugins: [react()],
    server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  try {
    const { menuDeRol, inicioDeRol, opcionDeRuta } = await vite.ssrLoadModule("/src/utils/menu.jsx");
    const rutas = (rol) => menuDeRol(rol).map((o) => o.key);
    assert.deepEqual(rutas("superadmin"), ["/superadmin", "/superadmin/empresas"]);
    assert.deepEqual(rutas("empleado"), ["/mis-tareas", "/mi-empresa"]);
    assert.ok(rutas("admin").includes("/usuarios") && rutas("admin").includes("/personal"));
    assert.ok(!rutas("coordinador").includes("/usuarios") && !rutas("coordinador").includes("/personal"));
    assert.ok(rutas("coordinador").includes("/mi-empresa"));
    assert.equal(inicioDeRol("empleado"), "/mis-tareas");
    assert.equal(inicioDeRol("superadmin"), "/superadmin");
    assert.equal(opcionDeRuta("/presupuestos/3").ruta, "/solicitudes");
    assert.equal(opcionDeRuta("/superadmin/empresas/2").ruta, "/superadmin/empresas");
    assert.equal(opcionDeRuta("/superadmin").ruta, "/superadmin");
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
