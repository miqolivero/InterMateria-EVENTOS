# ROADMAP · Sistema de Gestión de Eventos

Plan completo del proyecto, dividido entre los dos integrantes:

| Parte | Responsable | Carpeta |
| --- | --- | --- |
| **Backend** (API, base de datos, contrato) | **Miqueas** | `api-eventos/`, `docs/API.md` |
| **Frontend** (pantallas con Ant Design) | **Compañero** | `front-eventos/` |

El contexto, el modelo de datos y las reglas de negocio están en `CLAUDE.md`.
Las convenciones de cada parte están en `api-eventos/CLAUDE.md` y en
`front-eventos/CLAUDE.md`.

---

## Cómo trabajamos en paralelo

```
         Fase N                                Fase N+1
Back  ── [contrato N] ── [implementa N] ─┬─ [contrato N+1] ── [implementa N+1] ──
                │                         │        │
Front ──────────┴── [pantallas N contra contrato] ─┴─ [prueba N con API real] ── [pantallas N+1] ──
```

1. **Contrato primero.** Al empezar cada fase, el back escribe su sección en
   `docs/API.md` (endpoints, body y respuesta de ejemplo, errores) y la sube en
   un PR chico. Es lo primero que se mergea.
2. Con el contrato en `main`, el **front arma las pantallas** mientras el back
   implementa.
3. Cuando el back mergea la implementación, el front **prueba contra la API
   real** y corrige lo que haga falta.
4. Mientras el front termina la fase N, el back ya puede escribir el contrato de
   la N+1.

**Reglas del equipo:**

- Cada uno toca **solo su carpeta**. `docs/API.md` lo modifica solo el back. Si
  el front necesita un cambio, lo pide por un issue o en el PR.
- Ramas `back/fase-N` y `front/fase-N`. Se mergea a `main` por Pull Request y
  **el otro lo revisa**. Así los dos conocen todo el sistema para la defensa.
- Un endpoint que ya está en el contrato **no se cambia sin avisar**.
- Si cambia el modelo de datos, se actualiza el DER y los dos están de acuerdo.

---

## Mapa de fases

| # | Fase | Back (Miqueas) | Front (Compañero) |
| --- | --- | --- | --- |
| 0 | Puesta en marcha | Archivos de documentación, ramas, base local | Igual, más instalar antd |
| 1 | Base de datos y multitenant | Esquema completo, usuarios en BD, token con empresa | Layout con Ant Design y migrar las pantallas existentes |
| 2 | Catálogos | ABM de clientes, tipos de evento, servicios, proveedores y empleados | Pantallas de catálogos |
| 3 | Solicitudes | ABM con filtros y cambios de estado | Listado, formulario y detalle |
| 4 | Presupuestos y versiones | Detalle, totales, versiones, presentar y rechazar | Editor de presupuesto y versiones |
| 5 | Confirmación del evento | Aceptar con transacción y CRUD de eventos | Modal de aceptación, listado, calendario y detalle |
| 6 | Servicios del evento y tareas | Estados de proveedor, tareas con secuencia, "mis tareas" | Pestañas Servicios y Tareas, "Mis tareas" |
| 7 | Seguimiento general | Consultas agregadas del tablero | Tablero de inicio |
| 8 | Cierre y feedback | Cierre, cancelación y feedback | Pestaña Cierre |
| 9 | Pulido y entrega | Revisión, seed de demo, docs de decisiones | Revisión, guion de demo |

**Primera demo:** fases 1 a 5, que cubren solicitud → presupuesto → evento.

---

## Fase 0 · Puesta en marcha (los dos)

- [ ] Copiar al repo `CLAUDE.md`, `ROADMAP.md`, `api-eventos/CLAUDE.md`,
      `front-eventos/CLAUDE.md` y `docs/API.md`. Commit en `main`.
- [ ] Cada uno levanta PostgreSQL y el proyecto en su máquina.
- [ ] Acordar cómo se avisan cuando hay un contrato nuevo (por ejemplo, un
      mensaje cuando se mergea el PR del contrato).
