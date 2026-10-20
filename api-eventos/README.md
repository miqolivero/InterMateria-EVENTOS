# API de Eventos

API REST del sistema de gestión de eventos sobre PostgreSQL, con autenticación
por JWT y permisos por rol. El sistema es **multitenant**: varias empresas
organizadoras usan la misma base y cada una ve solo sus propios datos. Cada
usuario pertenece a una empresa, y ese `id_empresa` viaja en el token.

## Requisitos

- Node.js 18 o superior
- PostgreSQL

## Instalación

```bash
npm install
```

## Base de datos

Son dos scripts, y el orden importa:

```bash
psql -U postgres -c "CREATE DATABASE eventos;"
psql -U postgres -d eventos -f database/schema.sql
psql -U postgres -d eventos -f database/seed.sql
```

- **`schema.sql`** crea las 16 tablas del modelo, con sus claves foráneas, los
  `UNIQUE`, los `CHECK` de cada estado y los índices. **Arranca borrando todas
  las tablas del sistema**, así que se puede volver a correr las veces que haga
  falta, pero nunca sobre datos que no se quieran perder.
- **`seed.sql`** carga los datos de prueba: las 3 empresas, los 4 tipos de tarea
  y los usuarios. Para la empresa 1 arma un circuito completo (clientes,
  catálogos, proveedores, una solicitud pendiente, otra aceptada con 2 versiones
  de presupuesto y su evento en preparación con servicios y tareas). La empresa 2
  tiene unos pocos datos propios, para poder probar el aislamiento entre empresas.

Las fechas del seed son relativas a `CURRENT_DATE`, así siempre hay un evento
próximo y una tarea vencida sin tener que editar el script cada semana.

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

### Autenticación · `/api/auth`

| Método | Ruta | Acción | Respuesta |
| --- | --- | --- | --- |
| POST | `/register` | Crear un usuario | 201 / 400 |
| POST | `/login` | Obtener el token | 200 / 401 |
| GET | `/perfil` | Datos del usuario del token | 200 / 401 / 404 |

`POST /register` espera `{ nombre, email, password, id_empresa }`. La empresa
tiene que existir y estar activa; si no, responde 400. El email es único: si se
repite, también 400. Todo usuario nuevo nace con `rol: "usuario"`.

`POST /login` devuelve `{ token, usuario }`, donde `usuario` trae `id_usuario`,
`nombre`, `email`, `rol`, `id_empresa`, `nombre_empresa` e `id_empleado`.

El payload del token es `{ id, email, rol, id_empresa }`: de ahí sale el
`id_empresa` con el que los controladores filtran los datos, **nunca del body ni
de la URL**. Ese token se manda en las rutas protegidas con el header
`Authorization: Bearer <token>`.

### Empresas · `/api/empresas`

| Método | Ruta | Acción | Acceso | Respuesta |
| --- | --- | --- | --- | --- |
| GET | `/` | Listar todas | Público | 200 |
| GET | `/:id` | Obtener una | Público | 200 / 404 |
| POST | `/` | Crear | Solo admin | 201 / 400 / 401 / 403 |
| PUT | `/:id` | Editar | Solo admin | 200 / 400 / 401 / 403 / 404 |
| DELETE | `/:id` | Eliminar | Solo admin | 204 / 401 / 403 / 404 |

El listado sigue siendo **público** porque lo usa la pantalla de registro para
llenar el select de empresas, cuando todavía no hay token. Dar de alta, editar o
borrar una empresa, en cambio, es crear o tocar un tenant del sistema: eso queda
**solo para admin**.

`nombre` y `cuit` son obligatorios al crear y al editar. El `id` lo genera la
base (`SERIAL`). El `cuit` es único: si se repite, la respuesta es 400. Borrar
una empresa que ya tiene usuarios, clientes o eventos responde **409**: hay que
desactivarla, no eliminarla. Cualquier ruta inexistente responde 404.

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

El contrato completo, con el JSON de cada respuesta y los mensajes de error
exactos, está en `docs/API.md`.

### Códigos de autenticación

