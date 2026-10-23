# CLAUDE.md · Sistema de Gestión de Eventos (raíz)

Este archivo lo lee Claude Code en cada sesión. Tiene lo que **comparten** el
backend y el frontend: el proyecto, el modelo de datos, las reglas de negocio y
la forma de trabajar en equipo.

Las convenciones específicas de cada parte están en:

- `api-eventos/CLAUDE.md`: backend.
- `front-eventos/CLAUDE.md`: frontend con Ant Design.

El plan de trabajo está en `ROADMAP.md` y el contrato de la API en `docs/API.md`.

## Qué es el proyecto

Proyecto intermateria de la Tecnicatura en Analista en Sistemas (Instituto
Leibnitz). Es un sistema para **organizadoras de eventos en salones**: registran
las solicitudes de sus clientes, arman presupuestos con versiones, confirman el
evento, coordinan proveedores y tareas del personal, hacen el seguimiento y
cierran el evento con observaciones y feedback.

Lo que más remarcó el cliente en el relevamiento:

- La **tarea interna** y el **compromiso del proveedor** son cosas distintas. La
  tarea "contactar al proveedor" puede estar completada mientras el proveedor
  todavía no confirmó. Por eso tienen estados separados.
- Con varios eventos en paralelo, necesitan ver rápido **qué falta resolver**:
  tareas pendientes o vencidas y servicios sin confirmar.
- El importe que **informa el proveedor** y el que **se le cobra al cliente** son
  distintos. No hay fórmula de tarifas: los dos se cargan a mano.

Es un proyecto académico: el equipo tiene que poder **explicar y defender** cada
decisión. Se prefiere código claro antes que código ingenioso.

## Arquitectura

El sistema es **multitenant**: lo usan varias empresas organizadoras y cada una
ve solo sus propios datos. Hay **tres niveles de acceso** (ver la sección
"Niveles de acceso").

```
InterMateria-EVENTOS/
├── api-eventos/     Node + Express + PostgreSQL (pg, sin ORM) · puerto 3000
├── front-eventos/   React 19 + Vite + React Router 7 + axios + Ant Design 6 · puerto 5173
└── docs/API.md      contrato entre los dos
```

## Trabajo en equipo

Somos dos personas: una a cargo del **backend** y otra del **frontend**.

- **Cada uno toca solo su carpeta.** Si la sesión es de backend, no se modifica
  nada en `front-eventos/`, y al revés.
- **`docs/API.md` es el contrato** y ya está escrito para todas las fases. El
  backend lo implementa tal cual y el frontend construye contra él. Solo lo
  modifica el backend; si el frontend necesita un cambio, lo pide. Cada cambio
  se anota en el "Historial de cambios" al final del archivo.
- **No cambiar un endpoint que ya está en el contrato** sin avisar al otro: le
  rompe las pantallas.
- **Archivos compartidos** (`CLAUDE.md` de la raíz, `ROADMAP.md`, el DER): se
  cambian solo si están de acuerdo los dos.
- **Ramas**: una por persona, `backend` y `frontend`, donde se suben todos los
  avances. Al terminar cada fase (los dos lados probados juntos) se mergea a
  `main` con Pull Request, y el otro integrante lo revisa. Lo del otro se trae
  desde `main` (`git merge origin/main`).

## Modelo de datos

La PK de cada tabla es `id_<entidad>` (como `id_empresa`). Los estados son
`VARCHAR` con `CHECK` y una lista cerrada. El script completo está en
`api-eventos/database/schema.sql` y los datos de prueba en `seed.sql`.
**Si esta tabla y `schema.sql` no coinciden, manda `schema.sql`**: acá van
solo los campos clave.

