# Instalación y configuración local

El backend, el frontend y PostgreSQL son procesos separados. Ejecutar los
comandos desde la carpeta indicada. El clon de Git no incluye la base ni los .env.

## 1. Requisitos y dependencias

- Git.
- Node.js 22.12 o superior; Vite también admite la línea 20 desde 20.19.
- PostgreSQL en ejecución. El entorno local se verificó con PostgreSQL 18.
- `psql` para ejecutar SQL y `pg_dump` para respaldos. pgAdmin es opcional.

Después de clonar `main`, desde la raíz instalar las versiones del lockfile:

```bash
cd api-eventos
npm ci
cd ../front-eventos
npm ci
cd ..
```

Si se agrega o actualiza una dependencia durante el desarrollo, usar
`npm install` y versionar el `package-lock.json` correspondiente.

## 2. Variables de entorno

Desde la raíz, en PowerShell:

```powershell
Copy-Item api-eventos/.env.example api-eventos/.env
Copy-Item front-eventos/.env.example front-eventos/.env
```

En Linux o macOS, usar `cp` en lugar de `Copy-Item`. Hacerlo solo en la primera
instalación: no sobrescribir un `.env` existente con la plantilla.

Editar `api-eventos/.env`: completar `DB_PASSWORD` con la contraseña local y
`JWT_SECRET` con una clave generada para esa instalación:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copiar el resultado a `JWT_SECRET`. No dejarlo vacío ni usar la contraseña de
PostgreSQL como clave JWT. Las variables del backend son:

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto de Express; predeterminado 3000 |
| `DB_HOST`, `DB_PORT` | Servidor y puerto de PostgreSQL; normalmente localhost:5432 |
| `DB_USER`, `DB_PASSWORD` | Credenciales de PostgreSQL de esta computadora |
| `DB_NAME` | Base de la aplicación; el ejemplo usa `eventos` |
| `FRONT_URL` | Origen permitido por CORS; debe coincidir con la URL del navegador |
| `JWT_SECRET` | Clave privada para firmar y verificar tokens |
| `JWT_EXPIRES_IN` | Vigencia del token; el ejemplo usa `1h` |
| `PG_DUMP` | Opcional: ruta de `pg_dump` para `npm run db:actualizar` |

En `front-eventos/.env`, `VITE_API_URL=http://localhost:3000/api` apunta a la
API real. Incluir `/api` y el mismo puerto que `PORT`. Las variables `VITE_*`
son públicas en el navegador: no colocar contraseñas ni claves allí.

Si una contraseña contiene `#` o espacios, escribir el valor entre comillas
en el `.env`. Reiniciar el proceso correspondiente después de editarlo.

## 3. Preparar PostgreSQL

Elegir **una** opción. La base indicada en los comandos debe coincidir con
`DB_NAME` del `.env`.

### A. Instalación nueva con datos de demostración

Usar exclusivamente una base nueva. Desde `api-eventos`:

```bash
psql -U postgres -c "CREATE DATABASE eventos;"
psql -U postgres -d eventos -v ON_ERROR_STOP=1 --single-transaction -f database/schema.sql
psql -U postgres -d eventos -v ON_ERROR_STOP=1 --single-transaction -f database/seed.sql
```

`psql` pide la contraseña de PostgreSQL; no lee el `.env`. Si se usa otro
host, puerto o usuario, agregar los argumentos `-h`, `-p` o `-U`. No continuar
si falla un comando. Si `eventos` ya existe, comprobar su contenido y elegir
una base nueva o seguir la opción B.

`schema.sql` recrea las 16 tablas y **borra las existentes**. `seed.sql` carga
empresas, usuarios y un circuito de demo; se ejecuta una sola vez sobre el
esquema recién creado. No cargar estos scripts sobre datos que se quieran conservar.

En Windows, si `psql` no está en PATH y se instaló PostgreSQL 18, agregar a
la terminal actual:

```powershell
$env:Path = "C:\Program Files\PostgreSQL\18\bin;$env:Path"
```

En pgAdmin: crear una base vacía `eventos`, abrir su Query Tool y ejecutar
primero `database/schema.sql` y después `database/seed.sql`. Confirmar que
no hubo errores antes de iniciar la API.

### B. Base existente del proyecto