- [ ] Revisar las decisiones del modelo en `CLAUDE.md` (proveedores, servicios
      y tipos de evento por empresa; "vencida" calculada; `tipos_tarea`) y
      actualizar el DER si hace falta.

---

## Fase 1 · Base de datos y multitenant

**Objetivo:** base completa con datos de prueba, cada usuario atado a una
empresa y la interfaz base con Ant Design.

### Backend · Miqueas

> ⚠️ Hoy los usuarios están en memoria porque así lo pedía la guía de la
> materia. Esta fase los pasa a una tabla, porque el sistema multitenant
> necesita saber de qué empresa es cada usuario. Si la cátedra exige
> mantenerlos en memoria, alcanza con agregar `id_empresa` al array y al token.

- **Contrato:** actualizar en `docs/API.md` las secciones de auth y empresas.
  El registro recibe `id_empresa`; el login devuelve `usuario` con
  `id_empresa` y `nombre_empresa`.
- `database/schema.sql`: **todas** las tablas de `CLAUDE.md`, con PK, FK,
  UNIQUE, CHECK de estados, NOT NULL e índices sobre las FK que se usan para
  filtrar. Incluye `usuarios` y `tipos_tarea`.
- `database/seed.sql`:
  - las 3 empresas actuales y los 4 `tipos_tarea` en orden;
  - para la empresa 1, un set coherente: tipos de evento, servicios,
    proveedores con lo que ofrecen, empleados, clientes, una solicitud
    pendiente, otra aceptada con 2 versiones de presupuesto, y un evento en
    preparación con servicios en distintos estados y tareas (alguna vencida y
    una interna sin proveedor);
  - pocos datos propios para la empresa 2, para probar el aislamiento;
  - un admin y un usuario común por empresa, con password hasheada.
- Borrar `database/empresas.sql` y `src/data/usuarios.js`.
- Pasar `auth.controller.js` a la tabla `usuarios`. El registro valida que la
  empresa exista y esté activa. El token lleva `id`, `email`, `rol` e
  `id_empresa`.
- Empresas: el GET sigue público (lo usa el registro). Crear, editar y eliminar
  quedan solo para `admin`.

**Listo cuando:**

- [ ] Los scripts corren de cero en una base vacía.
- [ ] El payload del token tiene `id_empresa`.
- [ ] Un usuario común recibe 403 al crear una empresa.
- [ ] El README lista los usuarios y las contraseñas de prueba.

### Frontend · Compañero

- Instalar `antd@6` y `@ant-design/icons@6`. Configurar `ConfigProvider` con
  locale `es_ES` y `theme`, envolver en `<App>`, y `dayjs` en español.
- `LayoutPrincipal` con `Sider` + `Menu`, `Header` (usuario, empresa, rol, cerrar
  sesión) y `Content` con `<Outlet />`. Las secciones que no existen todavía
  muestran un `Result` de "En construcción".
- Login y Registro con `Form` de antd. El registro elige la empresa con un `Select`.
- Empresas: `Table`, `Popconfirm` para eliminar y `EmpresaForm` con `Form`.
- `utils/estados.js` + `componentes/EstadoTag.jsx`, y `utils/formato.js` (moneda
  y fecha).

**Listo cuando:**

- [ ] Todo lo que andaba antes sigue andando con la nueva interfaz.
- [ ] No queda ningún `window.confirm`.
- [ ] `build` y `lint` pasan.

---

## Fase 2 · Catálogos

**Objetivo:** ABM de los datos maestros que usan todas las fases siguientes.

### Backend · Miqueas

- **Contrato** de todos los endpoints de la fase.
- `/api/clientes`, `/api/tipos-eventos`, `/api/servicios`, `/api/proveedores`,
  `/api/empleados`: GET (listado y por id), POST, PUT y baja lógica con
  `PATCH /:id/activo`.
- Listados con filtros `?activo=true|false` y `?buscar=texto` (ILIKE sobre los
  campos de texto principales).
