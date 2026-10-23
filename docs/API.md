# Contrato de la API

Este documento es el acuerdo entre el backend y el frontend. **Lo mantiene el
backend.** El front construye las pantallas a partir de lo que dice acá. Si algo
cambia, se actualiza este archivo **y se avisa** antes de mergear.

## Convenciones generales

- **Base URL**: `http://localhost:3000/api`
- **Formato**: JSON. Los nombres de campos van en `snake_case` y en español,
  igual que las columnas de la base.
- **Fechas**: `"YYYY-MM-DD"`. Los timestamps (`fecha_creacion`) van en ISO 8601.
- **Montos**: número con hasta 2 decimales (`1300000.5`), **nunca string**.
- **Ids**: siempre `id_<entidad>` (`id_cliente`, `id_evento`...).
- **Listados**: devuelven un array directo (`[...]`), sin paginación.
- **Rutas protegidas**: header `Authorization: Bearer <token>`. **Todas las
  rutas son protegidas, salvo las marcadas como Público.**
- **Roles** (desde la Fase 10): `superadmin` (dueños del sistema) y, en cada
  empresa, `admin`, `coordinador` y `empleado`. La tabla de permisos por ruta
  está en la sección "Fase 10".
- **Multitenant**: la empresa sale del token. Nunca se manda `id_empresa` en el
  body, salvo en el registro.
- **Errores**: siempre `{ "mensaje": "..." }`. El front muestra el mensaje
  tal cual y **nunca compara el texto**: para decidir qué hacer usa el código
  HTTP. Los mensajes del back van sin tildes (como el código actual).
- **Fuente de verdad del modelo**: `api-eventos/database/schema.sql`. Los
  nombres de campos de este contrato salen de ahí.

| Código | Cuándo |
| --- | --- |
| 400 | Faltan datos, datos inválidos o duplicados |
| 401 | Sin token, token inválido o vencido |
| 403 | El rol no alcanza |
| 404 | No existe **o pertenece a otra empresa** |
| 409 | La acción no es válida para el estado actual, o tiene registros asociados |
| 500 | Error inesperado (`"Error interno del servidor"`) |

Estos errores aplican a todos los endpoints y **no se repiten** en cada uno:

- `401` en las rutas protegidas: `"Token no proporcionado"`, `"Token invalido"`
  o `"El token expiro"`.
- `404 · "<Recurso> no encontrado"` cuando el `:id` de la URL no existe, es de
  otra empresa **o no es un entero válido** (`/clientes/abc`).
- `400 · "Hay datos con un formato invalido"`: red de seguridad para un dato que
  la base no puede convertir a su tipo (un texto donde va un número o un
  booleano, una fecha imposible, un número o un texto que no entra en la columna).
- `400 · "El cuerpo del pedido no es un JSON valido"`.
- `404 · "Ruta no encontrada"` para una ruta que no existe.
- `500 · "Error interno del servidor"`, siempre con ese texto.
- Un filtro de listado con formato inválido (`?desde=hola`, `?id_cliente=abc`)
  se ignora: no da error.

> **Nota para el back:** `pg` devuelve los `DATE` como objeto `Date` (que al
> pasar a JSON se corre de zona horaria) y los `DECIMAL` como string. En
> `src/data/db.js` configurar `pg.types.setTypeParser(1082, v => v)` para las
> fechas y `pg.types.setTypeParser(1700, parseFloat)` para los montos. Así se
> cumple el formato de arriba.

### Estados válidos

| Entidad | Campo | Valores |
| --- | --- | --- |
| Solicitud | `estado` | `pendiente`, `presupuestada`, `aceptada`, `rechazada`, `cancelada` |
| Presupuesto | `estado` | `borrador`, `presentado`, `aceptado`, `rechazado`, `reemplazado` |
| Evento | `estado` | `confirmado`, `en_preparacion`, `realizado`, `cancelado` |
| Servicio del evento | `estado_proveedor` | `solicitada`, `confirmada`, `en_seguimiento`, `finalizada`, `rechazada` |
| Tarea | `estado_tarea` | `pendiente`, `en_curso`, `completada` (`vencida` es un booleano calculado) |

---

## Índice

| Fase | Recurso | Rutas |
| --- | --- | --- |
| 1 | Autenticación | `/auth/register`, `/auth/login`, `/auth/perfil` |
| 1 | Empresas | `/empresas` |
| 2 | Clientes | `/clientes` |
| 2 | Tipos de evento | `/tipos-eventos` |
| 2 | Servicios | `/servicios` |
| 2 | Proveedores | `/proveedores`, `/proveedores/:id/servicios` |
| 2 | Empleados | `/empleados` |
| 3 | Solicitudes | `/solicitudes` |
| 4 | Presupuestos | `/solicitudes/:id/presupuestos`, `/presupuestos` |
| 5 | Eventos | `/presupuestos/:id/aceptar`, `/eventos` |
| 6 | Servicios del evento | `/eventos/:id/servicios`, `/servicios-evento` |
| 6 | Tareas | `/eventos/:id/tareas`, `/tareas` |
| 7 | Seguimiento | `/seguimiento` |
| 8 | Cierre | `/eventos/:id/cerrar`, `/eventos/:id/feedback` |
| 10 | Autenticación (cambios) | `/auth/login`, `/auth/password` · se elimina `/auth/register` |
| 10 | Panel de superadmin | `/superadmin/resumen`, `/superadmin/empresas` |
| 10 | Mi empresa, personal y usuarios | `/mi-empresa`, `/empleados` (acceso), `/usuarios` · se elimina `/empresas` |
| 10 | Panel del empleado | `/tareas/mias`, `/tareas/:id/estado`, `/servicios-evento/:id` |

---

# Fase 1 · Autenticación y empresas

## Autenticación · `/api/auth`

### POST /auth/register

> ⚠️ **Se elimina en la Fase 10.** Ya no hay registro público.

**Acceso:** público. El usuario se crea con `rol: "usuario"`.

Body:

```json
{
  "nombre": "Ana Gómez",
  "email": "ana@eventosdelcentro.com",
  "password": "secreta123",
  "id_empresa": 1
}
```

Respuesta 201:

```json
{
  "id_usuario": 7,
  "nombre": "Ana Gómez",
  "email": "ana@eventosdelcentro.com",
  "rol": "usuario",
  "id_empresa": 1
}
```

Errores:

- 400 · `"Faltan datos: nombre, email, password e id_empresa"`
- 400 · `"La empresa no existe o esta inactiva"`
- 400 · `"El email ya esta registrado"`

### POST /auth/login

**Acceso:** público.

Body:

```json
{ "email": "ana@eventosdelcentro.com", "password": "secreta123" }
```

