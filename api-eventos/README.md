# API de Eventos

API REST del sistema de gestión de eventos sobre PostgreSQL, con autenticación
por JWT y permisos por rol. El sistema es **multitenant**: varias empresas
organizadoras usan la misma base y cada una ve solo sus propios datos. Cada
usuario pertenece a una empresa, y ese `id_empresa` viaja en el token.

## Requisitos

- Node.js 22.12 o superior para ejecutar también el frontend (la API admite Node 18+)
- PostgreSQL

## Instalación

Seguir la [guía de instalación completa](../docs/INSTALACION.md) para una copia
nueva: configuración de .env, base de datos, arranque y solución de problemas.
Ejecutar los comandos de este README desde `api-eventos`.

```bash
npm ci
```

## Base de datos

Si ya existe una instalación antigua con empresas y clientes, ejecutar desde
`api-eventos`: `npm run db:actualizar`. Genera primero un respaldo completo en
`laboratorio-bd/respaldos/` y después agrega las tablas faltantes en una
transacción, conservando los datos. Requiere `pg_dump` en el PATH o la variable
`PG_DUMP` con su ruta (detecta PostgreSQL 18 en Windows). No carga cuentas de demo.
La carpeta `laboratorio-bd/` es local y debe permanecer excluida de Git.

Los scripts siguientes son únicamente para crear una base de desarrollo desde cero.

Son dos scripts, y el orden importa:

```bash
psql -U postgres -c "CREATE DATABASE eventos;"
psql -U postgres -d eventos -v ON_ERROR_STOP=1 --single-transaction -f database/schema.sql
psql -U postgres -d eventos -v ON_ERROR_STOP=1 --single-transaction -f database/seed.sql
```

- **`schema.sql`** crea las 16 tablas del modelo, con sus claves foráneas, los
  `UNIQUE`, los `CHECK` de cada estado y los índices. **Arranca borrando todas
  las tablas del sistema**, así que se puede volver a correr las veces que haga
  falta, pero nunca sobre datos que no se quieran perder.
- **`seed.sql`** carga los datos de prueba y de demo: las 4 empresas (una suspendida), los 4 tipos
  de tarea, los usuarios y un circuito completo en las empresas 1 y 2 (ver
  abajo). La empresa 3 queda vacía, para mostrar el sistema "de cero".

Las fechas del seed son relativas a `CURRENT_DATE`, así siempre hay eventos
próximos y tareas vencidas sin tener que editar el script cada semana.

### Datos de demo

Todos respetan las reglas de negocio, como si se hubieran cargado desde la API:
los totales coinciden con el detalle, cada evento sale de un presupuesto
aceptado y los proveedores de cada renglón ofrecen ese servicio.

| Evento | Empresa | Estado | Cuándo | Para mostrar |
| --- | --- | --- | --- | --- |
| 1 · Juan Pérez | 1 | en preparación | en 25 días | **Fase 11:** cambio de fecha con servicios a revisar (uno revisado y otros no), decoración con el proveedor rechazado y reemplazado, fotografía cancelada con sus tareas a revisar; un servicio sin tareas para "Pasos" |
| 2 · Grupo Andes SA | 1 | confirmado | en 10 días | tarea vencida, un servicio sin confirmar |
| 3 · Colegio San José | 1 | realizado | hace 15 días | feedback cargado; la versión 1 del presupuesto fue rechazada |
| 4 · Martina Ruiz | 1 | cancelado | — | motivo de la cancelación; no aparece en el tablero |
| 5 · Paula Sánchez | 2 | en preparación | en 6 días | tarea vencida, un servicio sin proveedor |
| 6 · Hernán Díaz | 2 | confirmado | en 20 días | sin coordinador |

Solicitudes en todos los estados: la **4** está `presupuestada`, con un
presupuesto **presentado** listo para aceptar en vivo; la **1** y la **3** están
`pendiente` (sin presupuesto); la **8** fue `rechazada`; la **7** se canceló
junto con su evento; la **11** se canceló antes de presupuestar. En "Eventos por
estado" se ven la 4 (esperando respuesta), la 8 (rechazada) y la 11 (cancelada).

**Para recrear la base de cero** en cualquier momento alcanza con volver a correr
los dos scripts, sin el `CREATE DATABASE`.

