# Frontend · Sistema de Eventos

React 19, Vite 8, React Router, axios y Ant Design 6. Interfaz en español, con
estilo simple, menú adaptable a móvil y transiciones cortas.

## Ejecutar con la API del equipo

Para una copia nueva, seguir primero la [guía de instalación](../docs/INSTALACION.md).
Ejecutar los comandos de este README desde `front-eventos`.

Requiere Node compatible con Vite 8: 20.19+ o 22.12+. Copiar `.env.example` a
`.env` y configurar:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

```bash
npm ci
npm run dev
```

Abrir `http://localhost:5173`. El puerto es fijo para coincidir con el CORS de la
API. Preparar PostgreSQL e iniciar la API según la guía antes de usar el
frontend real. Compilar la interfaz no crea tablas ni usuarios.

## Pantallas por rol (Fases 10 y 11)

Según `usuario.rol` del login hay tres layouts. El menú y las guardas de las
rutas salen de una sola definición, `src/utils/menu.jsx`: si un rol entra a una
ruta que no es suya, vuelve a su inicio. Es experiencia de usuario: los
permisos los aplica la API.

| Rol | Layout | Inicio | Pantallas |
| --- | --- | --- | --- |
| `superadmin` | `LayoutSuperadmin` | `/superadmin` | Resumen (métricas), Empresas (`/superadmin/empresas`: tabla con métricas, búsqueda, filtro, suspender y alta en dos pasos) y detalle (`/superadmin/empresas/:id`: datos, métricas y soporte de usuarios) |
| `admin` | `LayoutPrincipal` | `/seguimiento` | Toda la operación, más Personal (con acceso), Usuarios y Mi empresa editable |
| `coordinador` | `LayoutPrincipal` | `/seguimiento` | Toda la operación y Mi empresa en solo lectura |
| `empleado` | `LayoutEmpleado` | `/mis-tareas` | Mis tareas (su panel para el celular), Mis eventos (el contexto completo, sin importes) y Mi empresa en solo lectura |

| Ruta | Funcionalidad |
| --- | --- |
| `/login` | Acceso. No hay registro: las cuentas las crea el superadmin o el admin de la empresa |
| `/cambiar-password` | Obligatoria si `debe_cambiar_password`; también desde el menú del usuario |
| `/clientes` | Alta, edición, búsqueda y activación/desactivación de clientes |
| `/catalogos` | Tipos de evento, servicios y proveedores; servicios ofrecidos por proveedor |
| `/personal` | (admin) Empleados con la columna Acceso; alta con "Darle acceso al sistema" y "Dar acceso" |
| `/usuarios` | (admin) Filtro por rol, alta, edición, activar/desactivar y reset de contraseña |
| `/mi-empresa` | Datos de la empresa; el admin los edita, el CUIT queda en solo lectura |
| `/solicitudes`, `/solicitudes/:id` | Listado, nueva solicitud, datos, presupuestos y acciones según estado |
| `/presupuestos/:id` | Cabecera, detalle, totales, versiones, presentación, rechazo y aceptación |
| `/eventos`, `/eventos/:id` | Listado con calendario; resumen con indicadores, servicios, tareas, "A revisar", historial, cierre y feedback. "Cambiar lo acordado" pide motivo |
| `/eventos-por-estado` | (admin y coordinador) Solicitudes que esperan respuesta y eventos, con una pestaña por situación y el conteo; rechazadas y canceladas siguen a la vista |
| `/mis-tareas` | Admin y coordinador: tabla de sus tareas. Empleado: tarjetas por evento, vencidas arriba, filtro, pasos como referencia, "A revisar", avanzar estado y gestión del proveedor (sin importes) |
| `/mis-eventos`, `/mis-eventos/:id` | (empleado) Los eventos donde tiene tareas y su resumen: indicadores, lo que tiene que revisar, servicios sin importes, las tareas de todo el equipo y los últimos cambios |
| `/seguimiento` | Indicadores (con "A revisar"), próximos eventos con tareas X de Y, servicios X de Y y alerta, vencidas y servicios sin confirmar |
| Otras rutas | Con sesión muestra la página 404; sin sesión redirige al login |

Si la API responde 403 con `codigo: "empresa_suspendida"`, el front cierra la
sesión y el login muestra el motivo. El resto de los 403 y los 409 se muestran
con el `mensaje` de la API, sin cerrar nada.

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
- **Fase 11, sin secuencia:** en "Pasos" se eligen los pasos que hacen falta,
  cada uno con su fecha y en cualquier orden; solo se ofrecen los que todavía no
  tienen tarea. Cualquier tarea pasa a cualquier estado. Los pasos se muestran
  como referencia, sin bloquear nada. Las tareas internas pueden no tener servicio.
- **Cambios de lo acordado con motivo:** cambiar fecha, sede, asistentes o
  condiciones, agregar, modificar o cancelar un servicio y cambiar el proveedor
  usan el mismo `ModalCambio`: motivo obligatorio y una lista para tildar las
  tareas afectadas. El estado del proveedor es seguimiento y se cambia sin
  motivo. Cambiar solo el coordinador no pide motivo.
- **A revisar:** etiqueta naranja en servicios y tareas, pestaña con contador en
  el evento, tarjeta en el tablero y en el panel del empleado. "Marcar como
  revisado" pide una nota y no cambia nada más.
- Un servicio cancelado se ve en gris y sin acciones; no se borra.
- Un evento cerrado muestra servicios y tareas en solo lectura. Solo un evento
  realizado permite actualizar feedback y observaciones. Cancelar exige motivo
  y el cierre requiere confirmación explícita.
- Vencidas, indicadores, alerta y totales se muestran según los datos del backend
  (no se recalculan en el front). El
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
payloads del contrato (incluidos los cambios con motivo y las revisiones de la
Fase 11), formatos y campos permitidos. No
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

El backend completo ya está integrado en `main`; ver `INTEGRACION-BACKEND.md`
para las verificaciones realizadas y las pruebas de integración pendientes.
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
  contrato.test.js          Rutas y payloads del contrato
  sesion.test.js            Token, sesión, errores y formatos
  permisos.test.js          Control de acceso con los componentes reales
  vista-contrato.mjs        Vista manual aislada, ficticia y sin escrituras
```