- `GET/PUT /api/proveedores/:id/servicios`: el PUT reemplaza la lista de
  servicios ofrecidos en una transacción.
- Empleados: al crear uno se asocia a la empresa del usuario en
  `empleados_x_empresa` (con cargo y fecha de inicio). La baja cierra `fecha_fin`.
- Proponer un helper común para responder los errores de `pg` antes de repetir
  el mismo código cinco veces.

**Listo cuando:**

- [ ] Pedir un id de otra empresa devuelve 404 (probado con curl).
- [ ] Desactivar no borra el registro.
- [ ] Las validaciones obligatorias responden 400.

### Frontend · Compañero

- Secciones Clientes y Personal, y una sección Catálogos con `Tabs` (Tipos de
  evento, Servicios, Proveedores).
- Cada listado con `Table`, `Input.Search`, filtro de activos y acciones.
- Alta y edición en `Modal` o `Drawer` con `Form`, con el mismo patrón en todas.
- Proveedores: los servicios que ofrece se eligen con `Select mode="multiple"`.

**Listo cuando:**

- [ ] Las 5 entidades tienen ABM completo contra la API real.
- [ ] Los mensajes de error de la API se muestran en pantalla.

---

## Fase 3 · Solicitudes

**Objetivo:** registrar y consultar los pedidos de los clientes.

### Backend · Miqueas

- **Contrato.**
- `GET /api/solicitudes` con filtros `?estado=`, `?id_cliente=` y
  `?desde=&hasta=` (sobre `fecha_evento_prevista`). Cada fila trae el nombre del
  cliente y el tipo de evento.
- `GET /api/solicitudes/:id`: cliente, tipo de evento y las cabeceras de sus
  presupuestos (versión, fecha, total, estado).
- POST y PUT:
  - `id_cliente` e `id_tipo_evento` tienen que ser de la empresa y estar activos;
  - `cantidad_asistentes > 0`;
  - no se aceptan fechas pasadas;
  - una solicitud `aceptada` no se edita (409).
- `PATCH /api/solicitudes/:id/estado`: solo pasa a `cancelada` o `rechazada`
  desde `pendiente` o `presupuestada`.

**Listo cuando:**

- [ ] No se puede usar un cliente de otra empresa ni uno inactivo.
- [ ] Los cambios de estado no permitidos responden 409.

### Frontend · Compañero

- Listado con filtros (`Select` de estado, `RangePicker`, buscador) y `EstadoTag`.
- Formulario:
  - `Select` de cliente con búsqueda y un botón "crear cliente rápido";
  - `DatePicker` sin fechas pasadas;
  - `InputNumber` para la cantidad de asistentes y `TextArea` para las preferencias.
- Detalle con `Descriptions` y la lista de presupuestos (en solo lectura hasta la fase 4).

---

## Fase 4 · Presupuestos y versiones

**Objetivo:** armar, versionar, presentar y rechazar presupuestos (reglas 2 y 3).

### Backend · Miqueas

- **Contrato.**
- `POST /api/solicitudes/:id/presupuestos`: crea la versión 1 en `borrador`. Si
  la solicitud ya tiene versiones, 409.
- `GET /api/presupuestos/:id`: cabecera + detalle con los nombres de servicio y
  proveedor, el margen por renglón y los totales (costo, importe, margen).
- `POST/PUT/DELETE /api/presupuestos/:id/detalle[/:idDetalle]`:
  - solo en `borrador` (si no, 409);
  - el servicio tiene que ser de la empresa;
  - el proveedor, si viene, tiene que ofrecer ese servicio;
  - se recalcula `importe_total` en la misma transacción.
- `PATCH /:id/presentar`: de `borrador` a `presentado`. La solicitud pasa a
  `presupuestada`. Sin renglones, responde 400.
- `POST /:id/nueva-version`: solo desde `presentado`. Copia el detalle a una
  versión nueva y la anterior pasa a `reemplazado`. Todo en una transacción.
- `PATCH /:id/rechazar`: de `presentado` a `rechazado`.

**Listo cuando:**