En Windows, si `psql` no está en el PATH, usar la ruta completa:
`"C:\Program Files\PostgreSQL\18\bin\psql.exe"`.

## Variables de entorno

Copiar `.env.example` a `.env` y completar:

```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=su_contraseña
DB_NAME=eventos
FRONT_URL=http://localhost:5173
JWT_SECRET=una_clave_larga_y_dificil_de_adivinar
JWT_EXPIRES_IN=1h
```

`FRONT_URL` es el único origen que acepta el CORS. `JWT_SECRET` es la clave con
la que se firman los tokens: si cambia, los tokens emitidos antes dejan de valer.

## Ejecutar

```bash
npm run dev     # con --watch
npm start
```

Servidor en `http://localhost:3000`.

## Endpoints

### Permisos (Fase 10)

Cuatro roles: `superadmin` (los dueños del sistema, sin empresa), y en cada
empresa `admin`, `coordinador` y `empleado`. La tabla completa de permisos por
ruta está en `docs/API.md` y se aplica en `src/index.js`, por grupo de rutas:

| Middleware | Qué hace |
| --- | --- |
| `verificarToken` | Firma y vencimiento del token → 401 |
| `soloEmpresa` | Rechaza al superadmin (403), corta a los usuarios de una empresa suspendida (403 con `codigo: "empresa_suspendida"`) y lee de la base el rol, la empresa y el empleado actuales |
| `soloSuperadmin` | Solo el superadmin entra a `/superadmin/*` |
| `permitirRoles(...)` | Aplica la tabla de permisos → 403 `"No tenes permiso para esta accion"` |

El rol `empleado` además queda limitado a **sus** tareas y a los servicios
donde tiene tareas, con el filtro en el `WHERE` del controller (si no le
corresponde, 404). Nunca recibe importes ni costos.

### Autenticación · `/api/auth`

| Método | Ruta | Acción | Respuesta |
| --- | --- | --- | --- |
| POST | `/login` | Obtener el token | 200 / 401 / 403 (empresa suspendida) |
| GET | `/perfil` | Datos del usuario del token | 200 / 401 / 403 / 404 |
| PUT | `/password` | Cambiar la propia contraseña | 200 / 400 |

No hay registro público: las cuentas las crean el superadmin y el admin de cada
empresa. `POST /login` devuelve `{ token, usuario }`, con
`debe_cambiar_password` en `true` si la contraseña la puso otra persona.

El payload del token es `{ id, email, rol, id_empresa }`, pero los middlewares
vuelven a leer el usuario de la base en cada pedido: un cambio de rol o una
suspensión corren desde el pedido siguiente. El `id_empresa` con el que se
filtra sale de ahí, **nunca del body ni de la URL**.

### Panel de superadmin · `/api/superadmin`

| Método | Ruta | Acción |
| --- | --- | --- |
| GET | `/resumen` | Métricas de todo el sistema |
| GET | `/empresas?activo=&buscar=` | Empresas con sus métricas |
| GET | `/empresas/:id` | Una empresa, sus métricas y sus usuarios |
| POST | `/empresas` | Empresa y su admin, en una transacción |
| PUT | `/empresas/:id` | Editar (incluido el cuit) |
| PATCH | `/empresas/:id/activo` | Suspender o reactivar |
| DELETE | `/empresas/:id` | Solo sin datos (si no, 409) |
| POST | `/empresas/:id/usuarios` | Soporte: crear un admin o coordinador |
| PATCH | `/empresas/:id/usuarios/:idUsuario` | Soporte: rol y/o activo |
| PUT | `/empresas/:id/usuarios/:idUsuario/password` | Soporte: resetear la contraseña |

Solo cantidades: ninguna consulta devuelve clientes, eventos ni tareas.

### Mi empresa y usuarios · `/api/mi-empresa`, `/api/usuarios`

- `GET /mi-empresa` (los tres roles de empresa) y `PUT /mi-empresa` (admin; el
  cuit se ignora).
- `/usuarios` (solo admin): listar con `?activo=&rol=&buscar=`, obtener, crear,
  editar, `PATCH /:id/activo` y `PUT /:id/password` (reset).