| Código | Significado | Cuándo |
| --- | --- | --- |
| 401 | No autenticado | No hay token, la firma no coincide o venció |
| 403 | No autorizado | El token es válido pero el rol no alcanza |

## Usuarios

Los usuarios viven en la tabla `usuarios` de la base, no en memoria: el sistema
es multitenant y cada usuario tiene que estar atado a una empresa. Las
contraseñas se guardan hasheadas con bcrypt, nunca en texto plano.

`id_empleado` es opcional y vincula al usuario con una fila de `empleados`. Es lo
que después permite mostrarle "sus" tareas.

### Usuarios de prueba

Los carga `seed.sql`. **La contraseña de todos es `admin123`.**

| Email | Rol | Empresa | Empleado |
| --- | --- | --- | --- |
| `admin@eventosdelcentro.com` | admin | 1 · Eventos del Centro | Laura Gimenez |
| `usuario@eventosdelcentro.com` | usuario | 1 · Eventos del Centro | Martin Rios |
| `admin@fiestasnorte.com` | admin | 2 · Fiestas Norte | Nadia Paz |
| `usuario@fiestasnorte.com` | usuario | 2 · Fiestas Norte | — |
| `admin@produccionessur.com` | admin | 3 · Producciones Sur | — |
| `usuario@produccionessur.com` | usuario | 3 · Producciones Sur | — |

La empresa 1 es la que tiene todos los datos cargados: es la que conviene usar
para la demo. Para probar el aislamiento entre empresas, entrar con un usuario de
la empresa 2 e intentar acceder a un registro de la 1.

## Estructura

```
api-eventos/
├── database/
│   ├── schema.sql                  las 16 tablas del modelo (DDL)
│   └── seed.sql                    datos de prueba
├── src/
│   ├── index.js                    crea el servidor y monta las rutas
│   ├── routes/                     una ruta por recurso
│   │   ├── auth.routes.js
│   │   ├── empresas.routes.js
│   │   ├── clientes.routes.js
│   │   ├── tiposEventos.routes.js
│   │   ├── servicios.routes.js
│   │   ├── proveedores.routes.js   incluye /:id/servicios
│   │   ├── empleados.routes.js
│   │   └── solicitudes.routes.js
│   ├── controllers/                un controlador por recurso
│   │   ├── auth.controller.js      registrar, login, perfil
│   │   ├── empresas.controller.js
│   │   ├── clientes.controller.js
│   │   ├── tiposEventos.controller.js
│   │   ├── servicios.controller.js
│   │   ├── proveedores.controller.js
│   │   ├── empleados.controller.js
│   │   └── solicitudes.controller.js
│   ├── middlewares/
│   │   └── auth.middleware.js      verificarToken, verificarRol
│   ├── utils/                      lo que comparten los controladores
│   │   ├── errores.js              traduce los errores de pg a HTTP
│   │   └── consultas.js            filtros de listado y chequeo por empresa
│   └── data/
│       └── db.js                   pool de pg y parsers de fecha y monto
└── .env                            no se versiona
```

Cada recurso es un par `routes` + `controller` con los mismos cinco endpoints,
así que para agregar uno nuevo alcanza con copiar el patrón de `clientes` y
montarlo en `index.js`.

Lo que se repetía en los cinco recursos vive en `src/utils/`:

- **`errores.js`** traduce los códigos de PostgreSQL al HTTP que corresponde
  (`23505` duplicado → 400, `23503` datos asociados → 409, resto → 500). Sin
  esto el mismo `try/catch` estaría escrito 25 veces.
- **`consultas.js`** arma el `WHERE` de `?activo` y `?buscar` siempre
  parametrizado, y verifica que un id de otra tabla sea de la misma empresa.

`db.js` además configura dos parsers de `pg`: las fechas (`DATE`) se devuelven
como texto para que no se corran de zona horaria, y los montos (`NUMERIC`) como
número en vez de string, que es lo que pide `docs/API.md`.

## Modelo de datos

Las 16 tablas, sus campos y las reglas de negocio están documentadas en el
`CLAUDE.md` de la raíz del repo. El detalle técnico (tipos, claves, `CHECK`)
está comentado dentro de `database/schema.sql`.
