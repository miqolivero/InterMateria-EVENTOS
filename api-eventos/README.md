# API de Eventos — CRUD de empresas

Primera etapa de la API del sistema de eventos (Práctica / Programación II).
Node.js + Express + PostgreSQL, con la tabla `empresas` como base del esquema
multitenant.

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

## Variables de entorno

Copiar `.env.example` a `.env` y completar con los datos reales:

```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=su_contraseña
DB_NAME=eventos
```

## Ejecutar

```bash
npm run dev     # con --watch
npm start
```

Servidor en `http://localhost:3000`.

## Endpoints

| Método | Ruta | Acción | Respuesta |
| --- | --- | --- | --- |
| GET | `/api/empresas` | Listar todas las empresas | 200 |
| GET | `/api/empresas/:id` | Obtener una empresa | 200 / 404 |
| POST | `/api/empresas` | Crear una empresa | 201 / 400 |
| PUT | `/api/empresas/:id` | Editar una empresa | 200 / 404 |
| DELETE | `/api/empresas/:id` | Eliminar una empresa | 204 / 404 |

`nombre` y `cuit` son obligatorios al crear y al editar. El `id` lo genera la base
de datos (`SERIAL`). Cualquier ruta inexistente responde 404.

## Estructura

```
api-eventos/
├── database/empresas.sql           script de la tabla y datos de prueba
├── src/
│   ├── index.js                    crea el servidor y conecta todo
│   ├── routes/empresas.routes.js   qué rutas existen
│   ├── controllers/                qué hace cada ruta
│   └── data/db.js                  conexión a la base de datos
└── .env                            no se versiona
```
