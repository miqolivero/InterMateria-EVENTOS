# Sistema de Eventos — cómo está armado el proyecto

Documento interno para entender el proyecto completo y poder explicarlo.
No se sube a GitHub (está en el `.gitignore`).

Cubre las tres etapas que hicimos:

1. La API con el CRUD de empresas sobre PostgreSQL
2. El frontend en React que la consume
3. La autenticación con JWT

---

## 1. Qué es esto

Un sistema de eventos **multitenant**: una misma aplicación usada por varias
empresas, donde cada una ve solo sus propios datos. Por eso la primera tabla es
`empresas`, y todo lo que venga después va a colgar de un `id_empresa`.

Son dos proyectos separados que se hablan por HTTP:

```
Inter-Materias/            <- acá está el .git (un repo para los dos)
├── api-eventos/           Node + Express + PostgreSQL   puerto 3000
└── front-eventos/         React + Vite                  puerto 5173
```

Tres piezas en total:

```
navegador (React :5173)  --HTTP-->  API (Express :3000)  --SQL-->  PostgreSQL :5432
```

Cada una corre por separado. Si falta una, las otras no funcionan: el front sin
la API muestra un error de conexión, y la API sin Postgres responde 500.

---

## 2. La API

### Estructura

```
api-eventos/
├── database/empresas.sql           script de la tabla y datos de prueba
├── src/
│   ├── index.js                    arranca el servidor y conecta todo
│   ├── routes/                     QUÉ rutas existen
│   ├── controllers/                QUÉ hace cada ruta
│   ├── middlewares/                el portero de las rutas protegidas
│   └── data/                       conexión a la base y usuarios
├── .env                            datos reales (NO se sube)
├── .env.example                    plantilla (sí se sube)
└── package.json
```

La idea de separar en capas es que cada archivo tenga **una sola
responsabilidad**. Si mañana hay que agregar la tabla `eventos`, se crean
`eventos.routes.js` y `eventos.controller.js` y no se toca nada de lo anterior.

### index.js

```js
import "dotenv/config";   // <- PRIMERA LÍNEA, siempre
import express from "express";
import cors from "cors";
import empresasRoutes from "./routes/empresas.routes.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONT_URL }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/empresas", empresasRoutes);

// Ruta 404: SIEMPRE al final
app.use((req, res) => {
  res.status(404).json({ mensaje: "Ruta no encontrada" });
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
```

Tres cosas importantes:

1. **`import "dotenv/config"` va primero.** En ES Modules los `import` se
   ejecutan antes que todo lo demás. Si dotenv no carga primero, cuando `db.js`
   lee `process.env.DB_HOST` todavía está vacío y la conexión falla. Lo mismo
   con `JWT_SECRET`.
2. **El 404 va último.** Express recorre los middlewares en orden: si el pedido
   no matcheó ninguna ruta anterior, cae ahí. Arriba atraparía *todo*.
3. **`cors` va antes de las rutas**, si no el navegador no recibe los headers.

### La conexión a Postgres

```js
import pg from "pg";

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

export default pool;
```

Un **Pool** es un conjunto de conexiones reutilizables: en vez de abrir y cerrar
una por cada consulta (que es lento), mantiene varias abiertas y las presta.

### El molde de los controladores

```js
export const loQueSea = async (req, res) => {
  try {
    const resultado = await pool.query("SQL...", [valores]);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ mensaje: "Error ..." });
  }
};
```

- **`async`** porque la base tarda: `await` espera sin bloquear el servidor.
- **`try/catch`** porque si la base está caída, sin el catch se cae el servidor
  entero. Con el catch responde 500 y sigue vivo.
- `resultado.rows` es el array de filas. `rows[0]` para un solo registro, y
  `rows.length === 0` significa "no existe" → 404.

### Los endpoints de empresas

| Método | Ruta | Qué hace | Acceso | Respuestas |
|---|---|---|---|---|
| GET | `/api/empresas` | Lista todas | Público | 200 |
| GET | `/api/empresas/:id` | Trae una | Público | 200 / 404 |
| POST | `/api/empresas` | Crea | Con token | 201 / 400 / 401 |
| PUT | `/api/empresas/:id` | Edita | Con token | 200 / 404 / 401 |
| DELETE | `/api/empresas/:id` | Elimina | Solo admin | 204 / 403 / 404 |

Detalles que suelen trabar:

- **El `return` antes del `res.status(404)`**: sin él la función sigue y trata de
  mandar una segunda respuesta → error "headers already sent".
- **`RETURNING *`** en el INSERT y el UPDATE hace que la consulta devuelva la
  fila ya guardada, con el `id_empresa` y la `fecha_creacion` que puso la base.
  Así no hace falta un segundo SELECT. En el DELETE sirve para saber **si
  realmente borró algo**: si vuelve vacío, el id no existía.
- **`email ?? null`**: si el campo no viene en el body queda `undefined`, y `pg`
  no sabe qué hacer con eso. Convertirlo a `null` guarda NULL, que es lo
  correcto.
- **`activo = COALESCE($6, activo)`** en el UPDATE: "si me mandaron un valor
  usalo, si no dejá el que tenía". Sin eso, editar sin mandar `activo` lo
  pondría en NULL sin querer.
- **201** al crear (no 200) y **204 sin cuerpo** al borrar: por eso es `.send()`
  vacío y no `.json(...)`.

### Consultas parametrizadas: no es opcional

**Mal:**

```js
pool.query(`SELECT * FROM empresas WHERE id_empresa = ${id}`);
```

**Bien:**

```js
pool.query("SELECT * FROM empresas WHERE id_empresa = $1", [id]);
```

En la primera forma el valor se pega como texto dentro del SQL. Si alguien manda
un id que en realidad es `1; DROP TABLE empresas;`, Postgres lo ejecuta: eso es
**inyección SQL**. Con `$1` el driver manda la consulta y los valores por
separado, y el valor nunca se interpreta como código.

---

## 3. La autenticación con JWT

### El problema que resuelve

Hasta acá cualquiera podía borrar empresas. Necesitamos dos cosas distintas:

- **Autenticación**: ¿quién sos?
- **Autorización**: ¿qué podés hacer?

Con JWT el servidor **no guarda sesiones**. Al hacer login entrega un token
firmado, y el cliente lo manda en cada petición como prueba de identidad. El
servidor solo verifica la firma.

### Anatomía del token

Son tres partes separadas por puntos: `header.payload.signature`

```
header     { "alg": "HS256", "typ": "JWT" }
payload    { "id": 1, "email": "juan@mail.com", "rol": "usuario", "iat": ..., "exp": ... }
signature  HMACSHA256(header + "." + payload, JWT_SECRET)
```

**El payload no está encriptado, está codificado.** Cualquiera puede leerlo
pegándolo en jwt.io. Lo que no puede es *modificarlo*: si cambia una letra, la
firma deja de coincidir y `jwt.verify` lo rechaza. Por eso nunca se pone la
contraseña en el payload.

### El flujo completo

```
1. POST /api/auth/login con email y password
2. El servidor compara con bcrypt y firma un token con jwt.sign
3. El cliente lo guarda en localStorage
4. En cada petición manda:  Authorization: Bearer <token>
5. El middleware lo verifica con jwt.verify antes de llegar al controlador
```

### Las contraseñas: hash, no texto plano

```js
const passwordHash = await bcrypt.hash(password, 10);   // al registrar
const ok = await bcrypt.compare(password, usuario.password);  // al loguear
```

El hash es de una sola dirección: no hay forma de volver a la contraseña
original. Por eso al loguear no se "desencripta" nada, se vuelve a hashear lo
que mandó el usuario y se comparan los hashes.

Detalle del login: si falla el email y si falla la contraseña devolvemos **el
mismo mensaje**. Así no le revelamos a nadie qué emails están registrados.

### Los dos middlewares

```js
export const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ mensaje: "Token no proporcionado" });
  }

  const token = authHeader.split(" ")[1];   // separa "Bearer" del token

  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = datos;    // queda disponible para los siguientes pasos
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ mensaje: "El token expiro" });
    }
    return res.status(401).json({ mensaje: "Token invalido" });
  }
};

export const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: "No tenes permiso para esta accion" });
    }
    next();
  };
};
```

`verificarToken` dice **quién** sos. `verificarRol` decide si **podés**.
Y se usan así:

```js
router.get("/", obtenerEmpresas);                                        // público
router.post("/", verificarToken, crearEmpresa);                          // logueado
router.delete("/:id", verificarToken, verificarRol("admin"), eliminar);  // admin
```

