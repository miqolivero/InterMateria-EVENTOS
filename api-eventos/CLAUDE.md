# CLAUDE.md · Backend (api-eventos)

Complementa el `CLAUDE.md` de la raíz. Las sesiones que se abren en esta carpeta
son **solo de backend**: no se modifica nada en `front-eventos/`.

## Stack

Node 18+, Express 4, ES Modules (`"type": "module"`), `pg`, `dotenv`, `cors`,
`bcryptjs` y `jsonwebtoken`. El SQL se escribe a mano, **sin ORM**.

## Convenciones (tomar `empresas` como modelo)

- **Estructura por recurso**: `src/routes/<recurso>.routes.js` y
  `src/controllers/<recurso>.controller.js`. Las rutas se montan en
  `src/index.js` bajo `/api/<recurso>`, **antes** del handler 404.
- **Nombres en español**: archivos, funciones, variables, rutas y mensajes
  (`obtenerClientes`, `crearSolicitud`). Los comentarios también en español y
  explicando el *por qué*.
- **SQL siempre parametrizado** (`$1, $2...`). Nunca se concatenan valores del
  request en el SQL.
- **Errores** con el formato `{ mensaje: "..." }`.
- **Códigos HTTP**:
  - `200` OK, `201` creado (devuelve el registro con `RETURNING *`), `204` borrado.
  - `400` faltan datos o son inválidos. También duplicados (error `23505`),
    igual que en empresas.
  - `401` sin token o con token inválido. `403` el rol no alcanza.
  - `404` no existe **o pertenece a otra empresa**. No se revela que existe.
  - `409` no se puede borrar porque tiene registros asociados (error `23503`),
    o la acción no es válida para el estado actual.
  - `500` error inesperado, con un mensaje genérico.
- **Multitenant**: toda consulta filtra por `req.usuario.id_empresa`, que sale
  del token y **nunca del body o de la URL**. Si llega un id de otra tabla (por
  ejemplo `id_cliente` en una solicitud), verificar que sea de la misma empresa.
- **Operaciones de varios pasos** van en una transacción:
  `const client = await pool.connect()`, después `BEGIN` / `COMMIT` /
  `ROLLBACK`, y `client.release()` en el `finally`.
- **Baja lógica** (`activo = false`) para clientes, servicios, proveedores,
  tipos de evento, empleados y usuarios.
- Los campos calculados (`vencida`, `margen`, porcentajes) se calculan **en el
  SQL** siempre que se pueda.
- No modificar `database/schema.sql` sin avisar. Si una fase necesita un cambio
  en el modelo, proponerlo y explicar por qué: también hay que actualizar el DER.

## Contrato (docs/API.md)

`docs/API.md` ya tiene el contrato completo de todas las fases, y el frontend
construye las pantallas a partir de él. Por eso:

- Se implementa **exactamente** lo que dice: mismas rutas, mismos nombres de
  campos (incluidos los calculados y los de JOINs), mismos códigos y mismos
  mensajes de error.
- Las reglas de "Convenciones generales" del contrato valen para todos los
  endpoints: fechas como string `YYYY-MM-DD`, montos como número y listados
  como array.
- Para fechas y montos, en `src/data/db.js` configurar
  `pg.types.setTypeParser(1082, v => v)` y `pg.types.setTypeParser(1700, parseFloat)`.
- Si al implementar algo no cierra o falta, **frenar y preguntar**. Si se
  cambia, se actualiza `docs/API.md`, se anota en su "Historial de cambios" y
  se avisa al frontend.

## Verificación al terminar cada fase

- `schema.sql` y `seed.sql` corren de cero en una base vacía (cuando la fase los toca).
- La API arranca sin errores.
- Cada endpoint nuevo se prueba con `curl` usando el token de un usuario del
  seed: un caso exitoso, uno de validación (400), uno de otra empresa (404) y,
  si aplica, uno de estado inválido (409).
- Las respuestas coinciden **exactamente** con `docs/API.md`.
- El README de `api-eventos` está actualizado.