- [ ] El total coincide siempre con el detalle, aunque se edite desde curl.
- [ ] No se puede editar un presupuesto presentado.
- [ ] No se puede asignar un proveedor que no ofrece ese servicio.

### Frontend · Compañero

- Botones "Nuevo presupuesto" y "Nueva versión" desde la solicitud.
- Pantalla del presupuesto:
  - cabecera con `Descriptions`;
  - `Table` del detalle con `Table.Summary` para los totales;
  - `Modal` para agregar o editar un renglón, con el `Select` de proveedor
    filtrado por servicio;
  - botones según el estado y solo lectura cuando no es `borrador`;
  - `Timeline` o selector para recorrer las versiones.

---

## Fase 5 · Confirmación del evento

**Objetivo:** aceptar un presupuesto y generar el evento (regla 4).

### Backend · Miqueas

- **Contrato.**
- `POST /api/presupuestos/:id/aceptar` con `{ fecha_evento_confirmada,
  sede_acordada, condiciones_acordadas, id_empleado_coordinador }`:
  - solo desde `presentado`;
  - el coordinador tiene que ser un empleado activo de la empresa;
  - aplica la regla 4 completa en una transacción;
  - devuelve el evento creado.
- `GET /api/eventos` con filtros `?estado=`, `?desde=&hasta=` y
  `?id_coordinador=`. `GET /api/eventos/:id` con la solicitud, el cliente y el
  presupuesto aceptado.
- `PUT /api/eventos/:id`: fecha, sede, condiciones y coordinador, solo con el
  evento abierto. `PATCH /:id/iniciar-preparacion`.
- `GET /api/eventos/:id/servicios`: lista de `servicios_x_evento`.

**Listo cuando:**

- [ ] Los 5 cambios de la regla 4 quedan consistentes. Si algo falla en el
      medio, no queda nada a medias (probar forzando un error).
- [ ] Una solicitud no puede generar dos eventos.

### Frontend · Compañero

- Botón "Aceptar y confirmar evento" en el presupuesto presentado: abre un
  `Modal` con `Form` y, al confirmar, navega al evento.
- Sección Eventos con `Table`, filtros y una pestaña de `Calendar` mensual.
- Detalle del evento con `Tabs`: Resumen y Servicios (solo lectura). Las
  pestañas Tareas y Cierre aparecen deshabilitadas.

---

## Fase 6 · Servicios del evento y tareas

**Objetivo:** el subsistema principal del relevamiento (reglas 1, 5, 6, 7 y 9).

### Backend · Miqueas

- **Contrato.**
- `PATCH /api/servicios-evento/:id`: estado del proveedor (si pasa a
  `confirmada`, guarda la fecha), proveedor, costos y observaciones.
- `POST /api/servicios-evento/:id/generar-tareas` con
  `{ id_empleado_responsable, fechas: [f1, f2, f3, f4] }`: crea las 4 tareas de
  `tipos_tarea` en una transacción. Si ya existen, 409.
- `GET /api/eventos/:id/tareas`: cada tarea con responsable, servicio,
  proveedor, tipo, orden y `vencida`.
- `POST /api/eventos/:id/tareas`: tarea libre, sin tipo.
- `PUT /api/tareas/:id` y `PATCH /api/tareas/:id/estado`, aplicando las reglas
  5 y 7. Si se rompe la secuencia, 409 con un mensaje claro.
- `GET /api/tareas/mias`: tareas del empleado vinculado al usuario logueado.

**Listo cuando:**

- [ ] No se puede completar el paso 2 sin el paso 1.
- [ ] Completar "Confirmar asistencia" **no** cambia el estado del proveedor.
- [ ] "Vencida" se calcula sin guardarse.

### Frontend · Compañero

- Pestaña Servicios: el estado del proveedor se edita con un `Select` y hay un
  botón "Generar tareas" (`Modal` con responsable y 4 fechas).
- Pestaña Tareas: agrupadas por servicio, con `Steps` para la secuencia, tareas
  libres aparte, `Tag` rojo "Vencida" y cambio de estado que muestra el mensaje
  de la API si responde 409.
