import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import jwt from "jsonwebtoken";

test("clientes: validaciones, empresa, edición y persistencia tras reiniciar", { timeout: 30000 }, async () => {
  const schema = `test_clientes_${randomUUID().replaceAll("-", "")}`;
  const db = new pg.Client({ host: process.env.DB_HOST, port: process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  let servidor;
  let base;
  const secreto = randomUUID();
  const token = jwt.sign({ id: 1, rol: "usuario" }, secreto, { expiresIn: "5m" });
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  async function iniciar() {
    servidor = spawn(process.execPath, ["index.js"], {
      env: { ...process.env, PORT: "0", JWT_SECRET: secreto, PGOPTIONS: `-c search_path=${schema}` },
      stdio: ["ignore", "pipe", "pipe"]
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("La API no arrancó")), 5000);
      servidor.once("error", (error) => { clearTimeout(timer); reject(error); });
      servidor.once("exit", () => { clearTimeout(timer); reject(new Error("La API terminó antes de arrancar")); });
      servidor.stdout.on("data", (chunk) => {
        const match = chunk.toString().match(/http:\/\/localhost:(\d+)/);
        if (match) { base = `http://localhost:${match[1]}/api/clientes`; clearTimeout(timer); resolve(); }
      });
    });
  }
  async function detener() {
    if (servidor && servidor.exitCode === null) {
      const salida = once(servidor, "exit"); servidor.kill(); await salida;
    }
    servidor = undefined;
  }
  async function pedir(path = "", method = "GET", body) {
    const respuesta = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: respuesta.status, data: await respuesta.json() };
  }

  await db.connect();
  try {
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(`SET search_path TO ${schema}`);
    await db.query(await readFile(new URL("../database/empresas.sql", import.meta.url), "utf8"));
    const sql = await readFile(new URL("../database/clientes.sql", import.meta.url), "utf8");
    await db.query(sql);
    await db.query(sql); // El instalador se puede ejecutar más de una vez.
    await iniciar();
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await pedir()).data.length, 0);
    const cliente = { id_empresa: 1, nombre: " Ana ", apellido: " Pérez ", dni_cuit: "12345678", email: "ana@example.com" };
    assert.equal((await pedir("", "POST", { ...cliente, nombre: " " })).status, 400);
    assert.equal((await pedir("", "POST", { ...cliente, nombre: {} })).status, 400);
    assert.equal((await pedir("", "POST", { ...cliente, email: "invalido" })).status, 400);
    assert.equal((await pedir("", "POST", { ...cliente, id_empresa: 999999 })).status, 400);
    const creado = await pedir("", "POST", cliente);
    assert.equal(creado.status, 201);
    assert.equal(creado.data.nombre, "Ana");
    assert.equal((await pedir("?id_empresa=1")).data.length, 1);
    assert.equal((await pedir("?id_empresa=2")).data.length, 0);
    assert.equal((await pedir("?id_empresa=abc")).status, 400);
    assert.equal((await pedir("/abc")).status, 400);
    assert.equal((await pedir("/999999")).status, 404);
    const editado = await pedir(`/${creado.data.id}`, "PUT", { ...cliente, telefono: "3511234567" });
    assert.equal(editado.status, 200);
    await detener(); await iniciar();
    const recuperado = await pedir(`/${creado.data.id}`);
    assert.equal(recuperado.data.telefono, "3511234567");
    assert.equal(recuperado.data.apellido, "Pérez");
  } finally {
    await detener();
    await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await db.end();
  }
});