Respuesta 200:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id_usuario": 7,
    "nombre": "Ana Gómez",
    "email": "ana@eventosdelcentro.com",
    "rol": "usuario",
    "id_empresa": 1,
    "nombre_empresa": "Eventos del Centro",
    "id_empleado": 1
  }
}
```

- El payload del token es `{ id, email, rol, id_empresa }` (`id` es el
  `id_usuario`). Los controllers lo leen como `req.usuario.id`.
- `id_empleado` es `null` si el usuario no está vinculado a un empleado. Se usa
  para "Mis tareas".

Errores:

- 400 · `"Faltan el email y la contrasena"`
- 401 · `"Credenciales invalidas"` (mismo mensaje si el email no existe, si la
  contraseña no coincide o si el usuario está inactivo)

### GET /auth/perfil

Respuesta 200: el mismo objeto `usuario` del login.

---

## Empresas · `/api/empresas`

> ⚠️ **Se elimina en la Fase 10.** Lo reemplazan `/superadmin/empresas`
> (superadmin) y `/mi-empresa` (cada empresa). Esta sección queda como
> historial.

Objeto **Empresa**:

```json
{
  "id_empresa": 1,
  "nombre": "Eventos del Centro",
  "cuit": "30-71234567-8",
  "email": "contacto@eventosdelcentro.com",
  "telefono": "351-4001122",
  "direccion": "Av. Colón 1200, Córdoba",
  "activo": true,
  "fecha_creacion": "2026-10-01T12:00:00.000Z"
}
```

| Método | Ruta | Acceso | Body | Respuesta |
| --- | --- | --- | --- | --- |
| GET | `/empresas` | Público | — | 200 · `[Empresa]` |
| GET | `/empresas/:id` | Público | — | 200 · `Empresa` |
| POST | `/empresas` | Solo admin | `nombre`*, `cuit`*, `email`, `telefono`, `direccion` | 201 · `Empresa` |
| PUT | `/empresas/:id` | Solo admin | lo mismo que POST, más `activo` | 200 · `Empresa` |
| DELETE | `/empresas/:id` | Solo admin | — | 204 |

`*` = obligatorio. El GET es público porque lo usa la pantalla de registro para
elegir la empresa (el front muestra solo las que tienen `activo: true`).

Errores:

- 400 · `"El nombre y el cuit son obligatorios"`
- 400 · `"Ya existe una empresa con ese cuit"`
- 403 · `"No tenes permiso para esta accion"`
- 409 · `"La empresa tiene datos asociados. Desactivala en lugar de eliminarla"`
  (DELETE · **pendiente**: hoy el DELETE de una empresa con datos responde 500)

---

# Fase 2 · Catálogos

Las cinco entidades siguen **el mismo patrón**:

| Método | Ruta | Acción | Respuesta |
| --- | --- | --- | --- |
| GET | `/<recurso>?activo=true\|false&buscar=texto` | Listar | 200 · array |
| GET | `/<recurso>/:id` | Obtener uno | 200 · objeto |
| POST | `/<recurso>` | Crear | 201 · objeto |
| PUT | `/<recurso>/:id` | Editar (se manda el objeto completo) | 200 · objeto |
| PATCH | `/<recurso>/:id/activo` | Activar o desactivar: `{ "activo": false }` | 200 · objeto |

- Sin `?activo`, el listado devuelve todos. `?buscar` busca sin distinguir
  mayúsculas en los campos que se indican en cada recurso.
- No hay `DELETE`: la baja es lógica.
- Errores comunes: 400 por campos obligatorios y 400 por duplicados. Los
  mensajes exactos de obligatorios son:
  - clientes: `"El nombre y el apellido son obligatorios"`
  - tipos de evento y servicios: `"El nombre es obligatorio"`
  - proveedores: `"La razon social es obligatoria"`
  - empleados: `"El legajo, el nombre y el apellido son obligatorios"`
- `PATCH /:id/activo` con un valor que no es booleano: 400 ·
  `"El campo activo tiene que ser true o false"`.

## Clientes · `/api/clientes`

Búsqueda sobre `nombre`, `apellido`, `dni_cuit` y `email`.

```json
{
  "id_cliente": 1,
  "nombre": "Lucía",
  "apellido": "Fernández",
  "dni_cuit": "35111222",
  "email": "lucia@mail.com",
  "telefono": "353-4100001",
  "direccion": "Bv. España 450, Villa María",
  "activo": true,
  "fecha_alta": "2026-09-01T14:30:00.000Z"
}
```

- Obligatorios: `nombre` y `apellido`. Para un cliente empresa, la razón social
  va en `nombre` y el tipo societario (o `-`) en `apellido`.
- 400 · `"Ya existe un cliente con ese DNI/CUIT"`

## Tipos de evento · `/api/tipos-eventos`

Búsqueda sobre `nombre`.

```json
{
  "id_tipo_evento": 1,
  "nombre": "Cumpleaños",
  "descripcion": "Fiestas de cumpleaños de 15, 18 o adultos",
  "activo": true
}
```

- Obligatorio: `nombre`.
- 400 · `"Ya existe un tipo de evento con ese nombre"`

## Servicios · `/api/servicios`

Búsqueda sobre `nombre` y `descripcion`.

```json
{
  "id_servicio": 1,
  "nombre": "Catering",
  "descripcion": "Comida y bebida para los asistentes",
  "activo": true
}
```

- Obligatorio: `nombre`.
- 400 · `"Ya existe un servicio con ese nombre"`

## Proveedores · `/api/proveedores`

Búsqueda sobre `razon_social`, `cuit` y `email`. Hay un filtro extra, `?id_servicio=3`,
que devuelve solo los proveedores que ofrecen ese servicio. Lo usa el
presupuesto para el `Select` de proveedor.

```json
{
  "id_proveedor": 1,
  "razon_social": "Sabores Córdoba SRL",
  "cuit": "30-71111222-3",
  "email": "ventas@saborescba.com",
  "telefono": "351-5551001",
  "direccion": "Av. Sabattini 2300, Córdoba",
  "observaciones": "Trabaja habitualmente con Salón Las Palmas",
  "activo": true,
  "servicios": [
    { "id_servicio": 1, "nombre": "Catering" }
  ]
}
```

- Obligatorio: `razon_social`.
- 400 · `"Ya existe un proveedor con ese CUIT"`
- `servicios` es de solo lectura en POST y PUT. Se modifica con el endpoint de abajo.

### GET /proveedores/:id/servicios

Respuesta 200:

```json
[ { "id_servicio": 1, "nombre": "Catering" } ]
```

### PUT /proveedores/:id/servicios

Reemplaza la lista completa de servicios que ofrece el proveedor.

Body:

```json
{ "ids_servicios": [1, 4] }
```

Respuesta 200: el objeto **Proveedor** completo, con `servicios` actualizado.

Errores:

- 400 · `"ids_servicios tiene que ser una lista"`
- 400 · `"Alguno de los servicios no existe"` (no existe o es de otra empresa)

## Empleados · `/api/empleados`

Búsqueda sobre `nombre`, `apellido` y `legajo`. Devuelve **los empleados
vinculados a la empresa del usuario** (`empleados_x_empresa`), y los campos del
vínculo vienen en el mismo objeto.

```json
{
  "id_empleado": 1,
  "legajo": "L-001",
  "nombre": "Ana",
  "apellido": "Gómez",
  "rol": "coordinador",
  "telefono": "353-4200001",
  "email": "ana@eventosdelcentro.com",
  "cargo": "Coordinadora general",
  "fecha_inicio": "2025-03-01",
  "fecha_fin": null,
  "activo": true
}
```

- Obligatorios: `legajo`, `nombre` y `apellido`. `fecha_inicio`, si no
  viene, es la fecha de hoy.
- 400 · `"Ya existe un empleado con ese legajo"` (el legajo es único en todo el
  sistema, no por empresa).
- `activo` es el del **vínculo** con la empresa (`empleados_x_empresa.activo`),
  no el de la tabla `empleados`.
- POST crea el empleado y su vínculo con la empresa en una transacción.
- `PATCH /:id/activo` con `false` pone `fecha_fin` en hoy; con `true` vuelve a
  dejar `fecha_fin` en `null`.

---

# Fase 3 · Solicitudes · `/api/solicitudes`

Objeto **Solicitud** (como aparece en el listado):

```json
{
  "id_solicitud": 1,
  "id_cliente": 1,
  "nombre_cliente": "Lucía Fernández",
  "id_tipo_evento": 1,
  "nombre_tipo_evento": "Cumpleaños",
  "fecha_solicitud": "2026-09-01",
  "fecha_evento_prevista": "2026-11-14",
  "cantidad_asistentes": 80,
  "sede_prevista": "Salón Las Palmas",
  "preferencias": "Temática años 80, menú sin TACC para 5 personas",
  "estado": "aceptada",
  "id_evento": 1
}
```

`nombre_cliente` es nombre y apellido concatenados. Para un cliente empresa (con
apellido `-`) el guion no se agrega: `"Grupo Andes SA"`. Vale igual en todos los
`nombre_cliente` de la API. `id_evento` vale `null` mientras no haya evento.

### GET /solicitudes

Filtros (todos opcionales): `?estado=pendiente`, `?id_cliente=1`,
`?desde=2026-11-01&hasta=2026-11-30` (sobre `fecha_evento_prevista`) y
`?buscar=texto` (nombre del cliente).

Ordenado por `fecha_evento_prevista` ascendente. Respuesta 200: `[Solicitud]`.

Un filtro con formato inválido (`?desde=hola`, `?id_cliente=abc`) se ignora:
no da error.

### GET /solicitudes/:id

Respuesta 200: la **Solicitud** con dos campos más, `cliente` y `presupuestos`:

```json
{
  "id_solicitud": 1,
  "...": "...",
  "cliente": {
    "id_cliente": 1,
    "nombre": "Lucía",
    "apellido": "Fernández",
    "telefono": "353-4100001",
    "email": "lucia@mail.com"
  },
  "presupuestos": [
    { "id_presupuesto": 1, "numero_version": 1, "fecha_emision": "2026-09-05", "importe_total": 2350000, "estado": "reemplazado" },
    { "id_presupuesto": 2, "numero_version": 2, "fecha_emision": "2026-09-12", "importe_total": 2100000, "estado": "aceptado" }
  ]
}
```

`presupuestos` viene ordenado por `numero_version` y es `[]` si no hay ninguno.

### POST /solicitudes

Body:

```json
{
  "id_cliente": 1,
  "id_tipo_evento": 1,
  "fecha_evento_prevista": "2026-11-14",
  "cantidad_asistentes": 80,
  "sede_prevista": "Salón Las Palmas",
  "preferencias": "Temática años 80"
}
```

- Obligatorios: `id_cliente`, `id_tipo_evento`, `fecha_evento_prevista` y
  `cantidad_asistentes`.
- La solicitud se guarda con el `id_empresa` del token.
- La solicitud nace con `fecha_solicitud` = hoy y `estado` = `pendiente`.

Respuesta 201: la **Solicitud** completa (formato del listado).

Errores:

- 400 · `"El cliente, el tipo de evento, la fecha y la cantidad de asistentes son obligatorios"`
  (también si la fecha no tiene formato `YYYY-MM-DD` o no existe, como `2026-02-31`)
- 400 · `"El cliente no existe o esta inactivo"`
- 400 · `"El tipo de evento no existe o esta inactivo"`
- 400 · `"La cantidad de asistentes tiene que ser mayor a 0"`
- 400 · `"La fecha del evento no puede ser anterior a hoy"`

### PUT /solicitudes/:id

Mismo body y mismas validaciones que el POST. Respuesta 200: **Solicitud**.

- 409 · `"Solo se puede editar una solicitud pendiente o presupuestada"`

### PATCH /solicitudes/:id/estado

Body:

```json
{ "estado": "cancelada" }
```

Solo acepta `cancelada` o `rechazada`, y solo desde `pendiente` o
`presupuestada`. Los otros cambios de estado los hacen los presupuestos.

Respuesta 200: **Solicitud**.

- 400 · `"Estado invalido"`
- 409 · `"No se puede cambiar el estado de una solicitud <estado actual>"`

---

# Fase 4 · Presupuestos

Objeto **Presupuesto** (completo; lo devuelven todos los endpoints de esta fase):

```json
{
  "id_presupuesto": 2,
  "id_solicitud": 1,
  "numero_version": 2,
  "fecha_emision": "2026-09-12",
  "validez_dias": 15,
  "observaciones": "Se ajusta el catering",
  "estado": "presentado",
  "importe_total": 2100000,
  "total_costo": 1720000,
  "total_margen": 380000,
  "editable": false,
  "solicitud": {
    "id_solicitud": 1,
    "nombre_cliente": "Lucía Fernández",
    "nombre_tipo_evento": "Cumpleaños",
    "fecha_evento_prevista": "2026-11-14",
    "cantidad_asistentes": 80,
    "estado": "presupuestada"
  },
  "detalle": [
    {
      "id_detalle": 4,
      "id_servicio": 1,
      "nombre_servicio": "Catering",
      "id_proveedor": 1,
      "nombre_proveedor": "Sabores Córdoba SRL",
      "descripcion": "Menú completo 80 personas",
      "cantidad": 80,
      "costo_proveedor": 1100000,
      "importe_cliente": 1300000,
      "margen": 200000
    }
  ],
  "versiones": [
    { "id_presupuesto": 1, "numero_version": 1, "estado": "reemplazado" },
    { "id_presupuesto": 2, "numero_version": 2, "estado": "presentado" }
  ]
}
```

- **`costo_proveedor` e `importe_cliente` son el total del renglón**, no un
  precio unitario. `cantidad` es informativa (80 cubiertos, 8 horas...) y no
  multiplica.
- `importe_total` = suma de `importe_cliente`. `total_costo` = suma de
  `costo_proveedor`.
- `margen` = `importe_cliente − costo_proveedor`.
- `editable` = `true` solo en `borrador`. Le sirve al front para mostrar la
  tabla en solo lectura.
- `id_proveedor` y `nombre_proveedor` pueden ser `null` (por ejemplo, un
  servicio que incluye el salón).
- `versiones` trae todas las versiones de la misma solicitud, para navegar entre ellas.

### POST /solicitudes/:id/presupuestos

Crea la versión 1 en `borrador`, sin renglones. Body opcional:
`{ "validez_dias": 15, "observaciones": "..." }`.

Respuesta 201: **Presupuesto**.

- 400 · `"La validez tiene que ser un numero de dias mayor a 0"` (si viene
  `validez_dias` y no es un entero mayor a 0)
- 404 · `"Solicitud no encontrada"`
- 409 · `"La solicitud ya tiene presupuestos. Usa 'nueva version'"`
- 409 · `"La solicitud esta <estado> y no admite presupuestos"` (si no está
  `pendiente` ni `presupuestada`)

### GET /presupuestos/:id

Respuesta 200: **Presupuesto**.

### POST /presupuestos/:id/detalle

Body:

```json
{
  "id_servicio": 1,
  "id_proveedor": 1,
  "descripcion": "Menú completo 80 personas",
  "cantidad": 80,
  "costo_proveedor": 1100000,
  "importe_cliente": 1300000
}
```

- Obligatorios: `id_servicio` e `importe_cliente`.
- Opcionales: `id_proveedor`, `descripcion`, `cantidad` (por defecto 1) y
  `costo_proveedor` (por defecto 0).

Respuesta 201: **Presupuesto** completo, con los totales recalculados.

Errores:

- 400 · `"El servicio y el importe al cliente son obligatorios"`
- 400 · `"Los importes no pueden ser negativos"`
- 400 · `"La cantidad tiene que ser mayor a 0"`
- 400 · `"El servicio no existe o esta inactivo"`
- 400 · `"El proveedor no ofrece ese servicio"` (también si el proveedor está
  inactivo)
- 409 · `"Solo se puede modificar un presupuesto en borrador"`

Un importe que no es un número (`"abc"`) responde el 400 de importes, y una
`cantidad` que no es un entero, el 400 de cantidad. El `importe_total` nunca se
toma del body: si viene, se ignora.

### PUT /presupuestos/:id/detalle/:idDetalle

Mismo body, validaciones y errores que el POST.

Respuesta 200: **Presupuesto**.

Además, existe `PUT /presupuestos/:id` con `{ validez_dias, observaciones }`
para editar la cabecera (solo en `borrador`). Respuesta 200: **Presupuesto**.
Responde el mismo 400 de validez que la creación y el 409
`"Solo se puede modificar un presupuesto en borrador"`.

Si `:idDetalle` no existe o no es de ese
presupuesto, 404 · `"Renglon no encontrado"`.

### DELETE /presupuestos/:id/detalle/:idDetalle

Respuesta 200: **Presupuesto**. Devuelve 200 en vez de 204 para que el front
reciba los totales recalculados.

- 409 · `"Solo se puede modificar un presupuesto en borrador"`

### PATCH /presupuestos/:id/presentar

Pasa de `borrador` a `presentado`, y la solicitud a `presupuestada`. Sin body.
`fecha_emision` pasa a ser la fecha de hoy: la validez se cuenta desde que el
cliente recibe la propuesta. Respuesta 200: **Presupuesto**.

- 400 · `"No se puede presentar un presupuesto sin renglones"`
- 409 · `"Solo se puede presentar un presupuesto en borrador"`
- 409 · `"La solicitud esta <estado> y no admite presupuestos"` (si la
  solicitud se canceló o se rechazó)

### POST /presupuestos/:id/nueva-version

Crea una versión nueva en `borrador`, con `numero_version` = máximo + 1 y una
copia del detalle. Se puede hacer desde `presentado` (y la versión anterior
pasa a `reemplazado`) o desde `rechazado` (y la anterior queda `rechazado`).
Todo en una transacción. Sin body. La versión nueva copia también
`validez_dias` y `observaciones`, y su `fecha_emision` es la de hoy.

Solo se puede crear desde la **última** versión: si no, desde una v1 rechazada
se podría crear una v3 mientras la v2 sigue presentada.

Respuesta 201: el **Presupuesto** nuevo.

- 409 · `"Solo se puede crear una nueva version desde un presupuesto presentado o rechazado"`
- 409 · `"Ya hay una version en borrador para esta solicitud"`
- 409 · `"Solo se puede crear una nueva version desde la ultima version"`
- 409 · `"La solicitud esta <estado> y no admite presupuestos"`

### PATCH /presupuestos/:id/rechazar

Pasa de `presentado` a `rechazado`. La solicitud queda `presupuestada`, porque
se puede hacer otra versión. Sin body. Respuesta 200: **Presupuesto**.

- 409 · `"Solo se puede rechazar un presupuesto presentado"`

---

# Fase 5 · Confirmación y eventos

Objeto **Evento (listado)**:

```json
{
  "id_evento": 1,
  "id_solicitud": 1,
  "nombre_cliente": "Lucía Fernández",
  "nombre_tipo_evento": "Cumpleaños",
  "fecha_evento_confirmada": "2026-11-14",
  "sede_acordada": "Salón Las Palmas",
  "cantidad_asistentes": 80,
  "id_empleado_coordinador": 1,
  "nombre_coordinador": "Ana Gómez",
  "estado": "en_preparacion"
}
```

Objeto **Evento (detalle)**:

```json
{
  "id_evento": 1,
  "estado": "en_preparacion",
  "fecha_evento_confirmada": "2026-11-14",
  "sede_acordada": "Salón Las Palmas",
  "condiciones_acordadas": "Seña del 30% pagada. Ingreso de proveedores desde las 18 h.",
  "observaciones_cierre": null,
  "feedback_cliente": null,
  "fecha_cierre": null,
  "editable": true,
  "coordinador": { "id_empleado": 1, "nombre": "Ana", "apellido": "Gómez" },
  "cliente": {
    "id_cliente": 1,
    "nombre": "Lucía",
    "apellido": "Fernández",
    "telefono": "353-4100001",
    "email": "lucia@mail.com"
  },
  "solicitud": {
    "id_solicitud": 1,
    "fecha_solicitud": "2026-09-01",
    "nombre_tipo_evento": "Cumpleaños",
    "cantidad_asistentes": 80,
    "preferencias": "Temática años 80, menú sin TACC para 5 personas"
  },
  "presupuesto_aceptado": { "id_presupuesto": 2, "numero_version": 2, "importe_total": 2100000 }
}
```

- `editable` = `true` si el estado es `confirmado` o `en_preparacion`.
- `coordinador` puede ser `null`.

### POST /presupuestos/:id/aceptar

Body:

```json
{
  "fecha_evento_confirmada": "2026-11-14",
  "sede_acordada": "Salón Las Palmas",
  "condiciones_acordadas": "Seña del 30% pagada.",
  "id_empleado_coordinador": 1
}
```

- Obligatorio: `fecha_evento_confirmada`, que no puede ser anterior a hoy.
- Todo lo siguiente pasa en **una sola transacción**:
  - el presupuesto pasa a `aceptado`;
  - las otras versiones de la solicitud en `borrador` o `presentado` pasan a `reemplazado`;
  - la solicitud pasa a `aceptada`;
  - se crea el evento con estado `confirmado`;
  - cada renglón del detalle se copia a `servicios_x_evento`: `costo_proveedor`
    va a `costo_acordado_proveedor`, `importe_cliente` va a
    `importe_acordado_cliente`, y también se copian `descripcion` y
    `cantidad`. El estado queda `solicitada`.
- El evento se guarda con el `id_empresa` del token.
- `id_empleado_coordinador` es opcional: si no viene (o viene `null`), el
  evento queda sin coordinador.
- La `validez_dias` del presupuesto es informativa: un presupuesto vencido se
  puede aceptar igual.

Respuesta 201: **Evento (detalle)**.

Errores:

- 400 · `"La fecha del evento es obligatoria"` (también si no tiene formato
  `YYYY-MM-DD` o no existe)
- 400 · `"La fecha del evento no puede ser anterior a hoy"`
- 400 · `"El coordinador no es un empleado activo de la empresa"`
- 409 · `"Solo se puede aceptar un presupuesto presentado"`
- 409 · `"La solicitud ya tiene un evento"`
- 409 · `"La solicitud esta <estado> y no admite presupuestos"` (si la
  solicitud se canceló o se rechazó con el presupuesto ya presentado)

### GET /eventos

Filtros: `?estado=en_preparacion`, `?desde=&hasta=` (sobre
`fecha_evento_confirmada`), `?id_coordinador=1` y `?buscar=texto` (nombre del
cliente). Ordenado por fecha ascendente. Un filtro con formato inválido se
ignora, igual que en solicitudes.

Respuesta 200: `[Evento (listado)]`.

### GET /eventos/:id

Respuesta 200: **Evento (detalle)**.

### PUT /eventos/:id

Body: `fecha_evento_confirmada`*, `sede_acordada`, `condiciones_acordadas` e
`id_empleado_coordinador`. Respuesta 200: **Evento (detalle)**.

Se manda el objeto completo, como en los catálogos: un campo que no viene queda
en `null` (por ejemplo, sin `id_empleado_coordinador` el evento queda sin
coordinador).

- 400 · los mismos errores de validación que en aceptar
- 409 · `"El evento esta cerrado y no se puede modificar"`

### PATCH /eventos/:id/iniciar-preparacion

Pasa de `confirmado` a `en_preparacion`. Sin body. Respuesta 200: **Evento (detalle)**.

- 409 · `"Solo se puede iniciar la preparacion de un evento confirmado"`

### GET /eventos/:id/servicios

Respuesta 200: `[ServicioEvento]` (el objeto está definido en la fase 6).

---

# Fase 6 · Servicios del evento y tareas

Objeto **ServicioEvento**:

```json
{
  "id_servicio_x_evento": 2,
  "id_evento": 1,
  "id_servicio": 2,
  "nombre_servicio": "Decoración",
  "id_proveedor": 2,
  "nombre_proveedor": "Deco Fiestas",
  "descripcion": "Ambientación de salón y ceremonia",
  "cantidad": 1,
  "costo_acordado_proveedor": 300000,
  "importe_acordado_cliente": 400000,
  "estado_proveedor": "solicitada",
  "fecha_confirmacion_proveedor": null,
  "observaciones": null,
  "tareas_generadas": true,
  "paso_actual": 2
}
```

- `tareas_generadas` indica si ya existen las 4 tareas de la secuencia.
- `paso_actual` es el `orden` de la primera tarea de la secuencia que no está
  `completada`. Vale `null` si no hay tareas o si están todas completadas.

Objeto **Tarea**:

```json
{
  "id_tarea": 5,
  "id_evento": 1,
  "id_servicio_x_evento": 2,
  "nombre_servicio": "Decoración",
  "nombre_proveedor": "Deco Fiestas",
  "id_tipo_tarea": 2,
  "nombre_tipo_tarea": "Confirmar asistencia del proveedor",
  "orden": 2,
  "descripcion": "Confirmar asistencia de Deco Fiestas",
  "id_empleado_responsable": 3,
  "nombre_responsable": "Carla Ruiz",
  "fecha_prevista": "2026-10-05",
  "fecha_finalizacion": null,
  "estado_tarea": "en_curso",
  "observaciones": null,
  "vencida": true
}
```

- En una tarea libre (sin servicio), `id_servicio_x_evento`, `nombre_servicio`,
  `nombre_proveedor`, `id_tipo_tarea`, `nombre_tipo_tarea` y `orden` vienen en
  `null`.
- `vencida` = `fecha_prevista < hoy` y `estado_tarea ≠ completada`. Es
  **calculado**: no se manda en ningún body. Si `fecha_prevista` es `null`,
  `vencida` es `false`.
- En la base, `id_empleado_responsable` y `fecha_prevista` aceptan `null`, pero
  la API los exige al crear tareas (abajo).

Con el evento cerrado (`realizado` o `cancelado`), todos los POST, PUT, PATCH y
DELETE de esta fase responden 409 ·
`"El evento esta cerrado y no se puede modificar"`.

## Servicios del evento

### PATCH /servicios-evento/:id

Actualización parcial: se mandan solo los campos que cambian.

```json
{
  "estado_proveedor": "confirmada",
  "id_proveedor": 2,
  "costo_acordado_proveedor": 300000,
  "importe_acordado_cliente": 400000,
  "observaciones": "Confirmó por mail"
}
```

- Si `estado_proveedor` pasa a `confirmada`, se guarda
  `fecha_confirmacion_proveedor` = hoy (si ya estaba confirmada, se conserva la
  fecha original). Si vuelve a `solicitada`, ese campo se limpia.
- `"id_proveedor": null` deja el servicio sin proveedor. Un proveedor inactivo
  responde lo mismo que uno que no ofrece el servicio.
- Un body vacío no es un error: responde 200 con el servicio sin cambios.
- **No modifica ninguna tarea** (regla 6).

Respuesta 200: **ServicioEvento**.

Errores:

- 400 · `"Estado de proveedor invalido"`
- 400 · `"El proveedor no ofrece ese servicio"`
- 400 · `"Los importes no pueden ser negativos"`

### POST /servicios-evento/:id/generar-tareas

Crea las 4 tareas de la secuencia (`tipos_tarea`), en orden y en una transacción.

Body:

```json
{
  "id_empleado_responsable": 3,
  "fechas": ["2026-10-25", "2026-10-30", "2026-11-07", "2026-11-15"]
}
```

- `fechas` tiene 4 fechas, una por paso, en orden y sin retroceder (dos pasos
  pueden caer el mismo día).
- La `descripcion` de cada tarea se arma sola: `"<tipo de tarea> · <servicio> (<proveedor>)"`.

Respuesta 201: `[Tarea]`, las 4 tareas creadas.

Errores:

- 400 · `"Hay que indicar el responsable y 4 fechas"`
- 400 · `"Las fechas tienen que estar en orden"`
- 400 · `"El responsable no es un empleado activo de la empresa"`
- 409 · `"Las tareas de este servicio ya fueron generadas"`

## Tareas

### GET /eventos/:id/tareas

Filtros: `?estado_tarea=pendiente` y `?vencidas=true`.

Orden: primero las tareas con servicio (por servicio y `orden`) y después las
libres (por `fecha_prevista`). Respuesta 200: `[Tarea]`.

### POST /eventos/:id/tareas

Crea una tarea libre, sin tipo y sin secuencia.

```json
{
  "descripcion": "Visitar el salón y verificar accesos",
  "id_empleado_responsable": 1,
  "fecha_prevista": "2026-11-01",
  "id_servicio_x_evento": null,
  "observaciones": null
}
```

- Obligatorios: `descripcion`, `id_empleado_responsable` y `fecha_prevista`.
- `id_servicio_x_evento` es opcional. Si viene, tiene que ser del mismo evento.

Respuesta 201: **Tarea**.

Errores:

- 400 · `"La descripcion, el responsable y la fecha prevista son obligatorios"`
- 400 · `"El responsable no es un empleado activo de la empresa"`
- 400 · `"El servicio no pertenece a este evento"`

### PUT /tareas/:id

Edita `descripcion`, `id_empleado_responsable`, `fecha_prevista` y
`observaciones`. Para cambiar
el estado se usa el PATCH de abajo. Respuesta 200: **Tarea**.

Mismos errores 400 que el POST.

### PATCH /tareas/:id/estado

Body:

```json
{ "estado_tarea": "completada" }
```

- **Regla de secuencia:** si la tarea tiene `orden` N > 1, solo puede pasar a
  `en_curso` o `completada` si la de orden N−1 del mismo servicio está `completada`.
- Al pasar a `completada` se guarda `fecha_finalizacion` = hoy. Si la tarea
  vuelve a otro estado, se limpia.
- Una tarea completada no puede volver a `pendiente` **ni a `en_curso`** si la
  siguiente de la secuencia ya está `en_curso` o `completada`: si no, quedaría
  un paso en curso con el anterior sin terminar.
- Si una tarea ya completada se vuelve a marcar `completada`, conserva su
  `fecha_finalizacion` original.
- Las tareas libres pasan a cualquier estado: no tienen secuencia.

Respuesta 200: **Tarea**.

Errores:

- 400 · `"Estado de tarea invalido"`
- 409 · `"Primero hay que completar: <nombre del paso anterior>"`
- 409 · `"No se puede reabrir: el paso siguiente ya empezo"`

### DELETE /tareas/:id

Solo para tareas libres (sin `id_tipo_tarea`). Respuesta 204.

- 409 · `"Las tareas de la secuencia del proveedor no se pueden eliminar"`

### GET /tareas/mias

Tareas del empleado vinculado al usuario logueado (`id_empleado` del login), de
eventos abiertos. El `id_empleado` se lee de la tabla `usuarios` en cada pedido
(no viaja en el token). Ordenadas: primero las vencidas, después por `fecha_prevista`.
Filtro: `?estado_tarea=`.

Respuesta 200: `[Tarea]`, con tres campos más:

```json
{
  "id_tarea": 5,
  "...": "...",
  "nombre_cliente": "Lucía Fernández",
  "nombre_tipo_evento": "Cumpleaños",
  "fecha_evento_confirmada": "2026-11-14"
}
```

Si el usuario no está vinculado a un empleado, responde 200 con `[]`.

---

# Fase 7 · Seguimiento · `/api/seguimiento`

Todo se calcula sobre **eventos abiertos** (`confirmado` o `en_preparacion`) de
la empresa del usuario. Todos los endpoints aceptan `?dias=7|15|30` (por defecto
30): la ventana de días hacia adelante para los "próximos".

- `?dias` acepta cualquier entero de 1 a 365. Un valor inválido usa 30.
- `?dias` **solo** afecta a los próximos (`eventos_proximos` y
  `/proximos-eventos`). Las tareas vencidas y los servicios sin confirmar son
  siempre de **todos** los eventos abiertos, en el resumen y en sus listas: así
  el número de cada tarjeta coincide con el largo de su lista.

### GET /seguimiento/resumen

Respuesta 200:

```json
{
  "dias": 30,
  "eventos_proximos": 3,
  "tareas_vencidas": 4,
  "tareas_pendientes": 12,
  "servicios_sin_confirmar": 5,
  "solicitudes_pendientes": 2
}
```

- `eventos_proximos`: eventos abiertos con fecha entre hoy y hoy + `dias`.
- `tareas_vencidas` y `tareas_pendientes` (no completadas): de **todos** los
  eventos abiertos, no solo los próximos.
- `servicios_sin_confirmar`: `estado_proveedor = 'solicitada'` o sin proveedor asignado.
- `solicitudes_pendientes`: solicitudes en `pendiente`.

### GET /seguimiento/proximos-eventos

Respuesta 200, ordenada por fecha:

```json
[
  {
    "id_evento": 1,
    "nombre_cliente": "Lucía Fernández",
    "nombre_tipo_evento": "Cumpleaños",
    "fecha_evento_confirmada": "2026-11-14",
    "dias_restantes": 25,
    "estado": "en_preparacion",
    "nombre_coordinador": "Ana Gómez",
    "total_tareas": 7,
    "tareas_completadas": 3,
    "porcentaje_avance": 43,
    "tareas_vencidas": 2,
    "servicios_sin_confirmar": 2
  }
]
```

`porcentaje_avance` es un entero de 0 a 100. Vale 0 si no hay tareas.
`total_tareas` cuenta todas las tareas del evento (de la secuencia y libres).
`nombre_coordinador` es `null` si el evento no tiene coordinador.

### GET /seguimiento/tareas-vencidas

Respuesta 200: `[Tarea]` con los campos extra de "mis tareas" más
`dias_vencida` (entero). Ordenado por `dias_vencida` descendente.

### GET /seguimiento/servicios-sin-confirmar

Respuesta 200, ordenada por `dias_para_evento` ascendente:

```json
[
  {
    "id_servicio_x_evento": 2,
    "id_evento": 1,
    "nombre_cliente": "Lucía Fernández",
    "fecha_evento_confirmada": "2026-11-14",
    "dias_para_evento": 25,
    "nombre_servicio": "Decoración",
    "nombre_proveedor": "Deco Fiestas",
    "estado_proveedor": "solicitada"
  }
]
```

---

# Fase 8 · Cierre y feedback

### PATCH /eventos/:id/cerrar

Body:

```json
{ "estado": "cancelado", "observaciones_cierre": "El cliente canceló por viaje" }
```

- `estado` es `realizado` o `cancelado`. Solo se cierra un evento `confirmado`
  o `en_preparacion`.
- Si es `cancelado`, `observaciones_cierre` es obligatorio, y la solicitud pasa a
  `cancelada` en la misma transacción.
- Se guarda `fecha_cierre` = hoy.
- No se valida que todas las tareas estén completas: el front muestra un aviso,
  pero la decisión es del usuario. Tampoco se valida la fecha: se puede marcar
  `realizado` antes de la fecha del evento.
- Un motivo hecho solo de espacios cuenta como vacío. Al cerrar como
  `realizado`, `observaciones_cierre` es opcional (si no viene, queda `null`).

Respuesta 200: **Evento (detalle)**, con `editable: false`.

Errores:

- 400 · `"Estado de cierre invalido"`
- 400 · `"Para cancelar un evento hay que indicar el motivo"`
- 409 · `"El evento ya esta cerrado"`

### PATCH /eventos/:id/feedback

Body:

```json
{
  "feedback_cliente": "Excelente atención. La música arrancó tarde.",
  "observaciones_cierre": "Revisar horarios con Audio Pro"
}
```

- Los dos campos son opcionales, pero tiene que venir al menos uno con texto.
  Solo se actualizan los que vienen; el otro conserva su valor.
- Solo para eventos `realizado`. Es la única edición que se permite con el evento cerrado.

Respuesta 200: **Evento (detalle)**.

- 400 · `"No hay datos para actualizar"`
- 409 · `"Solo se puede cargar feedback de un evento realizado"`

---

# Fase 10 · Superadmin, roles y aislamiento entre empresas

Hasta la Fase 9 había dos roles (`admin` y `usuario`) que veían lo mismo, y
quedaban tres fugas entre empresas:

- el listado de empresas era público;
- el registro era público y dejaba elegir cualquier empresa;
- el `admin` de una empresa podía editar o borrar otras.

Esta fase:

- agrega el nivel **superadmin**;
- define **tres roles dentro de cada empresa**;
- deja que la empresa dé de alta a sus empleados con acceso al sistema;
- cierra las fugas.

## Roles

| Rol | Quién es | `id_empresa` | Qué ve y qué puede hacer |
| --- | --- | --- | --- |
| `superadmin` | Nosotros, los dueños del sistema | `null` | El panel de superadmin: alta, edición y suspensión de empresas, soporte de sus usuarios y **solo métricas**. No ve clientes, solicitudes, eventos ni tareas de ninguna empresa |
| `admin` | El dueño de la empresa | su empresa | Todo lo de su empresa, más "Mi empresa", "Personal" (alta de empleados y su acceso) y "Usuarios" |
| `coordinador` | Quien organiza los eventos | su empresa | Toda la operación: solicitudes, presupuestos, eventos completos (resumen, servicios, proveedores, todas las tareas), seguimiento y catálogos |
| `empleado` | Personal que ejecuta tareas | su empresa | Solo **sus tareas**, con los datos básicos del evento. Cambia el estado de sus tareas y, si la tarea es con un proveedor, **gestiona a ese proveedor** (estado y observaciones). No ve importes ni costos |

**Ninguna empresa sabe que existen otras.** Las cuentas las crea alguien de
arriba: el superadmin crea la empresa con su `admin`, y el `admin` da de alta a
sus empleados con el rol que corresponda.

## Permisos por ruta

La API rechaza con **403 · `"No tenes permiso para esta accion"`** todo lo que
no esté permitido en esta tabla.

| Rutas | `superadmin` | `admin` | `coordinador` | `empleado` |
| --- | :---: | :---: | :---: | :---: |
| `/auth/login`, `/auth/perfil`, `/auth/password` | ✔ | ✔ | ✔ | ✔ |
| `/superadmin/*` | ✔ | — | — | — |
| `GET /mi-empresa` | — | ✔ | ✔ | ✔ |
| `PUT /mi-empresa` | — | ✔ | — | — |
| `/usuarios/*` | — | ✔ | — | — |
| `GET /empleados`, `GET /empleados/:id` | — | ✔ | ✔ | — |
| Alta, edición, baja y acceso de empleados | — | ✔ | — | — |
| `/clientes`, `/tipos-eventos`, `/servicios`, `/proveedores` | — | ✔ | ✔ | — |
| `/solicitudes`, `/presupuestos` | — | ✔ | ✔ | — |
| `/eventos/*`, `/servicios-evento/*`, `/seguimiento/*` | — | ✔ | ✔ | ✔¹ |
| `PUT /tareas/:id`, `DELETE /tareas/:id` | — | ✔ | ✔ | — |
| `GET /tareas/mias`, `PATCH /tareas/:id/estado` | — | ✔ | ✔ | ✔² |

¹ El `empleado` solo puede usar `PATCH /servicios-evento/:id`, y con
restricciones (ver "Panel del empleado"). El resto de esas rutas le responde 403.

² Solo sobre **sus** tareas. Si la tarea es de otro, 404 · `"Tarea no encontrada"`.

Además:

- Con token de `superadmin`, cualquier ruta de empresa responde
  403 · `"Esta seccion es solo para usuarios de una empresa"`.
- **Empresa suspendida** (`empresas.activo = false`):
  - sus usuarios no pueden loguearse;
  - si ya tenían un token, toda ruta de empresa (y también `/auth/perfil` y
    `/auth/password`) responde 403 con un campo `codigo`:

    ```json
    { "mensaje": "La empresa esta suspendida. Contacta al administrador del sistema", "codigo": "empresa_suspendida" }
    ```

    Es el único 403 que obliga a cerrar la sesión, y el front no compara
    textos: decide por `codigo`.
- **Rol y estado frescos:** el rol, la empresa y el empleado se leen de la base
  en cada pedido, no del token. Un cambio de rol corre desde el pedido
  siguiente. Si el usuario fue desactivado, su token responde
  401 · `"Token invalido"`.
- **El permiso va antes que el registro:** si el rol no alcanza para la ruta,
  responde 403 aunque el `:id` no exista. Así no se puede averiguar qué existe.
- **Eliminados:** `POST /auth/register` y `/api/empresas` completo. Responden
  404 · `"Ruta no encontrada"`.

---

## Autenticación (cambios)

### POST /auth/login

El objeto `usuario` suma un campo, `debe_cambiar_password`:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id_usuario": 9,
    "nombre": "Carla Ruiz",
    "email": "carla@eventosdelcentro.com",
    "rol": "empleado",
    "id_empresa": 1,
    "nombre_empresa": "Eventos del Centro",
    "id_empleado": 3,
    "debe_cambiar_password": true
  }
}
```

- `debe_cambiar_password` es `true` cuando la contraseña la puso otra persona
  (alta o reset hecho por un admin o el superadmin). El front obliga a
  cambiarla antes de seguir.
- Un `superadmin` recibe `id_empresa`, `nombre_empresa` e `id_empleado` en `null`.
- Un usuario de una empresa suspendida recibe 403 ·
  `"La empresa esta suspendida. Contacta al administrador del sistema"`. La
  contraseña se valida antes, así que no revela nada a quien no la conoce.

### GET /auth/perfil

El mismo objeto `usuario` del login.

### PUT /auth/password

**Acceso:** cualquier usuario logueado. Cambia su propia contraseña y pone
`debe_cambiar_password` en `false`.

Body:

```json
{ "password_actual": "temporal123", "password_nueva": "otraClave456" }
```

Respuesta 200:

```json
{ "mensaje": "Contrasena actualizada" }
```

Errores:

- 400 · `"La contrasena actual y la nueva son obligatorias"`
- 400 · `"La contrasena nueva tiene que tener al menos 6 caracteres"`
- 400 · `"La contrasena actual no es correcta"`
- 400 · `"La contrasena nueva tiene que ser distinta de la actual"`

---

## Panel de superadmin · `/api/superadmin`

**Acceso:** solo `superadmin`.

### GET /superadmin/resumen

Respuesta 200:

```json
{
  "empresas_activas": 3,
  "empresas_suspendidas": 1,
  "usuarios_activos": 14,
  "eventos_abiertos": 9,
  "eventos_proximos_30_dias": 5,
  "eventos_realizados": 22
}
```

### Objeto **EmpresaPanel**

Los datos y las métricas de una empresa, nunca su información operativa.

```json
{
  "id_empresa": 1,
  "nombre": "Eventos del Centro",
  "cuit": "30-71234567-8",
  "email": "contacto@eventosdelcentro.com",
  "telefono": "351-4001122",
  "direccion": "Av. Colón 1200, Córdoba",
  "activo": true,
  "fecha_creacion": "2026-10-01T12:00:00.000Z",
  "usuarios_activos": 4,
  "empleados_activos": 6,
  "clientes": 8,
  "eventos_abiertos": 3,
  "eventos_realizados": 6,
  "ultimo_evento_creado": "2026-10-18"
}
```

| Método | Ruta | Body | Respuesta |
| --- | --- | --- | --- |
| GET | `/superadmin/empresas?activo=&buscar=` | — | 200 · `[EmpresaPanel]` |
| GET | `/superadmin/empresas/:id` | — | 200 · `EmpresaPanel` + `usuarios` (lista de **Usuario**) |
| POST | `/superadmin/empresas` | `{ empresa: {...}, admin: { nombre, email, password } }` | 201 · igual que el GET por id |
| PUT | `/superadmin/empresas/:id` | `nombre`*, `cuit`*, `email`, `telefono`, `direccion` | 200 · `EmpresaPanel` |
| PATCH | `/superadmin/empresas/:id/activo` | `{ "activo": false }` | 200 · `EmpresaPanel` |
| DELETE | `/superadmin/empresas/:id` | — | 204 (solo sin datos operativos) |
| POST | `/superadmin/empresas/:id/usuarios` | `nombre`*, `email`*, `password`*, `rol`* | 201 · **Usuario** |
| PATCH | `/superadmin/empresas/:id/usuarios/:idUsuario` | `rol` y/o `activo` | 200 · **Usuario** |
| PUT | `/superadmin/empresas/:id/usuarios/:idUsuario/password` | `password_nueva`* | 200 · `{ "mensaje": "Contrasena actualizada" }` |

Detalles:

- **POST de empresa:**
  - crea la empresa y su `admin` en **una sola transacción**: si falla algo,
    no queda nada creado;
  - el admin nace con `debe_cambiar_password: true`;
  - obligatorios: `empresa.nombre`, `empresa.cuit`, `admin.nombre`,
    `admin.email` y `admin.password`.
- **Reset de contraseña:** deja `debe_cambiar_password: true`.
- **DELETE:** borra la empresa y sus usuarios. Si tiene cualquier otro dato
  (clientes, catálogos, personal, solicitudes...), no borra nada y responde 409 ·
  `"La empresa tiene datos asociados. Suspendela en lugar de eliminarla"`.
- **Usuarios de una empresa** (soporte): valen las mismas reglas que en
  `/usuarios`, más abajo, salvo "uno mismo" (el superadmin no es usuario de la
  empresa).
  - El POST no recibe `id_empleado`, porque el personal es información de la
    empresa. Por eso un usuario `empleado` se crea desde "Personal": acá
    responde 400 · `"Un usuario con rol empleado tiene que estar vinculado a un empleado"`.
  - El PATCH sin `rol` ni `activo` responde 400 · `"No hay datos para actualizar"`.
- **Métricas:**
  - `usuarios_activos` del resumen no cuenta a los superadmin;
  - eventos abiertos = `confirmado` o `en_preparacion`;
  - `eventos_proximos_30_dias` = abiertos con fecha entre hoy y hoy + 30;
  - el resumen suma todas las empresas, también las suspendidas;
  - `clientes` cuenta todos (activos e inactivos); `empleados_activos`, los
    que trabajan hoy en la empresa;
  - `ultimo_evento_creado` sale de `eventos.fecha_creacion` (`null` si no
    tiene eventos).
- **Filtros:** `?buscar=` busca en nombre y cuit. Un `?activo=` inválido se ignora.

Errores:

- 400 · `"El nombre y el cuit de la empresa son obligatorios"`
- 400 · `"El nombre, el email y la contrasena del administrador son obligatorios"`
- 400 · `"La contrasena tiene que tener al menos 6 caracteres"`
- 400 · `"Ya existe una empresa con ese cuit"`
- 400 · `"El email ya esta registrado"`
- 400 · `"El campo activo tiene que ser true o false"`

---

## Mi empresa · `/api/mi-empresa`

### GET /mi-empresa

**Acceso:** `admin`, `coordinador` y `empleado`. Devuelve solo la empresa del token.

Respuesta 200:

```json
{
  "id_empresa": 1,
  "nombre": "Eventos del Centro",
  "cuit": "30-71234567-8",
  "email": "contacto@eventosdelcentro.com",
  "telefono": "351-4001122",
  "direccion": "Av. Colón 1200, Córdoba",
  "fecha_creacion": "2026-10-01T12:00:00.000Z"
}
```

### PUT /mi-empresa

**Acceso:** solo `admin`. Edita `nombre`*, `email`, `telefono` y `direccion`.
El `cuit` solo lo cambia el superadmin: si viene en el body, se ignora.

Respuesta 200: el mismo objeto del GET.

- 400 · `"El nombre es obligatorio"`

---

## Personal con acceso al sistema · `/api/empleados` (cambios)

Es el panel donde la empresa da de alta a sus empleados y decide quién entra al
sistema y con qué rol.

El objeto **Empleado** de la Fase 2 suma el campo `acceso`:

```json
{
  "id_empleado": 3,
  "legajo": "L-003",
  "nombre": "Carla",
  "apellido": "Ruiz",
  "rol": "Coordinadora de tareas",
  "telefono": "353-4200003",
  "email": "carla@eventosdelcentro.com",
  "cargo": "Coordinadora de tareas",
  "fecha_inicio": "2025-06-15",
  "fecha_fin": null,
  "activo": true,
  "acceso": {
    "id_usuario": 9,
    "email": "carla@eventosdelcentro.com",
    "rol": "empleado",
    "activo": true
  }
}
```

- `acceso` es `null` si el empleado no tiene usuario.
- `empleados.rol` es el puesto, en texto libre. `acceso.rol` es el **permiso**
  en el sistema (`admin`, `coordinador` o `empleado`). Son cosas distintas.

### POST /empleados (cambia)

**Acceso:** solo `admin`. Acepta un bloque `acceso` opcional. Si viene, crea el
empleado, su vínculo con la empresa y su usuario en **una sola transacción**.

```json
{
  "legajo": "L-010",
  "nombre": "Carla",
  "apellido": "Ruiz",
  "email": "carla@eventosdelcentro.com",
  "cargo": "Coordinadora de tareas",
  "acceso": {
    "email": "carla@eventosdelcentro.com",
    "password": "temporal123",
    "rol": "empleado"
  }
}
```

Respuesta 201: **Empleado** (con `acceso`).

### POST /empleados/:id/acceso (nuevo)

**Acceso:** solo `admin`. Le da acceso a un empleado que ya existe.

Body:

```json
{ "email": "carla@eventosdelcentro.com", "password": "temporal123", "rol": "coordinador" }
```

Respuesta 201: **Empleado** (con `acceso`).

- 409 · `"El empleado ya tiene acceso al sistema"`
- 409 · `"El empleado no esta activo en la empresa"`

Para cambiar el rol, desactivar el acceso o resetear la contraseña se usa
`/usuarios`.

Errores comunes del bloque `acceso`:

- 400 · `"El email, la contrasena y el rol del acceso son obligatorios"`
- 400 · `"La contrasena tiene que tener al menos 6 caracteres"`
- 400 · `"Rol invalido"` (solo `admin`, `coordinador` o `empleado`)
- 400 · `"El email ya esta registrado"`

**Baja de un empleado** (`PATCH /empleados/:id/activo` con `false`): también
desactiva su usuario, si tiene, en la misma transacción.

- Valen las reglas de usuarios: si su usuario es el último admin activo, o es
  el propio admin que hace la baja, no se hace nada y responde el 409 que
  corresponde (ver `/usuarios`).
- **Reactivar** al empleado no reactiva su usuario: devolverle el acceso es una
  decisión aparte, que se toma en `/usuarios`.

---

## Usuarios de mi empresa · `/api/usuarios`

**Acceso:** solo `admin`. Todo se filtra por la empresa del token.

Objeto **Usuario**:

```json
{
  "id_usuario": 9,
  "nombre": "Carla Ruiz",
  "email": "carla@eventosdelcentro.com",
  "rol": "empleado",
  "activo": true,
  "id_empleado": 3,
  "nombre_empleado": "Carla Ruiz",
  "debe_cambiar_password": true,
  "fecha_creacion": "2026-10-22T20:00:00.000Z"
}
```

| Método | Ruta | Acción | Respuesta |
| --- | --- | --- | --- |
| GET | `/usuarios?activo=&rol=&buscar=` | Listar (búsqueda por nombre y email) | 200 · `[Usuario]` |
| GET | `/usuarios/:id` | Obtener uno | 200 · `Usuario` |
| POST | `/usuarios` | Crear un usuario sin empleado (por ejemplo, un socio) | 201 · `Usuario` |
| PUT | `/usuarios/:id` | Editar `nombre`, `email`, `rol` e `id_empleado` | 200 · `Usuario` |
| PATCH | `/usuarios/:id/activo` | `{ "activo": false }` | 200 · `Usuario` |
| PUT | `/usuarios/:id/password` | Reset: `{ "password_nueva": "..." }`. Deja `debe_cambiar_password: true` | 200 · `{ "mensaje": "Contrasena actualizada" }` |

Reglas:

- **Roles:** solo `admin`, `coordinador` o `empleado`. Nunca `superadmin`.
- **Rol `empleado`:** tiene que estar vinculado a un empleado (`id_empleado`),
  porque sin eso no tiene tareas.
  - 400 · `"Un usuario con rol empleado tiene que estar vinculado a un empleado"`
- **Vínculo con un empleado:** si viene `id_empleado`, tiene que ser un empleado
  activo de la empresa y no estar vinculado a otro usuario.
- **Uno mismo:** un admin no puede desactivarse ni quitarse el rol `admin` a sí mismo.
- **Último admin:** siempre queda al menos un `admin` activo en la empresa.
- **Contraseña puesta por otro:** todo usuario creado acá, desde el panel de
  superadmin o con el `acceso` de Personal nace con `debe_cambiar_password: true`.
- **PUT** reemplaza los cuatro campos: si `id_empleado` no viene, el usuario
  queda sin vínculo (salvo que el rol sea `empleado`, que da 400).
- **Activar** un usuario cuyo empleado está dado de baja responde 400 ·
  `"El empleado no existe o no esta activo en la empresa"`.
- Filtros inválidos (`?rol=jefe`) se ignoran, como en los demás listados.

Errores:

- 400 · `"El nombre, el email, la contrasena y el rol son obligatorios"` (POST)
- 400 · `"El nombre, el email y el rol son obligatorios"` (PUT)
- 400 · `"El campo activo tiene que ser true o false"`
- 400 · `"La contrasena tiene que tener al menos 6 caracteres"` (también en el
  reset, si `password_nueva` no viene o es corta)
- 400 · `"Rol invalido"`
- 400 · `"El email ya esta registrado"`
- 400 · `"El empleado no existe o no esta activo en la empresa"`
- 400 · `"Ese empleado ya esta vinculado a otro usuario"`
- 409 · `"No podes desactivarte ni quitarte el rol de admin a vos mismo"`
- 409 · `"La empresa tiene que tener al menos un admin activo"`

---

## Panel del empleado

El `empleado` trabaja solo con estas tres rutas.

### GET /tareas/mias (cambia)

Para cualquier rol devuelve las tareas del empleado vinculado al usuario. Cada
**Tarea** conserva todos los campos de antes (el objeto Tarea más
`nombre_cliente`, `nombre_tipo_evento` y `fecha_evento_confirmada`) y suma los
datos del evento y del proveedor que el empleado necesita para trabajar,
**sin importes**. En el ejemplo van solo los campos nuevos y los principales:

```json
{
  "id_tarea": 5,
  "descripcion": "Confirmar asistencia de Deco Fiestas",
  "nombre_tipo_tarea": "Confirmar asistencia del proveedor",
  "orden": 2,
  "fecha_prevista": "2026-10-25",
  "fecha_finalizacion": null,
  "estado_tarea": "en_curso",
  "observaciones": null,
  "vencida": false,
  "puede_avanzar": true,
  "evento": {
    "id_evento": 1,
    "nombre_tipo_evento": "Casamiento",
    "nombre_cliente": "Lucía Fernández",
    "fecha_evento_confirmada": "2026-11-14",
    "sede_acordada": "Estancia El Molino",
    "estado": "en_preparacion",
    "nombre_coordinador": "Ana Gómez"
  },
  "servicio": {
    "id_servicio_x_evento": 2,
    "nombre_servicio": "Decoración",
    "descripcion": "Ambientación de salón y ceremonia",
    "estado_proveedor": "solicitada",
    "fecha_confirmacion_proveedor": null,
    "observaciones": null,
    "proveedor": {
      "id_proveedor": 3,
      "razon_social": "Deco Fiestas",
      "telefono": "351-5551002",
      "email": "hola@decofiestas.com"
    },
    "pasos": [
      { "orden": 1, "nombre_tipo_tarea": "Contactar al proveedor", "estado_tarea": "completada" },
      { "orden": 2, "nombre_tipo_tarea": "Confirmar asistencia", "estado_tarea": "en_curso" },
      { "orden": 3, "nombre_tipo_tarea": "Seguimiento previo", "estado_tarea": "pendiente" },
      { "orden": 4, "nombre_tipo_tarea": "Cierre del servicio", "estado_tarea": "pendiente" }
    ]
  }
}
```

- `servicio` es `null` en las tareas libres. `servicio.proveedor` es `null` si
  el servicio no tiene proveedor asignado.
- `servicio.pasos` es la secuencia completa del servicio, ordenada, para el
  `Steps` del front. No dice quién es responsable de cada paso (`[]` si el
  servicio todavía no tiene tareas generadas).
- `puede_avanzar` es `false` si el paso anterior de la secuencia no está
  completado, aunque ese paso sea de otro empleado. Así el front deshabilita el
  cambio de estado y muestra por qué. En las tareas libres es siempre `true`.
  Que la tarea ya esté completada se ve en `estado_tarea`.
- Solo trae tareas de eventos abiertos. Filtros: `?estado_tarea=` y
  `?vencidas=true`. Un filtro inválido se ignora.

### PATCH /tareas/:id/estado (cambia)

- **`empleado`:** solo puede cambiar el estado de **sus** tareas. Si no es el
  responsable, 404 · `"Tarea no encontrada"`.
- **`admin` y `coordinador`:** pueden cambiar cualquier tarea de la empresa, como antes.
- La regla de secuencia (regla 5) vale para todos.

### PATCH /servicios-evento/:id (cambia)

- **`empleado`:** puede **gestionar el proveedor** solo si es responsable de al
  menos una tarea de ese servicio. Si no, 404 · `"Servicio no encontrado"`.
  Solo puede modificar `estado_proveedor` y `observaciones`.
  - Si manda otro campo (`id_proveedor`, `costo_acordado_proveedor`,
    `importe_acordado_cliente`), responde 403 ·
    `"Solo podes actualizar el estado y las observaciones del proveedor"`.
    Este chequeo va antes que el 404: un 403 no revela si el servicio existe.
  - La respuesta no incluye importes ni costos: devuelve el objeto `servicio`
    con el formato de `/tareas/mias`.
- **`admin` y `coordinador`:** sin cambios respecto de la Fase 6.

---

## Cambios en la base para esta fase

- `usuarios.rol`: el CHECK pasa a `('superadmin', 'admin', 'coordinador', 'empleado')`.
  Los usuarios con rol `usuario` del seed pasan a `coordinador`.
- `usuarios.id_empresa` acepta `NULL`, con este CHECK:
  - si el rol es `superadmin`: `id_empresa` e `id_empleado` en `NULL`;
  - si es otro rol: `id_empresa` obligatorio;
  - si el rol es `empleado`: `id_empleado` obligatorio.
- Nueva columna `usuarios.debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE`.
- Índice único parcial sobre `usuarios(id_empleado)` cuando no es `NULL`: un
  empleado tiene a lo sumo un usuario.
- Nueva columna `eventos.fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()`, para
  la métrica `ultimo_evento_creado` del panel de superadmin.
- Para una base que ya tiene datos, `npm run db:actualizar` aplica estos
  cambios sin borrar nada (y pasa los `usuario` a `coordinador`). No crea un
  superadmin: hay que insertarlo a mano (ver el README de `api-eventos`).
- Seed (contraseña `admin123` en todos):
  - un superadmin: `soporte@eventosapp.com`;
  - en la empresa 1, un usuario de cada rol: admin, coordinador y empleado. El
    empleado tiene tareas con proveedor y tareas libres;
  - una cuarta empresa **suspendida**, con su admin.
  - La lista completa de usuarios de prueba está en el README de `api-eventos`.

---

## Historial de cambios del contrato

| Fecha | Fase | Cambio | Avisado al front |
| --- | --- | --- | --- |
| 2026-10-20 | 1 a 8 | Versión inicial completa, alineada con el `schema.sql` de la Fase 1 | ✔ |
| 2026-10-20 | 3 | Mensajes de error sin tildes (`"El cliente no existe o esta inactivo"`, `"El tipo de evento no existe o esta inactivo"`, `"Estado invalido"`), como pide la convención. Se aclara que una fecha con formato inválido responde el 400 de obligatorios y que los filtros inválidos del listado se ignoran | ✘ |
| 2026-10-20 | 4 | Mensajes sin tildes. Errores nuevos: 400 de `validez_dias`, 409 `"Solo se puede crear una nueva version desde la ultima version"` y 409 de solicitud cerrada al presentar o crear una versión. Al presentar, `fecha_emision` pasa a ser hoy. La nueva versión copia `validez_dias` y `observaciones`. Un proveedor inactivo responde "no ofrece ese servicio" | ✘ |
| 2026-10-20 | 5 | Mensajes sin tildes (`"El evento esta cerrado..."`, `"...iniciar la preparacion..."`). Aceptar responde 409 `"La solicitud esta <estado> y no admite presupuestos"` si la solicitud está cerrada. Se aclara que el coordinador es opcional, que la validez vencida no impide aceptar y que el PUT reemplaza el objeto completo | ✘ |
| 2026-10-20 | 6 | Mensajes sin tildes. Reabrir un paso completado se bloquea también hacia `en_curso` (no solo hacia `pendiente`) si el siguiente ya empezó. Se aclara: fecha de confirmación y de finalización se conservan si se repite el estado, `id_proveedor: null` desasigna, body vacío en el PATCH responde 200, dos pasos pueden tener la misma fecha | ✘ |
| 2026-10-20 | 7 | Se aclara el alcance de `?dias` (solo los próximos; acepta de 1 a 365, inválido = 30) y que `total_tareas` incluye las tareas libres. Sin cambios en los campos | ✘ |
| 2026-10-20 | 8 | Mensajes sin tildes. Se aclara: no se valida la fecha al marcar `realizado`, un texto hecho solo de espacios cuenta como vacío y el feedback es parcial | ✘ |
| 2026-10-20 | 9 | Revisión final. Errores generales documentados (401, `:id` inválido → 404, `"Hay datos con un formato invalido"`, JSON inválido, `"Ruta no encontrada"`). Todo 500 responde `"Error interno del servidor"` (empresas y auth tenían textos propios). Mensajes exactos de obligatorios de los catálogos. `nombre_cliente` no agrega el `-` de los clientes empresa. Pendientes de la Fase 1 cerrados | ✘ |
| 2026-10-22 | 10 | Superadmin y roles `admin`, `coordinador` y `empleado` con tabla de permisos. Se eliminan `POST /auth/register` y `/api/empresas`. Nuevos: `/auth/password`, `/superadmin/*`, `/mi-empresa`, `/usuarios` y `POST /empleados/:id/acceso`. Cambian: login (`debe_cambiar_password`, 403 si la empresa está suspendida), `POST /empleados` (bloque `acceso`), `/tareas/mias` (evento y proveedor), y los permisos de `PATCH /tareas/:id/estado` y `PATCH /servicios-evento/:id` para el empleado | ✘ |
| 2026-10-22 | 10 | **Implementada.** Agregados al contrato: 403 de empresa suspendida con `codigo: "empresa_suspendida"` (también en `/auth/perfil` y `/auth/password`); rol y estado leídos de la base en cada pedido (usuario desactivado → 401); 403 antes que 404; `/tareas/mias` conserva los campos de antes y suma `servicio.pasos`; definición de `puede_avanzar` y de las métricas; `eventos.fecha_creacion`; el superadmin no crea usuarios `empleado`; PATCH de soporte vacío → 400; mensaje del PUT de `/usuarios`; reglas de la baja del empleado y de activar un usuario con el empleado de baja; texto demasiado largo → 400 de formato | ✘ |

### Pendientes del back sobre la Fase 1 ya implementada

- [x] `POST /auth/login` devuelve `usuario.id_usuario`, igual que `/auth/perfil`
      y el registro.
- [x] `src/data/db.js` tiene los `setTypeParser` de fechas (1082) y montos (1700).
- [x] `DELETE /empresas/:id` con datos asociados responde 409 (error `23503`).
