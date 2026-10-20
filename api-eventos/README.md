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

`POST /login` devuelve `{ token, usuario }`. El payload del token es
`{ id, email, rol, id_empresa }`: de ahí sale el `id_empresa` con el que los
controladores filtran los datos, **nunca del body ni de la URL**. Ese token se
manda en las rutas protegidas con el header `Authorization: Bearer <token>`.

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
base (`SERIAL`). El `cuit` es único: si se repite, la respuesta es 400.
Cualquier ruta inexistente responde 404.

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
│   ├── index.js                    crea el servidor y conecta todo
│   ├── routes/
│   │   ├── empresas.routes.js      rutas de empresas
│   │   └── auth.routes.js          rutas de autenticación
│   ├── controllers/
│   │   ├── empresas.controller.js
│   │   └── auth.controller.js      registrar, login, perfil
│   ├── middlewares/
│   │   └── auth.middleware.js      verificarToken, verificarRol
│   └── data/
│       └── db.js                   conexión a PostgreSQL (pool de pg)
└── .env                            no se versiona
```

## Modelo de datos

Las 16 tablas, sus campos y las reglas de negocio están documentadas en el
`CLAUDE.md` de la raíz del repo. El detalle técnico (tipos, claves, `CHECK`)
está comentado dentro de `database/schema.sql`.
