# API de Eventos

API REST del sistema de eventos: CRUD de empresas sobre PostgreSQL, con
autenticación por JWT y permisos por rol.

## Requisitos

- Node.js 18 o superior
- PostgreSQL

## Instalación

```bash
npm install
```

## Base de datos

```bash
psql -U postgres -c "CREATE DATABASE eventos;"
psql -U postgres -d eventos -f database/empresas.sql
```

El script crea la tabla `empresas` y carga tres empresas de prueba.

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
| POST | `/register` | Crear un usuario | 201 / 400 / 409 |
| POST | `/login` | Obtener el token | 200 / 401 |
| GET | `/perfil` | Datos del usuario del token | 200 / 401 |

`POST /login` devuelve `{ token, usuario }`. Ese token se manda en las rutas
protegidas con el header `Authorization: Bearer <token>`.

### Empresas · `/api/empresas`

| Método | Ruta | Acción | Acceso | Respuesta |
| --- | --- | --- | --- | --- |
| GET | `/` | Listar todas | Público | 200 |
| GET | `/:id` | Obtener una | Público | 200 / 404 |
| POST | `/` | Crear | Con token | 201 / 400 / 401 |
| PUT | `/:id` | Editar | Con token | 200 / 400 / 401 / 404 |
| DELETE | `/:id` | Eliminar | Solo admin | 204 / 401 / 403 / 404 |

`nombre` y `cuit` son obligatorios al crear y al editar. El `id` lo genera la
base (`SERIAL`). El `cuit` es único: si se repite, la respuesta es 400.
Cualquier ruta inexistente responde 404.

### Códigos de autenticación

| Código | Significado | Cuándo |
| --- | --- | --- |
| 401 | No autenticado | No hay token, la firma no coincide o venció |
| 403 | No autorizado | El token es válido pero el rol no alcanza |

## Usuarios

Los usuarios viven en un **array en memoria** (`src/data/usuarios.js`), no en la
base. Al reiniciar el servidor se borran y hay que registrarse de nuevo.

Todo usuario nuevo nace con `rol: "usuario"`. Para probar las rutas de admin hay
que cambiar el rol a mano en el array.

Las contraseñas se guardan hasheadas con bcrypt, nunca en texto plano.

## Estructura

```
api-eventos/
├── database/empresas.sql           script de la tabla y datos de prueba
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
│       ├── db.js                   conexión a PostgreSQL
│       └── usuarios.js             usuarios en memoria
└── .env                            no se versiona
```
