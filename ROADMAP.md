# ROADMAP · Sistema de Gestión de Eventos

Las fases de implementación 0 a 9 ya están integradas en `main`. Este documento
conserva el plan y sus criterios de revisión; las listas por fase no sustituyen
una prueba completa de integración. Ver [estado de integración](front-eventos/INTEGRACION-BACKEND.md)
y [guía de instalación](docs/INSTALACION.md) para el estado y los pasos actuales.

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

El contrato de **todas** las fases ya está en `docs/API.md`. Por eso los dos
pueden avanzar a la vez sin esperarse:

```
Back  ── [revisa contrato N] ── [implementa N] ── [PR N] ── [revisa contrato N+1] ── ...
Front ── [pantallas N contra el contrato] ─────── [prueba N con la API real] ── [pantallas N+1] ── ...
```

1. Al empezar cada fase, el back **revisa** su sección del contrato. Si hace
   falta un ajuste, lo cambia, lo anota en el "Historial de cambios" de
   `docs/API.md` y avisa antes de implementar.
2. El front arma las pantallas contra el contrato, aunque la API todavía no
   esté implementada.
3. Cuando el back mergea la fase, el front prueba contra la API real y corrige
   lo que haga falta.

**Reglas del equipo:**

- Cada uno toca **solo su carpeta**. `docs/API.md` lo modifica solo el back. Si
  el front necesita un cambio, lo pide por un issue o en el PR.
- Una rama por persona: `backend` y `frontend`. Al cerrar cada fase se mergea
  a `main` por Pull Request y **el otro lo revisa**. Así los dos conocen todo
  el sistema para la defensa. Lo del otro se trae desde `main`.
- Un endpoint que ya está en el contrato **no se cambia sin avisar**.
- Si cambia el modelo de datos, se actualiza el DER y los dos están de acuerdo.

---

## Mapa de fases

| # | Fase | Back (Miqueas) | Front (Compañero) |
| --- | --- | --- | --- |
| 0 | Puesta en marcha | Documentación, ramas, base local | Lo mismo, más leer el contrato completo |
| 1 | Base de datos y multitenant | Esquema completo, usuarios en BD, token con empresa | Layout con Ant Design y migrar las pantallas existentes |
| 2 | Catálogos | ABM de clientes, tipos de evento, servicios, proveedores y empleados | Pantallas de catálogos |
| 3 | Solicitudes | ABM con filtros y cambios de estado | Listado, formulario y detalle |
| 4 | Presupuestos y versiones | Detalle, totales, versiones, presentar y rechazar | Editor de presupuesto y versiones |
| 5 | Confirmación del evento | Aceptar con transacción y CRUD de eventos | Modal de aceptación, listado, calendario y detalle |
| 6 | Servicios del evento y tareas | Estados de proveedor, tareas con secuencia, "mis tareas" | Pestañas Servicios y Tareas, "Mis tareas" |
| 7 | Seguimiento general | Consultas agregadas del tablero | Tablero de inicio |
| 8 | Cierre y feedback | Cierre, cancelación y feedback | Pestaña Cierre |
| 9 | Pulido y entrega | Revisión, seed de demo, docs de decisiones | Revisión, guion de demo |
| 10 | Superadmin, roles y aislamiento | Superadmin, roles `admin`/`coordinador`/`empleado`, personal con acceso, panel del empleado, cierre de las fugas | 3 layouts por rol, panel de superadmin, Personal con acceso, Usuarios, panel del empleado |

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

### Backend · Miqueas · ✅ implementada

> Quedan 3 pendientes chicos, listados al final de `docs/API.md` (login con
> `id_usuario`, parsers de `pg` en `db.js` y 409 al borrar una empresa con datos).
> Resolverlos antes de empezar la Fase 2.

> ⚠️ Hoy los usuarios están en memoria porque así lo pedía la guía de la
> materia. Esta fase los pasa a una tabla, porque el sistema multitenant
> necesita saber de qué empresa es cada usuario. Si la cátedra exige
> mantenerlos en memoria, alcanza con agregar `id_empresa` al array y al token.

- **Contrato:** revisar la "Fase 1" de `docs/API.md`. El registro recibe
  `id_empresa`; el login devuelve `usuario` con `id_empresa`, `nombre_empresa`
  e `id_empleado`.
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

- **Contrato:** revisar la "Fase 2" de `docs/API.md`.
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

- **Contrato:** revisar la "Fase 3" de `docs/API.md`.
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