| Tabla | Para qué | Campos clave |
| --- | --- | --- |
| `empresas` | Organizadora (tenant) | `nombre`, `cuit` UNIQUE, contacto, `activo` |
| `usuarios` | Login | `email` UNIQUE, `password` (hash), `rol` (`superadmin`/`admin`/`coordinador`/`empleado`), `id_empresa` (NULL solo para superadmin), `id_empleado` único (obligatorio para `empleado`), `debe_cambiar_password`, `activo` |
| `clientes` | Quien encarga el evento | `id_empresa` NOT NULL, `nombre`, `apellido`, `dni_cuit`, `direccion`, contacto, `activo`, `fecha_alta` |
| `tipos_eventos` | Cumpleaños, egresados... | `id_empresa`, `nombre`, `activo` |
| `empleados` | Personal | `legajo`, `nombre`, `apellido`, `rol`, contacto |
| `empleados_x_empresa` | Empleado ↔ empresa (N:M con historial) | `cargo`, `fecha_inicio`, `fecha_fin`, `activo` |
| `servicios` | Catálogo (catering, decoración...) | `id_empresa`, `nombre`, `descripcion`, `activo` |
| `proveedores` | Quien presta servicios | `id_empresa`, `razon_social`, contacto, `observaciones`, `activo` |
| `proveedores_x_servicio` | Lo que cada proveedor **ofrece** | UNIQUE (`id_proveedor`, `id_servicio`) |
| `solicitudes` | Pedido inicial del cliente | `id_cliente`, `id_tipo_evento`, `fecha_evento_prevista`, `cantidad_asistentes`, `sede_prevista`, `preferencias`, `estado` |
| `presupuestos` | Versiones de la propuesta | `id_solicitud`, `numero_version`, `importe_total`, `estado` · UNIQUE (`id_solicitud`, `numero_version`) |
| `detalle_presupuesto` | Renglones de la propuesta | `id_servicio`, `id_proveedor` NULL, `costo_proveedor`, `importe_cliente` |
| `eventos` | Se crea al aceptar un presupuesto | `id_solicitud` UNIQUE, `id_presupuesto_aceptado` UNIQUE, `id_empleado_coordinador`, `fecha_evento_confirmada`, `sede_acordada`, `condiciones_acordadas`, `estado`, `observaciones_cierre`, `feedback_cliente` |
| `servicios_x_evento` | Lo **acordado** y el estado de cada proveedor | `id_servicio`, `id_proveedor` NULL, `costo_acordado_proveedor`, `importe_acordado_cliente`, `estado_proveedor`, `fecha_confirmacion_proveedor` |
| `tipos_tarea` | Los 4 pasos secuenciales con un proveedor | `nombre`, `orden` UNIQUE. Fija del sistema, se carga en el seed |
| `tareas` | Trabajo del personal | `id_evento`, `id_empleado_responsable`, `id_servicio_x_evento` NULL, `id_tipo_tarea` NULL, `descripcion`, `fecha_prevista`, `fecha_finalizacion`, `estado_tarea` |

Estados válidos:

- `solicitudes.estado`: `pendiente` → `presupuestada` → `aceptada` / `rechazada` / `cancelada`
- `presupuestos.estado`: `borrador` → `presentado` → `aceptado` / `rechazado` / `reemplazado`
- `eventos.estado`: `confirmado` → `en_preparacion` → `realizado` / `cancelado`
- `servicios_x_evento.estado_proveedor`: `solicitada` → `confirmada` → `en_seguimiento` → `finalizada` (o `rechazada`)
- `tareas.estado_tarea`: `pendiente` → `en_curso` → `completada`

## Niveles de acceso

| Rol | Quién es | `id_empresa` | Qué puede hacer |
| --- | --- | --- | --- |
| `superadmin` | Los dueños del sistema | `NULL` | Panel de superadmin: alta, edición y suspensión de empresas, soporte de sus usuarios y métricas. **No ve datos operativos** de ninguna empresa (clientes, solicitudes, eventos, tareas) |
| `admin` | El dueño de la empresa | su empresa | Todo lo de su empresa, más "Mi empresa", el alta de empleados con su acceso y la gestión de usuarios |
| `coordinador` | Quien organiza los eventos | su empresa | Toda la operación: solicitudes, presupuestos, eventos completos, todas las tareas, seguimiento y catálogos |
| `empleado` | Personal que ejecuta tareas | su empresa | Solo **sus tareas** y los datos básicos del evento. Cambia el estado de sus tareas y gestiona al proveedor de esas tareas (estado y observaciones). **No ve importes** |