- Reglas (en `src/utils/usuarios.js`, compartidas con el superadmin y con
  Personal): siempre queda un admin activo, un admin no se desactiva ni se
  quita el rol a sí mismo, un usuario `empleado` siempre tiene empleado, y un
  empleado tiene a lo sumo un usuario.
- Personal con acceso: `POST /empleados` acepta el bloque `acceso` (empleado,
  vínculo y usuario en una transacción), `POST /empleados/:id/acceso` da acceso
  a uno que ya existe, y dar de baja a un empleado desactiva su usuario.

### Catálogos · clientes, tipos de evento, servicios, proveedores y empleados

Los cinco recursos siguen **el mismo patrón**, y todos piden token:

| Método | Ruta | Acción | Respuesta |
| --- | --- | --- | --- |
| GET | `/<recurso>?activo=true\|false&buscar=texto` | Listar | 200 · array |
| GET | `/<recurso>/:id` | Obtener uno | 200 / 404 |
| POST | `/<recurso>` | Crear | 201 / 400 |
| PUT | `/<recurso>/:id` | Editar (objeto completo) | 200 / 400 / 404 |
| PATCH | `/<recurso>/:id/activo` | Activar o desactivar | 200 / 400 / 404 |

| Recurso | Ruta | Obligatorios | `?buscar` busca en |
| --- | --- | --- | --- |
| Clientes | `/api/clientes` | `nombre`, `apellido` | nombre, apellido, dni_cuit, email |
| Tipos de evento | `/api/tipos-eventos` | `nombre` | nombre |
| Servicios | `/api/servicios` | `nombre` | nombre, descripción |
| Proveedores | `/api/proveedores` | `razon_social` | razón social, cuit, email |
| Empleados | `/api/empleados` | `legajo`, `nombre`, `apellido` | nombre, apellido, legajo |

**No hay `DELETE`**: la baja es lógica, porque los presupuestos y los eventos ya
cerrados siguen apuntando a estos registros. Sin `?activo` el listado devuelve
todos; con `?activo=false` solo los dados de baja.

Dos recursos tienen particularidades:

- **Proveedores** devuelven además `servicios: [{ id_servicio, nombre }]`, que es
  de solo lectura en el POST y el PUT. Se modifica con
  `GET`/`PUT /api/proveedores/:id/servicios` (el PUT recibe
  `{ ids_servicios: [1, 4] }` y reemplaza la lista completa en una transacción).
  El filtro `?id_servicio=3` devuelve solo los proveedores que ofrecen ese
  servicio: lo usa el `Select` de proveedor del presupuesto.
- **Empleados** se listan por su vínculo con la empresa
  (`empleados_x_empresa`), así que el objeto mezcla campos de las dos tablas:
  `legajo`, `nombre`, `apellido`, `rol`, `email` y `telefono` son del empleado, y
  `cargo`, `fecha_inicio`, `fecha_fin` y `activo` son del vínculo. El `PATCH
  /:id/activo` con `false` cierra `fecha_fin` en la fecha de hoy; con `true` la
  vuelve a dejar en `null`. El `legajo` es único **en todo el sistema**, no por
  empresa.

### Solicitudes · `/api/solicitudes`

El pedido inicial del cliente, antes de cualquier presupuesto. Todas las rutas
piden token.

| Método | Ruta | Acción | Respuesta |
| --- | --- | --- | --- |
| GET | `/?estado=&id_cliente=&desde=&hasta=&buscar=` | Listar | 200 · array |
| GET | `/:id` | Obtener una, con `cliente` y `presupuestos` | 200 / 404 |
| POST | `/` | Crear | 201 / 400 |
| PUT | `/:id` | Editar | 200 / 400 / 404 / 409 |
| PATCH | `/:id/estado` | Cancelar o rechazar: `{ "estado": "cancelada" }` | 200 / 400 / 404 / 409 |

- Cada solicitud trae `nombre_cliente`, `nombre_tipo_evento` e `id_evento`
  (`null` mientras no haya evento). El listado se ordena por
  `fecha_evento_prevista`. `desde` y `hasta` filtran sobre esa fecha y `buscar`
  busca sobre el nombre completo del cliente.
- Obligatorios: `id_cliente`, `id_tipo_evento`, `fecha_evento_prevista` y
  `cantidad_asistentes`. El cliente y el tipo de evento tienen que ser **de la
  empresa del token y estar activos**, la cantidad tiene que ser un entero mayor
  a 0 y la fecha no puede ser anterior a hoy (se compara con `CURRENT_DATE` en
  la base).