- **Contrato:** revisar la "Fase 4" de `docs/API.md`.
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
- `PATCH /:id/rechazar`: de `presentado` a `rechazado`. Después de un
  rechazo también se puede crear una nueva versión.

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

- **Contrato:** revisar la "Fase 5" de `docs/API.md`.
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

- **Contrato:** revisar la "Fase 6" de `docs/API.md`.
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

- **Contrato:** revisar la "Fase 7" de `docs/API.md`.
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

- **Contrato:** revisar la "Fase 8" de `docs/API.md`.
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
- `front-eventos/DEMO.md`: guion de 10 minutos que recorre el circuito completo y
  muestra la diferencia entre tarea completada y proveedor confirmado.

### Los dos

- [ ] Clonar el repo de cero y seguir el README alcanza para levantar todo.
- [ ] Ensayar la demo juntos.
- [ ] Cada uno puede explicar las pantallas y endpoints principales del otro.

---

## Fase 10 · Superadmin, roles y aislamiento entre empresas

**Objetivo:**

- tres niveles de acceso: **superadmin** (nosotros), la **empresa** (su `admin`)
  y su **personal** (`coordinador` y `empleado`);
- un panel para que la empresa dé de alta a sus empleados con acceso y rol;
- un panel propio para el empleado, con sus tareas;
- cerrar las tres fugas de la Fase 1:
  - `GET /api/empresas` público;
  - registro público;
  - el `admin` de una empresa puede tocar otras.

**Contrato:** sección "Fase 10" de `docs/API.md`, sobre todo la tabla
**"Permisos por ruta"**.

> Es una fase de **seguridad**. El criterio de "listo" no es que las pantallas
> anden: es que **nadie pueda ver o tocar algo de otro rol o de otra empresa**,
> aunque arme los pedidos a mano.

### Backend · Miqueas

1. **Base**
   - `usuarios`:
     - roles `superadmin`, `admin`, `coordinador` y `empleado`;
     - `id_empresa` nullable y los CHECK del contrato;
     - columna `debe_cambiar_password`;
     - índice único parcial sobre `id_empleado`.
   - Seed:
     - el rol `usuario` pasa a `coordinador`;
     - un superadmin;
     - un usuario `empleado` en la empresa 1, con tareas con proveedor y libres;
     - una cuarta empresa suspendida.
     - Documentar todos los usuarios en el README.
2. **Middlewares** `soloEmpresa`, `soloSuperadmin` y `permitirRoles`. Se
   montan a nivel router en `index.js`, siguiendo la tabla de permisos.
   `soloEmpresa` verifica que la empresa siga activa.
3. **Auth**
   - Login: `LEFT JOIN` con empresas, 403 si la empresa está suspendida y
     devuelve `debe_cambiar_password`.
   - Nuevo `PUT /auth/password`.
   - Borrar el registro.
4. **Panel de superadmin**:
   - resumen y empresas con métricas, con consultas agregadas;
   - alta de empresa con su admin, en una transacción;
   - suspensión y reactivación;
   - DELETE solo sin datos;
   - soporte de usuarios de cada empresa.
5. **Mi empresa** (`/mi-empresa`) y **Usuarios** (`/usuarios`), con las reglas 10.
6. **Personal con acceso:**
   - `POST /empleados` con el bloque `acceso` (empleado, vínculo y usuario en
     una transacción);
   - `POST /empleados/:id/acceso`;
   - el campo `acceso` en las respuestas;
   - la baja del empleado desactiva su usuario.
7. **Panel del empleado** (regla 11):
   - `/tareas/mias` con los datos del evento y del proveedor, **sin importes**,
     y con `puede_avanzar`;
   - `PATCH /tareas/:id/estado` y `PATCH /servicios-evento/:id` restringidos
     al empleado, con el filtro en el `WHERE`.
8. Borrar `empresas.routes.js` y `empresas.controller.js`.
9. `docs/DECISIONES.md`: agregar "el superadmin solo ve métricas", "las
   cuentas las crea la empresa, no hay registro público" y "el empleado no ve
   importes".

**Listo cuando** (todo con curl, armando los pedidos a mano):

- [ ] Sin token, `GET /api/empresas` y `POST /api/auth/register` → 404.
- [ ] Superadmin en cualquier ruta de empresa → 403. Admin, coordinador o
      empleado en `/superadmin/*` → 403.
- [ ] **Recorrer la tabla de permisos completa**: para cada fila, probar un rol
      permitido y uno no permitido.
