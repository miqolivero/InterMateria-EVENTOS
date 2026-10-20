# Front de Eventos

Frontend en React + Vite que consume la API de `api-eventos`: listado de
empresas, alta, edición y borrado, con login por JWT.

## Requisitos

- Node.js 18 o superior
- La API corriendo en `http://localhost:3000`

## Instalación

```bash
npm install
```

## Variables de entorno

Copiar `.env.example` a `.env`:

```
VITE_API_URL=http://localhost:3000/api
```

El prefijo `VITE_` es obligatorio: sin él Vite no expone la variable. La URL de
la API no se escribe en ningún componente.

## Ejecutar

```bash
npm run dev     # http://localhost:5173
npm run build
npm run lint
```

El puerto está fijo en `vite.config.js` con `strictPort: true`, porque el CORS
de la API solo acepta `http://localhost:5173`. Si el puerto está ocupado, Vite
avisa y no arranca, en vez de pasarse al 5174 y que el navegador bloquee todo.

## Pantallas

| Ruta | Pantalla | Acceso |
| --- | --- | --- |
| `/` | Listado de empresas | Público |
| `/login` | Iniciar sesión | Público |
| `/registro` | Crear cuenta | Público |
| `/empresas/nueva` | Alta de empresa | Con sesión (la API exige admin) |
| `/empresas/:id/editar` | Edición | Con sesión (la API exige admin) |
| `*` | 404 | Público |

Las rutas con sesión están envueltas en `RutaProtegida`, que manda al login si
no hay token. Eso es para la experiencia de usuario: **la seguridad real está en
el backend**, porque cualquiera puede llamar a la API directamente.

El sistema es multitenant, así que al crear una cuenta hay que **elegir la
empresa**: `Registro.jsx` llena un `<select>` con `GET /api/empresas` (el listado
es público justamente para eso) y manda el `id_empresa` elegido. Ese id queda en
el token y es el que filtra todos los datos que ve el usuario.

El botón de eliminar solo se muestra a los usuarios con rol `admin`, pero el que
decide de verdad es el middleware de la API. Crear y editar empresas también
quedó restringido a admin en el backend: un usuario común que entre a esas
pantallas va a recibir un 403 al guardar (ocultar esos botones es parte de la
fase 2).

## Cómo viaja el token

El login guarda el token y el usuario en `localStorage`. A partir de ahí los
interceptores de axios (`src/servicios/axiosConfig.js`) hacen el resto:

- **Antes de cada petición** agregan el header `Authorization: Bearer <token>`.
  Ningún componente tiene que acordarse de mandarlo.
- **Después de cada respuesta**, si vuelve un 401 (token vencido o inválido),
  borran el token y redirigen al login.

Por eso todos los servicios tienen que usar la instancia `api` y no `axios`
directo: si no, la petición sale sin token y la API responde 401.

Cerrar sesión es simplemente borrar el token del navegador: con JWT el servidor
no guarda sesiones.

## Estructura

```
front-eventos/src/
├── main.jsx                     envuelve la app en <BrowserRouter>
├── App.jsx                      define las rutas
├── servicios/
│   ├── axiosConfig.js           instancia de axios + interceptores
│   ├── authService.js           login, registro, perfil
│   └── empresasService.js       una función por endpoint
├── componentes/
│   ├── Navbar.jsx               navegación, usuario y cerrar sesión
│   └── RutaProtegida.jsx
└── paginas/
    ├── Empresas.jsx             listado
    ├── EmpresaForm.jsx          alta y edición (mismo componente)
    ├── Login.jsx
    ├── Registro.jsx
    └── NoEncontrada.jsx
```

Los estilos van en un `.css` por componente, al lado del `.jsx`.