- Nace con `fecha_solicitud` = hoy y `estado` = `pendiente`. El estado nunca se
  edita por el PUT.
- Solo se edita, cancela o rechaza mientras está `pendiente` o `presupuestada`;
  si no, responde **409**. Pasar a `presupuestada` o `aceptada` lo hacen los
  presupuestos (fases 4 y 5).
- No hay `DELETE`: una solicitud que no sigue se cancela o se rechaza.

### Presupuestos · `/api/presupuestos`

Las versiones de la propuesta al cliente. Todas las rutas piden token y todas
devuelven el **Presupuesto completo** (cabecera, totales, solicitud, detalle y
versiones), así el front siempre recibe los totales recalculados.

| Método | Ruta | Acción | Respuesta |
| --- | --- | --- | --- |
| POST | `/api/solicitudes/:id/presupuestos` | Crear la versión 1 en borrador | 201 / 400 / 404 / 409 |
| GET | `/:id` | Obtener uno | 200 / 404 |
| PUT | `/:id` | Editar la cabecera (`validez_dias`, `observaciones`) | 200 / 400 / 404 / 409 |
| POST | `/:id/detalle` | Agregar un renglón | 201 / 400 / 404 / 409 |
| PUT | `/:id/detalle/:idDetalle` | Editar un renglón | 200 / 400 / 404 / 409 |
| DELETE | `/:id/detalle/:idDetalle` | Borrar un renglón (200, no 204) | 200 / 404 / 409 |
| PATCH | `/:id/presentar` | De borrador a presentado | 200 / 400 / 404 / 409 |
| POST | `/:id/nueva-version` | Copiar a una versión nueva en borrador | 201 / 404 / 409 |
| PATCH | `/:id/rechazar` | De presentado a rechazado | 200 / 404 / 409 |

- **El total lo calcula la API** (regla 2): `importe_total` es siempre la suma
  de `importe_cliente` del detalle y se recalcula en la misma transacción que
  modifica un renglón. Si llega en el body, se ignora. `total_costo`,
  `total_margen` y el `margen` de cada renglón se calculan en el SQL.
- **Solo se edita en `borrador`** (regla 3). Presentar pasa la solicitud a
  `presupuestada` y la `fecha_emision` a hoy. Para cambiar un presupuesto
  presentado o rechazado se crea una **nueva versión**: copia la cabecera y el
  detalle, toma `numero_version` + 1 y, si la anterior estaba presentada, la
  pasa a `reemplazado`. Solo se puede hacer desde la última versión y si no hay
  otra en borrador.
- **Renglones:** el servicio tiene que ser de la empresa y estar activo. El
  proveedor es opcional, pero si viene tiene que ser de la empresa, estar activo
  y **ofrecer ese servicio** (`proveedores_x_servicio`).
- Una solicitud cancelada o rechazada no admite presupuestos nuevos, ni
  presentar, ni nuevas versiones (409).
- **Multitenant:** la tabla `presupuestos` no tiene `id_empresa`; todas las
  consultas entran por la solicitud (`JOIN solicitudes ... AND s.id_empresa`).
- Los pasos que tocan más de una fila (crear, renglones, presentar, nueva
  versión) van en una transacción con la fila bloqueada (`SELECT ... FOR
  UPDATE`), para que dos pedidos simultáneos no dejen datos inconsistentes.

### Eventos · `/api/eventos`

Un evento **no se crea directamente**: nace al aceptar un presupuesto. Todas las
rutas piden token.

