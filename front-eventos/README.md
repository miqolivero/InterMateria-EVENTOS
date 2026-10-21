# Frontend · Sistema de Eventos

React 19, Vite 8, React Router, axios y Ant Design 6. Interfaz en español, con
estilo simple, menú adaptable a móvil y transiciones cortas. Este trabajo se
limita a `front-eventos/`; no modifica la base de datos ni el backend.

## Ejecutar con la API del equipo

Requiere Node compatible con Vite 8: 20.19+ o 22.12+. Copiar `.env.example` a
`.env` y configurar:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173`. El puerto es fijo para coincidir con el CORS de la
API. La configuración de backend y PostgreSQL la administra su responsable;
no ejecutar scripts SQL como paso para levantar este frontend.

## Pantallas

| Ruta | Funcionalidad |
| --- | --- |
| `/` | Listado público de empresas; con sesión redirige a Seguimiento |
| `/login`, `/registro` | Acceso y registro con selección de empresa |
| `/empresas` | Búsqueda, filtro de estado y administración por rol |
| `/empresas/nueva`, `/empresas/:id/editar` | Formularios solo para admin; edición del estado activo |
| `/clientes` | Alta, edición, búsqueda y activación/desactivación de clientes |
| `/catalogos` | Tipos de evento, servicios y proveedores; servicios ofrecidos por proveedor |
| `/personal` | Empleados, cargo, rol laboral y vínculo activo con la empresa |
| `/solicitudes` | Listado con filtros y nueva solicitud; creación rápida de cliente |
| `/solicitudes/:id` | Datos, presupuestos y acciones según estado |
| `/presupuestos/:id` | Cabecera, detalle, totales, versiones, presentación, rechazo y aceptación |
| `/eventos` | Listado con filtros y calendario mensual |
| `/eventos/:id` | Resumen, servicios, tareas, cierre y feedback |
| `/mis-tareas` | Tareas propias y cambio de estado con verificación de secuencia |
| `/seguimiento` | Indicadores, próximos eventos, vencidas y servicios sin confirmar |
| Otras rutas | Página 404 |

Salvo el inicio, acceso y registro, las pantallas requieren sesión. El backend
es quien aplica los permisos y el aislamiento por empresa. El frontend no envía
`id_empresa` en formularios de negocio; solo lo usa en el registro de cuenta.

## Reglas reflejadas en la interfaz

- La sesión se verifica al ingresar y recargar. Un 401 del login se muestra en
  el formulario; un 401 de una ruta protegida cierra la sesión. Los errores
  400/403/404/409 conservan los datos del formulario y muestran `mensaje`.
- Los listados de catálogos filtran por búsqueda y activos mediante los query
  params del contrato. No se borran clientes, proveedores, servicios o empleados:
  se cambia su estado con PATCH.
- Formularios en modal con un patrón compartido. Los servicios de un proveedor
  se guardan con su operación independiente, sin ocultar un posible guardado
  parcial de sus datos y servicios.
- Solicitudes editables solo en pendiente o presupuestada. Fechas de solicitud
  y evento sin días pasados; asistentes y cantidades enteros positivos.
- Los importes se cargan como totales por renglón. La cantidad no multiplica el
  precio. Los costos, importes y márgenes de resumen se toman de la API.
- Presupuestos editables solo en borrador; nueva versión solo desde la última
  presentada o rechazada y sin otra en borrador. No se presenta ni acepta sobre
  solicitudes cerradas. Aceptar permite un coordinador opcional y navega al evento.
- Proveedores filtrados por el servicio que ofrecen; no se asignan proveedores
  inactivos. El estado del proveedor no se deduce del estado de las tareas.
- Cuatro tareas por servicio, con responsable y fechas ordenadas. Se permite que
  dos pasos tengan la misma fecha. Las tareas internas pueden no tener servicio.
- La interfaz bloquea adelantar pasos y reabrir uno completado si el siguiente
  comenzó. La API sigue validando cada operación y sus posibles conflictos.
- En Mis tareas se carga la secuencia completa del evento antes de cambiar un
  estado, porque los pasos anteriores pueden estar asignados a otra persona.
- Un evento cerrado muestra servicios y tareas en solo lectura. Solo un evento
  realizado permite actualizar feedback y observaciones. Cancelar exige motivo
  y el cierre requiere confirmación explícita.
- Vencidas, porcentajes y totales se muestran según los datos del backend. El
  cierre avisa si hay pendientes, pero el usuario decide si cierra el evento.
- Fechas DD/MM/YYYY, moneda ARS y estados con etiquetas compartidas. Las
  animaciones respetan `prefers-reduced-motion`.

## Verificación

```bash
npm run build
npm run lint
npm test
```

Las pruebas verifican permisos, sesión, concurrencia entre sesiones, rutas y
payloads del contrato, formatos, campos permitidos y secuencia de tareas. No
escriben en PostgreSQL ni llaman a la API real.

Para revisar las pantallas sin depender de los datos o disponibilidad del backend:

```bash
node test/vista-contrato.mjs
```

Abrir `http://localhost:5175` e ingresar con `demo@example.com` / `prueba`.
La vista muestra un aviso de prueba y usa datos ficticios en memoria. Sus
escrituras están deshabilitadas con HTTP 501; sirve para revisar renderizado,
formularios, validación, errores y navegación, no para demostrar una integración
real o un guardado exitoso. La API ficticia usa exclusivamente 127.0.0.1:3305.
Detener con Ctrl+C. La compilación de esa vista se guarda en una carpeta
ignorada dentro de node_modules y no comparte caché con el servidor de 5173.

La revisión final contra la API real requiere la implementación de la rama
`backend` integrada o ejecutada por su responsable. Ver `INTEGRACION-BACKEND.md`.
El recorrido manual completo está en `DEMO.md`.

## Estructura

```text
src/
  App.jsx                   Rutas y pantallas con carga diferida
  main.jsx                  Tema, idioma, sesión y router
  componentes/              Layout, formularios, servicios/tareas/cierre del evento
  contexto/                 Sesión, consulta/reintento y acciones con bloqueo de envío
  paginas/                  Catálogos, solicitudes, presupuesto, eventos y seguimiento
  servicios/                Una instancia axios y operaciones del contrato
  utils/                    Formatos, campos permitidos, estados y reglas de interfaz
test/
  contrato.test.js          Rutas, payloads y secuencia de tareas
  sesion.test.js            Token, sesión, errores y formatos
  permisos.test.js          Control de acceso con los componentes reales
  vista-contrato.mjs        Vista manual aislada, ficticia y sin escrituras
```
