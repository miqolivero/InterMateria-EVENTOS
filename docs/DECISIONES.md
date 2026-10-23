# Decisiones de diseño

Este documento explica **por qué** el sistema está hecho como está. Cada sección
cuenta el problema, la decisión que se tomó, las alternativas que se
descartaron y dónde se ve en el código. Las reglas de negocio numeradas
(regla 1, regla 2...) son las del `CLAUDE.md` de la raíz.

---

## 1. Multitenant: una base, varias empresas

**Problema.** Varias organizadoras usan el mismo sistema, y ninguna puede ver ni
tocar los datos de otra.

**Decisión.** Una sola base de datos compartida. Cada fila "raíz" lleva su
`id_empresa` (`clientes`, `servicios`, `proveedores`, `tipos_eventos`,
`solicitudes`, `eventos`, `usuarios`) y la empresa del usuario viaja **dentro
del token JWT**. Todos los controladores filtran con `req.usuario.id_empresa`,
**nunca** con un valor del body o de la URL.

- Las tablas "hijas" (`presupuestos`, `detalle_presupuesto`,
  `servicios_x_evento`, `tareas`) no repiten `id_empresa`: heredan la de su
  padre y se filtran por `JOIN` (por ejemplo, un presupuesto es de la empresa de
  su solicitud). Repetir la columna abriría la puerta a que las dos queden
  distintas.
- Pedir un registro de otra empresa responde **404, no 403**: así no se revela
  que ese id existe.
- Cuando el body trae un id de otra tabla (el cliente de una solicitud, el
  proveedor de un renglón, el responsable de una tarea), se verifica que sea de
  la misma empresa antes de grabar (`existeEnEmpresa`, `esEmpleadoActivo` en
  `src/utils/consultas.js`).
- Los empleados son la excepción: un mismo empleado puede trabajar para más de
  una empresa a lo largo del tiempo, así que la relación es N:M con historial
  (`empleados_x_empresa`, con `fecha_inicio` y `fecha_fin`).

**Alternativas descartadas.** Una base (o un esquema) por empresa aísla más,
pero multiplica las migraciones y no se justifica para el tamaño del proyecto.
Mandar `id_empresa` desde el front sería trivial de falsificar.

---

## 2. Presupuestos con versiones

**Problema.** El cliente pide cambios después de ver una propuesta, y hay que
saber qué se le mostró en cada momento.

**Decisión.** Un presupuesto **solo se edita en `borrador`** (regla 3). Una vez
presentado queda congelado: para cambiarlo se crea una **nueva versión** que
copia la cabecera y el detalle, toma `numero_version + 1` y deja la anterior en
`reemplazado` (o `rechazado`, si el cliente la rechazó). Todo en una sola
transacción.

- `UNIQUE (id_solicitud, numero_version)` en la base impide dos versiones con el
  mismo número.
- Solo se versiona desde la **última** versión, y nunca si ya hay un borrador
  abierto: así nunca hay dos versiones "vivas" de la misma solicitud.
- La `fecha_emision` pasa a ser la de hoy al **presentar**, porque la validez
  se cuenta desde que el cliente recibe la propuesta.

**Alternativa descartada.** Editar el presupuesto presentado y guardar un log
de cambios: el historial quedaría en otra tabla y sería mucho más difícil
mostrar "la versión 1 tal como la vio el cliente".

---

## 3. Costo del proveedor vs. importe al cliente

**Problema.** Lo que cobra el proveedor y lo que se le cobra al cliente son
distintos, y el cliente pidió explícitamente que **no haya una fórmula** de
recargo.

**Decisión.** Cada renglón guarda los dos montos por separado
(`costo_proveedor` e `importe_cliente`), cargados a mano. El margen
(`importe − costo`) **se calcula en el SQL**, no se guarda.

- El `importe_total` del presupuesto sí se guarda, pero lo calcula siempre la
  API (regla 2): se recalcula como `SUM(importe_cliente)` en la misma
  transacción que modifica un renglón, y se ignora si llega en el body.