| Método | Ruta | Acción | Respuesta |
| --- | --- | --- | --- |
| POST | `/api/presupuestos/:id/aceptar` | Aceptar el presupuesto y crear el evento | 201 / 400 / 404 / 409 |
| GET | `/?estado=&desde=&hasta=&id_coordinador=&buscar=` | Listar | 200 · array |
| GET | `/:id` | Detalle (coordinador, cliente, solicitud y presupuesto aceptado) | 200 / 404 |
| PUT | `/:id` | Editar fecha, sede, condiciones y coordinador | 200 / 400 / 404 / 409 |
| PATCH | `/:id/iniciar-preparacion` | De confirmado a en preparación | 200 / 404 / 409 |
| GET | `/:id/servicios` | Lo acordado con cada proveedor | 200 / 404 |
| PATCH | `/:id/cerrar` | Cerrar como `realizado` o `cancelado` | 200 / 400 / 404 / 409 |
| PATCH | `/:id/feedback` | Feedback y observaciones de un evento realizado | 200 / 400 / 404 / 409 |
| POST | `/:id/servicios` | Agregar un servicio después de confirmar (con motivo) | 201 / 400 / 404 / 409 |
| GET | `/:id/cambios?tipo=` | Historial de cambios del evento | 200 / 404 |
| GET | `/:id/revisiones?revisado=false` | Compromisos afectados y su revisión (también el empleado) | 200 / 404 |
| GET | `/:id/resumen` | Todo el evento con sus indicadores (también el empleado, sin importes) | 200 / 404 |

- **Aceptar aplica la regla 4 en una sola transacción:** el presupuesto pasa a
  `aceptado`, las otras versiones abiertas a `reemplazado`, la solicitud a
  `aceptada`, se crea el evento en `confirmado` y cada renglón del detalle se
  copia a `servicios_x_evento` con el proveedor `pendiente`. La cantidad de
  asistentes se copia de la solicitud al evento. Si cualquier paso falla,
  el `ROLLBACK` deshace todo (se probó forzando un error con un trigger).
- **Una solicitud, un evento:** además del chequeo en el código, el `UNIQUE
  (id_solicitud)` de `eventos` lo garantiza en la base.
- El **coordinador** es opcional, pero si viene tiene que trabajar hoy en la
  empresa: vínculo activo en `empleados_x_empresa` y empleado activo (regla 9).
- Con el evento `realizado` o `cancelado` no se edita (409). `editable` lo
  indica al front.
- **Cierre (regla 8).** Solo desde `confirmado` o `en_preparacion`, y guarda
  `fecha_cierre` = hoy. Cancelar exige el motivo (`observaciones_cierre`) y pasa
  la solicitud a `cancelada` en la misma transacción. No se exige que las
  tareas estén completas: el front avisa y decide el usuario.
- **Feedback.** Es la única edición posible con el evento cerrado, y solo si el
  evento está `realizado`. Es parcial: se actualiza solo lo que viene con texto.
- En los servicios del evento, `tipos_generados` (los pasos que ya tienen tarea),
  `a_revisar` y `pendientes_revision` se calculan en el SQL.
- Las secuencias de PostgreSQL no vuelven atrás con un `ROLLBACK`: si una
  aceptación falla, ese id de evento queda sin usar. Es normal que haya huecos
  en los ids.

### Servicios del evento y tareas · `/api/servicios-evento`, `/api/tareas`

| Método | Ruta | Acción | Respuesta |
| --- | --- | --- | --- |
| PATCH | `/api/servicios-evento/:id/estado` | Seguimiento del proveedor (sin motivo; también el empleado) | 200 / 400 / 403 / 404 / 409 |
| PUT | `/api/servicios-evento/:id` | Modificar lo acordado (parcial, con motivo) | 200 / 400 / 404 / 409 |
| PUT | `/api/servicios-evento/:id/proveedor` | Asignar o reemplazar el proveedor (con motivo) | 200 / 400 / 404 / 409 |
| PATCH | `/api/servicios-evento/:id/cancelar` | Cancelar el servicio sin borrarlo (con motivo) | 200 / 400 / 404 / 409 |
| POST | `/api/servicios-evento/:id/generar-tareas` | Crear los pasos elegidos | 201 / 400 / 404 / 409 |
| PATCH | `/api/revisiones/:id` | Marcar un compromiso como revisado, con nota | 200 / 400 / 404 / 409 |
| GET | `/api/eventos/:id/tareas?estado_tarea=&vencidas=true` | Tareas del evento | 200 / 404 |
| POST | `/api/eventos/:id/tareas` | Crear una tarea libre | 201 / 400 / 404 / 409 |
| PUT | `/api/tareas/:id` | Editar descripción, responsable, fecha y observaciones | 200 / 400 / 404 / 409 |
| PATCH | `/api/tareas/:id/estado` | Cambiar el estado (cualquier orden) | 200 / 400 / 404 / 409 |
| DELETE | `/api/tareas/:id` | Borrar una tarea libre | 204 / 404 / 409 |
| GET | `/api/tareas/mias?estado_tarea=` | Tareas del empleado del usuario logueado | 200 |

