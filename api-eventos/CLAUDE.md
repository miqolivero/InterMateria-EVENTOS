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
- **Niveles de acceso** (Fase 10), con middlewares en `auth.middleware.js`:
  - `soloEmpresa`: va en **todas** las rutas de empresa. Rechaza al
    superadmin (403) y verifica en la base que la empresa siga activa (403
    si está suspendida). Por eso un token viejo deja de servir apenas se
    suspende la empresa.
  - `soloSuperadmin`: va en las rutas `/superadmin/*`.
  - `permitirRoles(...roles)`: aplica la tabla de permisos por ruta de
    `docs/API.md`. Se monta en `index.js` por grupo de rutas y, donde el
    permiso cambia por endpoint, en el router. Reemplaza al `verificarRol` de
    antes.
  - Las restricciones **por registro** del rol `empleado` (solo sus tareas y
    sus servicios) van en el controller, dentro del `WHERE`, no en el
    middleware. Si no le corresponde, 404, igual que con otra empresa.
  - Nunca devolver importes ni costos en una respuesta para el rol `empleado`.
- **Cambios del evento** (Fase 11): todo endpoint que modifica lo acordado
  registra el cambio en `cambios_evento` y sus afectados en `afectados_cambio`
  **en la misma transacción** que la modificación. Si falla el registro, no se
  modifica nada. La `descripcion` de un cambio nunca lleva importes.
- Los indicadores (`servicios_sin_confirmar`, `alerta`, etc.) se calculan con
  **una sola definición** reutilizada (una función o vista SQL) en el resumen,
  el tablero y los listados. Están definidos en la Fase 11 de `docs/API.md`.
  - Se montan **a nivel router** en `index.js`
    (`app.use("/api/clientes", verificarToken, soloEmpresa, clientesRoutes)`),
    no endpoint por endpoint. Así ninguna ruta nueva queda sin protección por
    olvido.
  - El superadmin no tiene `id_empresa`: **nunca** usar su token en una
    consulta de datos operativos.
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