- Al aceptar el presupuesto, los montos se copian a `servicios_x_evento` como
  `costo_acordado_proveedor` e `importe_acordado_cliente`: lo **acordado** puede
  cambiar después (por ejemplo, si se cambia de proveedor) sin tocar lo
  **presupuestado**.
- Los montos son `NUMERIC(12,2)` en la base (nunca `FLOAT`, que redondea mal el
  dinero) y viajan como número en el JSON.

---

## 4. Tarea interna ≠ compromiso del proveedor

**Problema.** Fue lo que más remarcó el cliente en el relevamiento: que el
empleado haya completado "Confirmar asistencia del proveedor" no significa que
el proveedor haya confirmado.

**Decisión.** Son **dos estados separados** que no se pisan (regla 6):

- `tareas.estado_tarea` (`pendiente` → `en_curso` → `completada`) es el trabajo
  del personal.
- `servicios_x_evento.estado_proveedor` (`solicitada` → `confirmada` →
  `en_seguimiento` → `finalizada`, o `rechazada`) es el compromiso del
  proveedor. Solo cambia con `PATCH /servicios-evento/:id`.

Completar una tarea **no** cambia el estado del proveedor, y al revés. En el seed
se ve en la fotografía del evento 1: las tareas de contacto y confirmación están
completadas, pero el proveedor sigue en `solicitada`.

---

## 5. Secuencia de tareas con el proveedor

**Problema.** Con cada proveedor hay 4 pasos que tienen sentido en orden:
contactar, confirmar asistencia, seguimiento previo y cierre.

**Decisión.** Los pasos son una tabla fija, `tipos_tarea`, con un `orden`
`UNIQUE`. "Generar tareas" crea los 4 de una vez (transacción: o los 4, o
ninguno). Al cambiar el estado se aplica la regla 5:

- un paso no pasa a `en_curso` ni a `completada` si el anterior no está
  completado → 409 `"Primero hay que completar: <paso anterior>"`;
- un paso completado no se puede reabrir si el siguiente ya empezó → 409. Esto
  no lo decía el contrato original, pero sin esa regla se podía romper la
  secuencia "desde atrás".

El cambio de estado va en una transacción que **bloquea todas las tareas del
servicio, siempre en el mismo orden** (`SELECT ... FOR UPDATE`). Si se bloqueara
solo la tarea, dos personas cambiando el paso 1 y el 2 a la vez podrían romper
la secuencia; y si se bloqueara primero la tarea y después el resto, podrían
quedar esperándose entre sí (deadlock).

Las tareas libres (trabajo interno, sin tipo) no entran en la secuencia.

---

## 6. "Vencida" se calcula, no se guarda

**Problema.** Una tarea está vencida si su fecha prevista ya pasó y no está
completada. Ese estado cambia solo con el paso del tiempo.

**Decisión.** No hay columna `vencida` (regla 1). Se calcula en cada consulta:

```sql
t.fecha_prevista IS NOT NULL
AND t.fecha_prevista < CURRENT_DATE
AND t.estado_tarea <> 'completada'
```

La condición está escrita **una sola vez** (`CONDICION_VENCIDA` en
`tareas.controller.js`) y la usan el listado de tareas, "mis tareas" y el
tablero, así todos cuentan exactamente lo mismo.

**Alternativa descartada.** Guardar un booleano obligaría a correr un proceso
todas las noches para actualizarlo, y entre corrida y corrida el dato estaría
mal.

Con el mismo criterio se calculan en SQL el margen, los totales del tablero, el
`porcentaje_avance`, `editable`, `dias_restantes` y `paso_actual`.

---

## 7. Baja lógica

**Problema.** Un cliente, proveedor o empleado que ya no se usa tiene historial:
presupuestos, eventos y tareas que lo nombran.