- **Tarea ≠ proveedor (regla 6).** El estado del proveedor solo cambia con
  `/estado`; completar "Confirmar asistencia" no lo toca. Los 4 estados son
  `pendiente`, `confirmado`, `completado` y `rechazado`. Al pasar a
  `confirmado` se guarda la fecha de confirmación; sin proveedor no se puede
  confirmar ni completar (409).
- **Sin secuencia (Fase 11).** Los pasos de `tipos_tarea` son una guía: se
  eligen los que hacen falta y se completan en cualquier orden. Un índice único
  evita dos tareas del mismo paso en un servicio.
- **Fecha de finalización (regla 7).** Se guarda al completar y se limpia si la
  tarea vuelve a otro estado.
- **"Vencida" no se guarda (regla 1).** Se calcula en el SQL:
  `fecha_prevista < CURRENT_DATE` y no completada.
- **Generar tareas** crea los pasos elegidos (cada uno con su fecha) en un solo
  `INSERT ... SELECT` con `unnest`, dentro de una transacción. Se puede volver
  a llamar para sumar los que falten. La descripción se arma sola
  (`"<tipo> · <servicio> (<proveedor>)"`).
- El **responsable** tiene que ser un empleado activo de la empresa (regla 9).
  Las tareas de un paso no se borran; las libres sí, salvo que tengan revisiones.
- Con el evento cerrado, todo cambio en sus servicios o tareas responde 409.
- **Cambios de lo acordado (Fase 11).** Fecha, sede, condiciones, asistentes y
  los cambios de un servicio piden `motivo` y quedan en `cambios_evento` (quién,
  cuándo, antes y después). Los compromisos afectados quedan en
  `afectados_cambio`: con la fecha o la sede, todos los servicios acordados;
  con un servicio, ese; las tareas, solo las de `tareas_afectadas`. **El cambio
  y su registro van en la misma transacción**: si falla el registro, el cambio
  tampoco queda (se probó con un trigger que hace fallar el INSERT). Nada se
  reprograma ni se confirma solo.
- **"A revisar" se calcula** (una fila sin revisar en `afectados_cambio`), igual
  que "vencida". Revisar guarda quién, cuándo y una nota obligatoria; no cambia
  nada más.
- **Un servicio cancelado no se borra:** sigue en el evento y en el historial,
  no cuenta en los indicadores y no admite más cambios (409). Sus tareas no se
  tocan.
- **Mis tareas** busca el `id_empleado` del usuario en la tabla `usuarios`. Si
  no tiene empleado vinculado, devuelve `[]`. Solo muestra eventos abiertos,
  primero las vencidas.

### Seguimiento · `/api/seguimiento`

El tablero de inicio: qué falta resolver con varios eventos en paralelo. Solo
lectura, siempre sobre los eventos **abiertos** de la empresa.

| Método | Ruta | Devuelve |
| --- | --- | --- |
| GET | `/resumen?dias=30` | Cantidades: eventos próximos, tareas vencidas y pendientes, servicios sin confirmar, solicitudes pendientes, compromisos a revisar |
| GET | `/proximos-eventos?dias=30` | Por evento: días restantes, tareas X de Y, servicios confirmados X de Y, vencidas, sin confirmar, a revisar y `alerta` |
| GET | `/tareas-vencidas` | Las tareas vencidas con los datos del evento y `dias_vencida` |
| GET | `/servicios-sin-confirmar` | Servicios acordados con el proveedor `pendiente` o `rechazado`, o sin proveedor, del evento más cercano al más lejano |
| GET | `/por-estado?situacion=&desde=&hasta=` | Solicitudes que esperan respuesta y eventos, cada uno con su situación, y el conteo por situación |

- Todo se calcula **en SQL** con `COUNT(*) FILTER (WHERE ...)` y subconsultas,
  sin recorrer filas en JavaScript. En los próximos eventos, tareas y servicios
  se cuentan en dos `LATERAL` separados: juntarlos en un mismo `GROUP BY`
  multiplicaría las filas y los conteos saldrían inflados.