Para la base antigua de empresas/clientes, completar el `.env` y ejecutar
desde `api-eventos`:

```bash
npm run db:actualizar
```

El comando respalda la base completa antes de modificarla y actualiza en una
transacción. Agrega tablas e índices faltantes, adapta el identificador
antiguo de clientes y sus campos faltantes, y carga los cuatro tipos fijos
de tarea. Conserva empresas y clientes; no crea cuentas ni datos de demo.
Puede repetirse sobre el esquema actualizado.

Está preparado para el modelo antiguo del proyecto y el actual; no migra
cualquier esquema arbitrario. Si otra instalación tiene modificaciones
manuales, revisar sus diferencias antes de actualizarla.

El respaldo Custom `.dump` queda en `laboratorio-bd/respaldos/`, fuera de Git.
`pg_dump` debe estar en PATH o configurado en `PG_DUMP`; también se detecta
PostgreSQL 18 en Windows. Si falla el respaldo, el script se detiene antes
de modificar la base. No ejecuta `schema.sql` ni `seed.sql`.

Para recuperar un respaldo, restaurarlo con pgAdmin o `pg_restore` en **otra
base vacía** y verificarlo antes de reemplazar datos.

## 4. Iniciar la aplicación

Abrir dos terminales desde la raíz:

```bash
# Terminal 1
cd api-eventos
npm run dev
```

```bash
# Terminal 2
cd front-eventos
npm run dev
```

Abrir [http://localhost:5173](http://localhost:5173). La API debe anunciar
`http://localhost:3000`. `npm start` dentro de `api-eventos` inicia la API sin
recarga automática. Detener cada proceso con Ctrl+C.

El frontend fija el puerto 5173. Si se cambia en `vite.config.js`, actualizar
`FRONT_URL`. `localhost` y `127.0.0.1` son orígenes distintos para CORS.

## 5. Comprobar la instalación

1. Visitar `/` o `/eventos` sin sesión: debe redirigir a `/login`.
2. Con seed, ingresar con `admin@eventosdelcentro.com` y contraseña `admin123`.
   Para probar el rol común: `usuario@eventosdelcentro.com`, misma contraseña.
   Las demás cuentas están en el README del backend.
3. Abrir Empresas, Clientes y Seguimiento y comprobar que carguen los datos.
4. Probar registro con un email nuevo y una empresa activa; luego iniciar sesión.
   El registro crea siempre un usuario común.
5. Cerrar sesión y comprobar que las pantallas protegidas vuelvan al login.

Las cuentas de demo existen **solo si se cargó seed.sql**; actualizar una base
existente no las crea. El registro necesita una empresa activa. Si no existe
ningún administrador, su alta debe realizarla el responsable de la base; el
formulario público no permite elegir ese rol. Las credenciales de demo son
públicas y se usan solo en desarrollo.

## Problemas frecuentes

| Síntoma | Revisar |
| --- | --- |
| `EADDRINUSE` / puerto ocupado | Detener el proceso anterior y ejecutar la API con `npm run dev` dentro de `api-eventos`; el inicio actual es `src/index.js` |
| Error de red / `ECONNREFUSED` | API y PostgreSQL iniciados, puertos correctos y `VITE_API_URL` con `/api` |
| Bloqueo CORS | `FRONT_URL` coincide exactamente con el origen del navegador |
| PostgreSQL rechaza la contraseña | Credenciales locales de `api-eventos/.env`; reiniciar la API |
| HTTP 500 / tabla o columna inexistente | Base correcta en `DB_NAME`, esquema preparado y detalle del error en la terminal del backend |
| Login devuelve 500 | Además de la base, revisar `JWT_SECRET` y `JWT_EXPIRES_IN` |
| HTTP 401 | Login incorrecto, token vencido o firma cambiada; volver a iniciar sesión |
| HTTP 403 | La cuenta no tiene el rol requerido |
| Registro sin empresas | Necesita una empresa activa; comprobar que el listado de empresas responda |
| `psql` o `pg_dump` no encontrado | Agregar las herramientas PostgreSQL al PATH; para respaldo también se admite `PG_DUMP` |

Un `git pull` actualiza código, no modifica automáticamente el `.env` ni la
base. Revisar las instrucciones del cambio antes de aplicar SQL. No recrear
tablas para resolver un error de conexión.
