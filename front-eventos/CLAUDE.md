# CLAUDE.md · Frontend (front-eventos)

Complementa el `CLAUDE.md` de la raíz. Las sesiones que se abren en esta carpeta
son **solo de frontend**: no se modifica nada en `api-eventos/` ni en
`docs/API.md`.

## Stack

React 19, Vite, React Router 7, axios y **Ant Design 6** (`antd@6` +
`@ant-design/icons@6`). Antd 6 soporta React 19 sin parches, así que **no** hay
que instalar `@ant-design/v5-patch-for-react-19`. Las fechas se manejan con
`dayjs`, que ya viene con antd.

## La API se consume según el contrato

- **La única fuente de verdad es `docs/API.md`.** Los nombres de campos, rutas y
  respuestas salen de ahí, no se inventan.
- Si un endpoint todavía no está implementado, la pantalla se construye contra
  el contrato y se prueba en cuanto el backend lo mergea. No se agregan librerías
  de mocks.
- Si falta algo en el contrato o hace falta un campo más, **frenar y avisar**:
  ese cambio lo hace el backend.

## Convenciones (seguir lo que ya existe)

- **Estructura**:
  - `src/paginas/`: pantallas.
  - `src/componentes/`: piezas reutilizables.
  - `src/servicios/`: una función por endpoint, un archivo por recurso.
  - `src/utils/`: formato de datos y colores de estados.
- **Siempre usar la instancia `api` de `servicios/axiosConfig.js`**, nunca
  `axios` directo. Así viaja el token y se maneja el 401.
- La URL de la API sale de `VITE_API_URL`. Nunca se escribe en un componente.
- **Nombres en español**: componentes, funciones, variables y textos.
- Cada pantalla maneja tres estados: **cargando, error y datos**.
- El **mismo componente de formulario** sirve para alta y edición, según si la
  URL trae `:id` (como `EmpresaForm`).
- Ante un 4xx, mostrar el `mensaje` que manda la API.
- `RutaProtegida` y ocultar botones según el rol mejoran la experiencia, pero
  **no son seguridad**: la seguridad está en la API.

## Roles y layouts (Fase 10)

Según `usuario.rol` del login hay **tres layouts**:

| Rol | Layout | Inicio | Menú |
| --- | --- | --- | --- |
| `superadmin` | `LayoutSuperadmin` | `/superadmin` | Resumen, Empresas |
| `admin` | `LayoutPrincipal` | `/seguimiento` | Todo, más Mi empresa, Personal (con acceso) y Usuarios |
| `coordinador` | `LayoutPrincipal` | `/seguimiento` | Toda la operación, sin Personal (ABM), Usuarios ni la edición de Mi empresa |
| `empleado` | `LayoutEmpleado` | `/mis-tareas` | Mis tareas, Mis eventos (resumen de cada evento donde tiene tareas), Mi empresa (solo lectura) |

- El menú se arma desde **una sola definición** de opciones con los roles
  permitidos para cada una. No hay listas de menú repetidas por rol.
- Guardas en las rutas: si un rol entra a una ruta que no es suya, se lo
  redirige a su inicio. Es experiencia de usuario: la seguridad la pone la API.
- **No existe** pantalla de registro ni listado de empresas fuera del panel de
  superadmin.
- Si el login trae `debe_cambiar_password: true`, se muestra la pantalla de
  cambio de contraseña antes de cualquier otra.
- Si la API responde 403 de empresa suspendida, cerrar la sesión y mostrar el
  mensaje en el login.
- **Fase 11:**
  - Los cambios de un evento confirmado siempre se hacen desde un `Modal`
    con **motivo obligatorio** y una lista para tildar las tareas afectadas.
  - Lo que está "a revisar" se marca con un `Badge` o `Tag` naranja, igual en
    todas las pantallas, con la acción "Marcar como revisado" (pide una nota).
  - El historial de cambios del evento va en una pestaña "Cambios", con un
    `Timeline`.
  - Los indicadores son dos (`tareas X/Y` y `servicios X/Y`), más una `alerta`
    visible. No mostrar un porcentaje único de avance.
  - Los servicios cancelados se ven tachados o en gris, nunca desaparecen.
- El rol `empleado` nunca muestra importes: la API no los manda, y el front no
  tiene que dejar columnas vacías de montos.

## Ant Design

- `main.jsx`: `ConfigProvider` con `locale={esES}` (`antd/locale/es_ES`) y el
  `theme`, envolviendo `<App>` de antd. `dayjs.locale('es')`.
- **Notificaciones** con `App.useApp()` (`message`, `notification`, `modal`).
  No usar los métodos estáticos importados directo.
- **Layout general**: `Layout` con `Sider` y `Menu` lateral (Seguimiento, Mis
  tareas, Solicitudes, Eventos, Clientes, Catálogos, Personal, Empresas),
  `Header` con usuario, empresa, rol y cerrar sesión, y `Content` con `<Outlet />`.
- **Fechas**: se muestran como `DD/MM/YYYY` y se mandan a la API como `YYYY-MM-DD`.
- **Montos**: en ARS, formateados con `Intl.NumberFormat('es-AR')`.

Qué componente usar en cada caso:

| Necesidad | Componente |
| --- | --- |
| Listados | `Table` con `rowKey`, `loading`, columnas ordenables y filtros |
| Formularios | `Form` con `rules` (no validación manual) |
| Alta y edición dentro de un listado | `Modal` o `Drawer` con `Form`, siempre el mismo patrón |
| Confirmar | `Popconfirm` o `modal.confirm`, nunca `window.confirm` |
| Estados | `Tag` a través de `componentes/EstadoTag.jsx`, con colores definidos en un solo lugar (`utils/estados.js`) |
| Detalle | `Descriptions` y `Tabs` (el evento usa Resumen / Servicios / Tareas / Cierre) |
| Montos | `InputNumber` con formato `$` |
| Fechas | `DatePicker` y `RangePicker` |
| Secuencia de tareas | `Steps` |
| Indicadores | `Card` y `Statistic`; `Progress` para avance |
| Vacíos y errores | `Empty`, `Result`, `Alert` y `Spin` |

- **CSS**: un `.css` por componente, solo para el layout propio. No pisar
  estilos internos de antd. Los colores van por el `theme`.

## Verificación al terminar cada fase

- `npm run build` y `npm run lint` pasan sin errores.
- No quedan `window.confirm`, `alert` ni llamadas con `axios` directo.
- Cada pantalla nueva se probó contra la API real con un usuario del seed, si el
  endpoint ya existe. Si no existe, avisar qué falta probar.
- El README de `front-eventos` está actualizado (pantallas y estructura).