- `?dias` (1 a 365, por defecto 30) solo cambia la ventana de los "próximos".
  Las vencidas y los servicios sin confirmar son de todos los eventos abiertos.
- "Vencida" usa la misma condición que las tareas (`CONDICION_VENCIDA`, regla 1).
- **Indicadores (Fase 11):** una sola definición en `src/utils/indicadores.js`
  (`JOIN_INDICADORES`), la misma para el tablero y el resumen del evento.
  `alerta` = hay servicios sin confirmar o compromisos a revisar; terminar las
  tareas no la apaga.

El contrato completo, con el JSON de cada respuesta y los mensajes de error
exactos, está en `docs/API.md`.

### Códigos de error

| Código | Cuándo |
| --- | --- |
| 400 | Faltan datos o son inválidos, un id de otra empresa en el body, duplicados, JSON roto |
| 401 | No hay token, la firma no coincide o venció |
| 403 | El token es válido pero el rol no alcanza |
| 404 | El `:id` no existe, es de otra empresa o no es un entero válido (`/clientes/abc`) |
| 409 | La acción choca con el estado actual, o el registro tiene datos asociados |
| 500 | Error nuestro: siempre `"Error interno del servidor"`, sin detalles de la base |

Ningún dato mal formado llega a la base como 500: un `router.param` valida los
`:id` de la URL, los controladores validan los formatos del body y, como red de
seguridad, `errores.js` traduce a 400 los errores de formato de PostgreSQL.

## Usuarios

Los usuarios viven en la tabla `usuarios`. Las contraseñas se guardan hasheadas
con bcrypt, nunca en texto plano. `id_empleado` vincula al usuario con su ficha
de personal: es obligatorio para el rol `empleado`.

### Usuarios de prueba

Los carga `seed.sql`. **La contraseña de todos es `admin123`.** Los marcados con
* tienen que cambiarla en el primer ingreso.

| Email | Rol | Empresa | Para probar |
| --- | --- | --- | --- |
| `soporte@eventosapp.com` | superadmin | — | Panel del sistema |
| `miqueas@eventosapp.com` * | superadmin | — | Panel del sistema (dueño) |
| `admin@eventosdelcentro.com` | admin | 1 · Eventos del Centro | Todo, más Personal, Usuarios y Mi empresa |
| `usuario@eventosdelcentro.com` | coordinador | 1 · Eventos del Centro | Toda la operación |
| `carla@eventosdelcentro.com` * | empleado | 1 · Eventos del Centro | Panel del empleado (Carla Vega, tareas con proveedor y libres) |
| `admin@fiestasnorte.com` | admin | 2 · Fiestas Norte | Aislamiento entre empresas |
| `usuario@fiestasnorte.com` | coordinador | 2 · Fiestas Norte | |
| `admin@produccionessur.com` | admin | 3 · Producciones Sur | |
| `usuario@produccionessur.com` | coordinador | 3 · Producciones Sur | |
| `admin@saloneslago.com` | admin | 4 · Salones del Lago (**suspendida**) | Login rechazado con 403 |

La empresa 1 es la que tiene más datos cargados: es la que conviene usar para la
demo.

**Base ya instalada:** `npm run db:actualizar` aplica los cambios de las Fases 10
y 11 sin borrar datos (los `usuario` pasan a `coordinador`, los estados del
proveedor pasan a los 4 nuevos y la cantidad de asistentes se copia de la
solicitud al evento), pero no crea un
superadmin. Para crearlo, generar el hash con
`node -e "import('bcryptjs').then(b => b.default.hash('tuClave', 10).then(console.log))"`
y cargarlo con
`INSERT INTO usuarios (nombre, email, password, rol, debe_cambiar_password) VALUES ('Soporte', 'soporte@...', '<hash>', 'superadmin', TRUE);`.

## Estructura