La tabla de **permisos por ruta** está en la sección "Fase 10" de `docs/API.md`.

- **Una empresa no puede saber que existen otras.** No hay listados públicos de
  empresas ni registro público.
- **Las cuentas las crea alguien de arriba:** el superadmin crea la empresa con
  su `admin`, y el `admin` da de alta a sus empleados en "Personal" con el rol
  que corresponda. Quien recibe una contraseña puesta por otro tiene que
  cambiarla en su primer ingreso (`debe_cambiar_password`).
- **Empresa suspendida** (`activo = false`): sus usuarios no entran, y los
  tokens que ya tenían dejan de servir.
- **El superadmin solo ve métricas** (cantidades). Es una decisión de
  privacidad: los datos de los clientes de cada empresa son de esa empresa,
  no nuestros.

## Reglas de negocio

1. **"Vencida" no se guarda.** Una tarea está vencida si
   `fecha_prevista < CURRENT_DATE` y `estado_tarea <> 'completada'`. La API lo
   devuelve como campo calculado: `vencida: true/false`.
2. **Importe total** del presupuesto = suma de `importe_cliente` del detalle. Lo
   recalcula la API; nunca se acepta desde el body.
3. **Solo se edita un presupuesto en `borrador`.** Para cambiarlo después de
   presentado se crea una **nueva versión**: copia el detalle, toma
   `numero_version` + 1 y la versión anterior pasa a `reemplazado`.
4. **Aceptar un presupuesto** se hace en una sola transacción:
   - el presupuesto pasa a `aceptado`;
   - las otras versiones abiertas de la misma solicitud pasan a `reemplazado`;
   - la solicitud pasa a `aceptada`;
   - se crea el `evento`;
   - cada renglón del detalle se copia a `servicios_x_evento` con estado `solicitada`.
5. **Secuencia de tareas con proveedor** (tabla `tipos_tarea`): una tarea de
   orden N no puede pasar a `en_curso` ni a `completada` si la de orden N−1 del
   mismo `servicio_x_evento` no está `completada`. Si pasa, la API responde **409**.
6. **Tarea completada ≠ proveedor confirmado.** Completar una tarea **no**
   cambia `estado_proveedor`. El estado del proveedor se actualiza por separado.
7. Al completar una tarea se guarda `fecha_finalizacion = CURRENT_DATE`. Si la
   tarea vuelve a `pendiente` o `en_curso`, ese campo se limpia.
8. **Cierre**: un evento pasa a `realizado` o `cancelado` solo desde
   `confirmado` o `en_preparacion`. Una vez cerrado no se edita, salvo
   `observaciones_cierre` y `feedback_cliente`.
9. **Multitenant**: los datos de una empresa no se ven ni se modifican desde
   otra. El responsable de una tarea y el coordinador de un evento tienen que ser
   empleados activos de la empresa del evento.
10. **Usuarios**: siempre queda al menos un `admin` activo por empresa. Un admin
    no puede desactivarse ni quitarse el rol a sí mismo. Un empleado tiene a lo
    sumo un usuario, y un usuario `empleado` siempre está vinculado a un
    empleado. Dar de baja a un empleado desactiva también su usuario.
11. **Alcance del rol `empleado`**: solo ve y cambia **sus** tareas (las de otro
    responden 404). Puede gestionar el proveedor de un servicio solo si es
    responsable de alguna tarea de ese servicio, y solo `estado_proveedor` y
    `observaciones`. Nunca recibe importes ni costos.

## Cómo trabajar en este repo

- **Una fase del ROADMAP por sesión.** No adelantar trabajo de otras fases.
- **Planificar antes de escribir**: listar los archivos que se van a crear o
  modificar y esperar el OK.
- **No agregar dependencias** fuera de las que nombra la fase sin preguntar.
- **Actualizar el README** de la carpeta que se tocó.
- **Al terminar, explicar en español** qué se hizo, en qué archivos y por qué,
  para que el equipo lo pueda defender. Señalar cualquier decisión que no
  estuviera definida acá.
- **No hacer commits ni push.** Los hace el equipo.