- Sección "Mis tareas".

---

## Fase 7 · Seguimiento general

**Objetivo:** el tablero que resuelve el problema principal del cliente: qué
falta resolver con varios eventos en paralelo.

### Backend · Miqueas

- **Contrato.**
- `GET /api/seguimiento/resumen`: cantidades de eventos próximos (30 días),
  tareas vencidas, tareas pendientes, servicios sin confirmar y solicitudes
  pendientes.
- `GET /api/seguimiento/proximos-eventos?dias=30`: por evento, % de tareas
  completadas, cantidad de vencidas y de servicios sin confirmar.
- `GET /api/seguimiento/tareas-vencidas` y
  `GET /api/seguimiento/servicios-sin-confirmar`.
- Con consultas agregadas en SQL (`COUNT`, `FILTER`, `GROUP BY`), sin calcular
  en JavaScript.

**Listo cuando:**

- [ ] Los números coinciden con el seed (verificados a mano).

### Frontend · Compañero

- Pantalla de inicio después del login:
  - fila de `Card` + `Statistic`;
  - `Table` de próximos eventos con `Progress` y alertas;
  - listas de tareas vencidas y de servicios sin confirmar, con link al evento;
  - `Segmented` para elegir 7, 15 o 30 días.

---

## Fase 8 · Cierre y feedback

**Objetivo:** registrar el resultado del evento y la opinión del cliente (regla 8).

### Backend · Miqueas

- **Contrato.**
- `PATCH /api/eventos/:id/cerrar` con
  `{ estado: 'realizado' | 'cancelado', observaciones_cierre }`:
  - si se cancela, las observaciones son obligatorias;
  - al cancelar, la solicitud también pasa a `cancelada` (en una transacción).
- `PATCH /api/eventos/:id/feedback`: solo si el evento está `realizado`.
- Con el evento cerrado, cualquier cambio en el evento, sus servicios o sus
  tareas responde 409.

**Listo cuando:**

- [ ] No se puede cancelar sin observaciones ni cargar feedback en un evento
      cancelado.

### Frontend · Compañero

- Pestaña Cierre:
  - con el evento abierto, `Form` con `Radio` y `TextArea`, más un `Alert` si
    quedan tareas o servicios pendientes;
  - con el evento cerrado, `Result` con el estado y bloque de feedback.
- Con el evento cerrado, el resto de las pestañas queda en solo lectura.

---

## Fase 9 · Pulido y entrega (los dos)

### Backend · Miqueas

- Revisar todo el código contra `api-eventos/CLAUDE.md` (filtros por empresa,
  códigos HTTP, transacciones) y corregir lo que no cumpla.
- Seed de demo: 2 empresas y unos 6 eventos en distintos estados, con fechas
  relativas a `CURRENT_DATE` para que siempre haya eventos próximos y tareas
  vencidas.
- `docs/DECISIONES.md`: multitenant, versiones de presupuesto, costo vs.
  importe, secuencia de tareas, "vencida" calculada y baja lógica.
- `docs/API.md` completo y coincidente con la implementación.

### Frontend · Compañero

- Revisar contra `front-eventos/CLAUDE.md`.
- Unificar los textos, los mensajes de error y los estados vacíos.
- `docs/DEMO.md`: guion de 10 minutos que recorre el circuito completo y
  muestra la diferencia entre tarea completada y proveedor confirmado.

### Los dos

- [ ] Clonar el repo de cero y seguir el README alcanza para levantar todo.
- [ ] Ensayar la demo juntos.
- [ ] Cada uno puede explicar las pantallas y endpoints principales del otro.

---

## Checklist de cada PR

- [ ] La rama corresponde a la fase (`back/fase-N` o `front/fase-N`).
- [ ] Se probó al menos un caso de error (otra empresa, estado inválido, datos faltantes).
- [ ] Back: las respuestas coinciden con `docs/API.md`. Front: `build` y `lint` pasan.
- [ ] El README de la carpeta está actualizado.
- [ ] El otro integrante revisó y aprobó el PR.