**Decisión.** No hay `DELETE` en los catálogos: se desactivan con
`PATCH /:id/activo` (`activo = false`). En empleados, la baja cierra el vínculo
con la empresa (`fecha_fin` = hoy).

- Un registro inactivo **sigue apareciendo** en lo histórico (un evento viejo
  muestra su proveedor), pero **no se puede usar en algo nuevo**: una solicitud
  no acepta un cliente inactivo, ni un renglón un proveedor inactivo, ni una
  tarea un responsable dado de baja.
- Las únicas eliminaciones físicas son los renglones de un presupuesto en
  borrador, las tareas libres y las empresas sin datos (con datos, 409).

---

## 8. Transacciones y bloqueos

Cada operación que escribe en más de una fila o tabla va en una transacción
(`BEGIN` / `COMMIT` / `ROLLBACK`, y `client.release()` en el `finally`):

| Operación | Qué agrupa |
| --- | --- |
| Aceptar un presupuesto (regla 4) | presupuesto aceptado, otras versiones reemplazadas, solicitud aceptada, evento creado, servicios copiados |
| Nueva versión | versión nueva, copia del detalle, total, versión anterior reemplazada |
| Renglones del presupuesto | el renglón y el recálculo del total |
| Presentar | presupuesto presentado y solicitud presupuestada |
| Generar tareas | las 4 tareas de la secuencia |
| Cambiar el estado de una tarea | el chequeo de la secuencia y el cambio |
| Cancelar un evento | evento cancelado y solicitud cancelada |
| Servicios de un proveedor | borrar la lista vieja e insertar la nueva |

La regla 4 se probó **forzando un error a mitad de la transacción**, con un
trigger temporal en la base: la API respondió 500 y no quedó nada a medias.

Dentro de la transacción se bloquea la fila que se va a validar
(`SELECT ... FOR UPDATE`), para que entre "chequear el estado" y "modificar"
nadie lo cambie. Cuando alcanza con una sola sentencia, el estado va
directamente en el `WHERE` del `UPDATE` (por ejemplo,
`... WHERE id = $1 AND estado = 'presentado'`), que en PostgreSQL ya es atómico.

Las secuencias de PostgreSQL no vuelven atrás con un `ROLLBACK`: si una
operación falla, ese id queda sin usar. Por eso puede haber huecos en los ids, y
es normal.

---

## 9. Validaciones y códigos HTTP

- **400** cuando el pedido está mal: faltan datos, formatos inválidos, un id de
  otra empresa en el body, duplicados.
- **404** cuando el registro de la URL no existe, es de otra empresa **o tiene un
  formato imposible** (`/clientes/abc`). Un `router.param` valida el `:id`
  antes de llegar al controlador (`src/middlewares/validarId.middleware.js`).
- **409** cuando el pedido es válido pero choca con el estado actual: editar un
  presupuesto presentado, saltear un paso de la secuencia, modificar un evento
  cerrado.
- **500** solo para errores nuestros, con un mensaje genérico (nunca el detalle de
  la base).

El orden de los chequeos es siempre el mismo: primero el formato del body (400),
después si existe (404), después el estado (409) y al final lo que necesita
consultar otras tablas (400). Los filtros inválidos de un listado (`?desde=hola`)
se ignoran en vez de dar error.

Como red de seguridad, `responderError` traduce a 400 los errores de formato de
PostgreSQL (`22P02`, `22003`, `22007`, `22008`) y un manejador final convierte un
body que no es JSON en un 400 con `{ mensaje }`. En la revisión final se mandó una
batería de casi 200 pedidos mal formados a todas las rutas y ninguno responde 500.

Las fechas se comparan contra `CURRENT_DATE` **en la base**, no en JavaScript,
para que "hoy" no dependa de la zona horaria del servidor.

---

## 10. Otras decisiones

- **Sin ORM.** El SQL se escribe a mano y siempre parametrizado (`$1, $2...`).
  Es lo que pide la materia, y deja ver exactamente qué consulta corre cada
  endpoint.