**El orden importa**: `verificarToken` crea `req.usuario`, y `verificarRol` lo
usa. Al revés tira `Cannot read properties of undefined (reading 'rol')`.

### 401 vs 403

| Código | Pregunta | Cuándo | Middleware |
|---|---|---|---|
| **401** | ¿Quién sos? No sé. | No hay token, la firma no coincide o venció | `verificarToken` |
| **403** | Sé quién sos, pero no podés. | Token válido, rol insuficiente | `verificarRol` |

### Los usuarios están en memoria

`src/data/usuarios.js` es un array vacío, igual que la guía. Dos consecuencias
que conviene saber antes de que te desconcierten:

- **Al reiniciar el servidor se borran** y hay que registrarse de nuevo. Si el
  login empieza a dar "Credenciales inválidas" de la nada, es por esto.
- **Todo usuario nuevo nace con `rol: "usuario"`.** Para probar el borrado hay
  que cambiarlo a `"admin"` a mano en el array.

---

## 4. El frontend

### Estructura

```
front-eventos/src/
├── main.jsx                     envuelve la app en <BrowserRouter>
├── App.jsx                      define las rutas
├── servicios/
│   ├── axiosConfig.js           instancia de axios + interceptores
│   ├── authService.js           login, registro, perfil
│   └── empresasService.js       una función por endpoint
├── componentes/
│   ├── Navbar.jsx
│   └── RutaProtegida.jsx
└── paginas/
    ├── Empresas.jsx             listado
    ├── EmpresaForm.jsx          alta y edición (el mismo componente)
    ├── Login.jsx
    ├── Registro.jsx
    └── NoEncontrada.jsx
```

Los estilos van en un `.css` por componente, al lado del `.jsx`. Nada de estilos
inline.

### Las rutas del front no son las de la API

Son dos cosas distintas que se parecen. `/empresas/nueva` es una **pantalla del
navegador**; `POST /api/empresas` es un **endpoint**. React Router decide qué
componente mostrar, no qué pide la API.

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/` | Listado | Público |
| `/login` · `/registro` | Sesión | Público |
| `/empresas/nueva` | Alta | Con sesión |
| `/empresas/:id/editar` | Edición | Con sesión |
| `*` | 404 | Público |

El `*` va último, igual que el 404 de Express.

### La URL de la API no se escribe en los componentes

Va en el `.env` del front:

```
VITE_API_URL=http://localhost:3000/api
```

El prefijo **`VITE_` es obligatorio**: sin él Vite no expone la variable y llega
`undefined`. Se lee con `import.meta.env.VITE_API_URL` (no `process.env`, eso es
de Node).

### Los interceptores: la parte más útil

```js
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// ANTES de cada petición: agregar el token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;   // obligatorio: sin esto la petición no sale
});

// DESPUÉS de cada respuesta: si es 401, cerrar sesión
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
```

El de request es como un middleware pero del lado del cliente: ningún componente
tiene que acordarse de mandar el token. El de response cubre el token vencido en
cualquier pantalla.

**Por eso todos los servicios tienen que usar la instancia `api` y no `axios`
directo.** Si un servicio importa `axios`, la petición sale sin token y la API
responde 401.

### Los tres estados de una pantalla que pide datos

```js
const [empresas, setEmpresas] = useState([]);
const [cargando, setCargando] = useState(true);
const [error, setError] = useState("");
```

Sin esto la pantalla queda en blanco mientras carga y no avisa nada si falla.
El `useEffect` con array vacío hace que el pedido salga **una sola vez**, al
montar.

### El mismo formulario para crear y editar

`EmpresaForm.jsx` mira si la URL trae un `:id` con `useParams()`. Si lo trae,
pide esa empresa, carga los campos y hace PUT. Si no, arranca vacío y hace POST.
Un componente en vez de dos casi idénticos.

### El borrado

Después de que la API confirma, se saca la fila del estado con `filter` en vez
de volver a pedir todo el listado. Es más rápido y no parpadea.

### Esconder un botón no es seguridad

`RutaProtegida` manda al login si no hay token, y el botón de eliminar solo
aparece si el rol es admin. **Eso es experiencia de usuario, no seguridad**:
cualquiera puede abrir Thunder Client y llamar a la API directamente. La
protección real está en los middlewares del backend. El front esconde, el
backend prohíbe.

---

## 5. Levantar todo desde cero

```bash
# 1. Base de datos
psql -U postgres -c "CREATE DATABASE eventos;"
psql -U postgres -d eventos -f api-eventos/database/empresas.sql