- [ ] Empleado:
  - [ ] cambia el estado de una tarea suya → 200; de una tarea ajena → 404;
  - [ ] cambia el estado del proveedor de su servicio → 200; manda
        `costo_acordado_proveedor` → 403; un servicio sin tareas suyas → 404;
  - [ ] ninguna respuesta que recibe tiene importes ni costos.
- [ ] Admin de la empresa 1 con un id de la empresa 2 en `/usuarios/:id` o
      `/empleados/:id` → 404.
- [ ] Alta de empleado con `acceso` y email repetido → no queda el empleado
      creado a medias.
- [ ] Suspender una empresa: login → 403, y el token viejo deja de servir.
      Reactivarla devuelve todo como estaba.
- [ ] No se puede dejar la empresa sin admin activo, ni quitarse el rol a uno mismo.
- [ ] Un usuario con `debe_cambiar_password: true` lo ve en `false` después
      de `PUT /auth/password`.

### Frontend · Compañero

1. **Sacar el Registro** (pantalla, ruta, link y servicio) y las pantallas
   `Empresas` y `EmpresaForm`.
2. **Menú único con roles**: una sola definición de opciones con los roles
   permitidos para cada una (ver `front-eventos/CLAUDE.md`). Redirección por
   rol al loguearse y guardas en las rutas.
3. **Cambio de contraseña**:
   - pantalla obligatoria si `debe_cambiar_password`;
   - y opción "Cambiar contraseña" en el menú del usuario del `Header`.
4. **`LayoutSuperadmin`**:
   - Resumen (`Card` + `Statistic`);
   - Empresas (`Table` con métricas, búsqueda, filtro y suspender);
   - alta en `Modal` o `Drawer` con `Steps` (empresa → admin);
   - detalle con `Descriptions`, `Statistic` y los usuarios con sus acciones
     de soporte.
5. **Personal** (admin):
   - la `Table` suma la columna "Acceso", con el rol en un `Tag` o "Sin acceso";
   - en el `Form` de alta, un `Switch` "Darle acceso al sistema" que muestra
     email, contraseña temporal y `Select` de rol;
   - para un empleado sin acceso, la acción "Dar acceso".
6. **Usuarios** (admin): `Table` con filtro por rol, editar rol, activar o
   desactivar y resetear la contraseña. Los mensajes 409 se muestran tal cual
   los manda la API.
7. **Mi empresa**: `Descriptions`, editable solo para admin y con el CUIT en
   solo lectura.
8. **`LayoutEmpleado`**, simple y pensado para el celular:
   - **Mis tareas** como inicio: tarjetas o `List` agrupadas por evento, con
     fecha, sede y cliente, las vencidas en rojo arriba de todo, y un filtro
     por estado.
   - Cada tarea muestra el **paso** (`Steps` con la secuencia) y un botón para
     avanzar el estado, deshabilitado con un `Tooltip` si `puede_avanzar` es
     `false`.
   - Si la tarea tiene proveedor: un bloque con sus datos de contacto
     (teléfono y email clickeables), el estado del proveedor con un `Select`
     y las observaciones. Sin importes.

**Listo cuando:**

- [ ] Hay 4 experiencias distintas según el rol, y ninguna muestra opciones de otro.
- [ ] El empleado puede trabajar su jornada solo desde "Mis tareas", también
      desde el celular.
- [ ] Ninguna pantalla del empleado muestra montos.
- [ ] Los 403 y 409 se muestran con el mensaje de la API.
- [ ] `build` y `lint` pasan.

### Los dos

- [ ] Probar juntos con 5 sesiones: superadmin, admin, coordinador y empleado
      de la empresa 1, y el admin de la empresa suspendida.
- [ ] Actualizar el DER: roles nuevos, `id_empresa` nullable y
      `debe_cambiar_password` en `usuarios`.
- [ ] Actualizar el relevamiento: los roles internos (los 7 actores) ahora se
      agrupan en `admin`, `coordinador` y `empleado`. Explicar cuál cubre a cuál.
- [ ] Sumar al guion de la demo: el panel de superadmin, el alta de un
      empleado con acceso y su vista desde el celular.

---

## Checklist de cada PR

- [ ] El PR va de `backend` o `frontend` a `main` y cierra una fase completa.
- [ ] Se probó al menos un caso de error (otra empresa, estado inválido, datos faltantes).
- [ ] Back: las respuestas coinciden con `docs/API.md`. Front: `build` y `lint` pasan.
- [ ] El README de la carpeta está actualizado.
- [ ] El otro integrante revisó y aprobó el PR.