- **El `id_empleado` no viaja en el token.** "Mis tareas" lo busca en `usuarios`
  en cada pedido: si cambia el vínculo, se ve sin tener que volver a loguearse.
- **El tablero** solo mira eventos abiertos. `?dias` cambia la ventana de los
  "próximos", pero las tareas vencidas y los servicios sin confirmar son de
  todos los eventos abiertos, para que el número de cada tarjeta coincida con su
  lista.
- **Clientes empresa.** La razón social va en `nombre` y el apellido es `-`. Al
  armar `nombre_cliente` se saltea el guion (`"Grupo Andes SA"`, no
  `"Grupo Andes SA -"`).
- **Mensajes de error sin tildes**, como pide la convención del contrato. El
  front muestra el mensaje tal cual y decide por el código HTTP, nunca por el
  texto.

## 11. El superadmin solo ve métricas (Fase 10)

El panel de superadmin muestra los datos de contacto de cada empresa y
**cantidades** (usuarios, empleados, clientes, eventos abiertos y realizados),
nunca un cliente, una solicitud, un evento o una tarea. Todas sus consultas son
`COUNT` y `MAX` (`superadmin.controller.js`), y el middleware `soloEmpresa`
rechaza su token en cualquier ruta de datos operativos.

**Por qué:** los datos de los clientes de cada empresa son de esa empresa, no
nuestros. Para operar el sistema (dar de alta una organizadora, suspenderla,
ayudar a un usuario que perdió la contraseña) no hace falta verlos, así que
no los vemos. Es el principio de mínimo privilegio aplicado a nosotros mismos.
Además, el superadmin no tiene `id_empresa`: si se colara en una consulta
operativa, el filtro multitenant quedaría con `NULL`.

## 12. Las cuentas las crea la empresa, no hay registro público (Fase 10)

Se eliminaron `POST /auth/register` y el listado público de empresas. El
superadmin crea la empresa junto con su admin (en una transacción), y el admin
da de alta a su personal en "Personal", eligiendo el rol de cada uno. Quien
recibe una contraseña puesta por otro la tiene que cambiar al entrar
(`debe_cambiar_password`).

**Por qué:** con el registro público cualquiera podía crearse un usuario en la
empresa que eligiera de una lista, y esa lista revelaba qué empresas usan el
sistema. Ninguna empresa debería saber que existen las otras. Además, el que
sabe quién trabaja en la empresa es su admin: es quien tiene que decidir quién
entra y con qué permiso. La contraseña temporal obligatoria evita que el admin
conozca la contraseña definitiva de sus empleados.

## 13. El empleado no ve importes (Fase 10)

El rol `empleado` solo ve sus tareas, con los datos del evento y del proveedor
que necesita para trabajar, pero ningún costo ni importe. Se garantiza en tres
capas:

1. **Por ruta:** solo llega a login, perfil, cambio de contraseña, Mi empresa,
   `/tareas/mias`, `PATCH /tareas/:id/estado` y `PATCH /servicios-evento/:id`.
   Todo lo demás responde 403 (`permitirRoles` en `index.js`).
2. **Por consulta:** esas respuestas se arman campo por campo con
   `json_build_object`, sin `SELECT *`, así una columna nueva no se cuela.
3. **Por registro:** el filtro "solo lo suyo" va en el `WHERE` (una tarea de
   otro responde 404, igual que una de otra empresa). Si mandara un campo de
   importes en el PATCH del servicio, responde 403 antes de mirar la base.

**Por qué:** los márgenes de la empresa (lo que paga al proveedor y lo que
cobra al cliente) son información comercial sensible, y al empleado no le
hacen falta para su jornada. El filtro va en el `WHERE` y no en un `if`
después de la consulta porque así es imposible que la fila ajena llegue al
código: no hay un camino que se olvide de chequear.