# 2. Copiar los dos .env.example a .env y completarlos

# 3. API
cd api-eventos
npm install
npm run dev          # :3000

# 4. Front, en otra terminal
cd front-eventos
npm install
npm run dev          # :5173
```

> En Windows, si `psql` no se reconoce como comando, está en
> `C:\Program Files\PostgreSQL\18\bin\psql.exe`. Hay que usar la ruta completa
> entre comillas o agregar esa carpeta al PATH.

---

## 6. Cómo probarlo

El orden importa: **primero el backend solo**, con Thunder Client o Postman.
Si algo falla, así sabés si el problema está en la API o en React.

```
1) POST /api/auth/register   { "nombre": "Juan", "email": "juan@mail.com", "password": "123456" }
   → 201

2) POST /api/auth/login      { "email": "juan@mail.com", "password": "123456" }
   → 200  { "token": "eyJhbGci...", "usuario": {...} }

3) POST /api/empresas        sin token
   → 401  { "mensaje": "Token no proporcionado" }

4) POST /api/empresas        Auth → Bearer → pegar el token
   → 201

5) DELETE /api/empresas/1    con rol "usuario"
   → 403  { "mensaje": "No tenes permiso para esta accion" }
```

Casos que demuestran que cumple la consigna:

- Crear sin `nombre` o sin `cuit` → **400**.
- Pedir / editar / borrar el id `999` → **404**.
- Crear una empresa, **reiniciar el servidor** y volver a listar: tiene que
  seguir estando (prueba que se guarda en la base y no en memoria).
- Una ruta inventada como `/api/cualquiera` → **404**.
- Cambiarle una letra al token → **401 Token inválido**.

---

## 7. Errores que nos pasaron de verdad

| Síntoma | Causa real | Solución |
|---|---|---|
| "No se pudo conectar con la API" pero la API está corriendo | El front arrancó en el **5174** porque el 5173 estaba ocupado por otro proyecto, y el CORS solo acepta el 5173. El navegador bloquea y axios no distingue un bloqueo de CORS de un servidor caído | Liberar el 5173. Está fijo en `vite.config.js` con `strictPort: true`, así Vite avisa en vez de cambiarse de puerto |
| `500 Error al obtener las empresas` | La base no existía / la contraseña del `.env` no era la de Postgres (código `28P01`) | Crear la base y corregir `DB_PASSWORD` |
| `Port 5173 is already in use` | Quedó un proceso de Vite vivo. Al cerrar npm, el proceso hijo a veces sobrevive | Matarlo por PID |
| `secretOrPrivateKey must have a value` | `process.env.JWT_SECRET` es `undefined` | Revisar el `.env`, que `import "dotenv/config"` esté primero y **reiniciar** (`--watch` no recarga el `.env`) |
| `Cannot read properties of undefined (reading 'rol')` | `verificarRol` corrió antes que `verificarToken` | `verificarToken` siempre primero |
| Login siempre da "Credenciales inválidas" | Se reinició el servidor y los usuarios en memoria se borraron | Registrarse de nuevo |
| `401 Token no proporcionado` aunque hay sesión | El servicio usa `axios` directo en vez de la instancia `api` | Importar `api` |

---

## 8. Glosario

- **Multitenant**: un solo sistema usado por varias empresas, cada una viendo
  solo sus datos.
- **Pool**: conjunto de conexiones a la base reutilizables.
- **Middleware**: función que corre entre que llega el pedido y se responde.
  `cors()`, `express.json()`, `verificarToken` y el 404 son middlewares.
- **ES Modules**: el sistema de `import`/`export`. Se activa con
  `"type": "module"` en el `package.json`.
- **SERIAL**: tipo de Postgres que genera el id solo.
- **`RETURNING *`**: hace que un INSERT/UPDATE/DELETE devuelva las filas
  afectadas.
- **Hash**: transformación de una sola dirección. Se usa para contraseñas
  porque no se puede revertir.
- **JWT**: token firmado que prueba quién sos, sin que el servidor guarde
  sesiones.
- **Payload**: los datos que van adentro del token. Codificados, no
  encriptados: se pueden leer, pero no modificar sin romper la firma.
- **Interceptor**: función de axios que corre antes de cada petición o después
  de cada respuesta.