```
api-eventos/
├── database/
│   ├── schema.sql                  las 16 tablas del modelo (DDL)
│   └── seed.sql                    datos de prueba y de demo
├── src/
│   ├── index.js                    crea el servidor y monta las rutas
│   ├── routes/                     una ruta por recurso
│   │   ├── auth.routes.js
│   │   ├── superadmin.routes.js    panel del sistema
│   │   ├── miEmpresa.routes.js
│   │   ├── usuarios.routes.js
│   │   ├── clientes.routes.js
│   │   ├── tiposEventos.routes.js
│   │   ├── servicios.routes.js
│   │   ├── proveedores.routes.js   incluye /:id/servicios
│   │   ├── empleados.routes.js
│   │   ├── solicitudes.routes.js   incluye /:id/presupuestos
│   │   ├── presupuestos.routes.js  incluye /:id/aceptar
│   │   ├── eventos.routes.js       incluye /:id/servicios y /:id/tareas
│   │   ├── serviciosEvento.routes.js
│   │   ├── tareas.routes.js        incluye /mias
│   │   └── seguimiento.routes.js
│   ├── controllers/                un controlador por recurso
│   │   ├── auth.controller.js      login, perfil, cambio de contraseña
│   │   ├── superadmin.controller.js  metricas, empresas y soporte
│   │   ├── miEmpresa.controller.js
│   │   ├── usuarios.controller.js
│   │   ├── clientes.controller.js
│   │   ├── tiposEventos.controller.js
│   │   ├── servicios.controller.js
│   │   ├── proveedores.controller.js
│   │   ├── empleados.controller.js
│   │   ├── solicitudes.controller.js
│   │   ├── presupuestos.controller.js
│   │   ├── eventos.controller.js   incluye aceptar (regla 4)
│   │   ├── serviciosEvento.controller.js  estado del proveedor, cambios de un servicio y pasos
│   │   ├── cambios.controller.js   historial, revisiones y resumen del evento
│   │   ├── tareas.controller.js    estado, vencida y mis tareas
│   │   └── seguimiento.controller.js  consultas agregadas del tablero
│   ├── middlewares/
│   │   ├── auth.middleware.js      verificarToken, soloEmpresa, soloSuperadmin, permitirRoles
│   │   └── validarId.middleware.js valida los :id de la URL (404 si no son enteros)
│   ├── utils/                      lo que comparten los controladores
│   │   ├── errores.js              traduce los errores de pg a HTTP
│   │   ├── consultas.js            filtros, chequeo por empresa y empleado activo
│   │   ├── validaciones.js         formatos de ids, fechas, importes y cantidades
│   │   ├── usuarios.js             reglas de usuarios (último admin, uno mismo, vínculo)
│   │   ├── indicadores.js          vencida, a revisar e indicadores: una sola definición
│   │   └── cambios.js              registrar cambios y afectados dentro de la transacción
│   └── data/
│       └── db.js                   pool de pg y parsers de fecha y monto
└── .env                            no se versiona
```

Cada recurso es un par `routes` + `controller` con los mismos cinco endpoints,
así que para agregar uno nuevo alcanza con copiar el patrón de `clientes` y
montarlo en `index.js`.

Lo que se repetía en los cinco recursos vive en `src/utils/`:

- **`errores.js`** traduce los códigos de PostgreSQL al HTTP que corresponde
  (`23505` duplicado → 400, `23503` datos asociados → 409, errores de formato
  `22P02`/`22003`/`22007`/`22008` → 400, resto → 500). Sin esto el mismo
  `try/catch` estaría escrito en cada endpoint.
- **`consultas.js`** arma el `WHERE` de `?activo` y `?buscar` siempre
  parametrizado, verifica que un id de otra tabla sea de la misma empresa y que
  un empleado trabaje hoy en ella.
- **`validaciones.js`** valida formatos antes de ir a la base: ids (enteros que
  entran en un `INTEGER`), fechas `YYYY-MM-DD` que existen, importes y
  cantidades.

Las decisiones de diseño (multitenant, versiones, costo vs. importe, secuencia
de tareas, "vencida" calculada, baja lógica, transacciones) están explicadas en
`docs/DECISIONES.md`.

`db.js` además configura dos parsers de `pg`: las fechas (`DATE`) se devuelven
como texto para que no se corran de zona horaria, y los montos (`NUMERIC`) como
número en vez de string, que es lo que pide `docs/API.md`.

## Modelo de datos

Las 16 tablas, sus campos y las reglas de negocio están documentadas en el
`CLAUDE.md` de la raíz del repo. El detalle técnico (tipos, claves, `CHECK`)
está comentado dentro de `database/schema.sql`.
