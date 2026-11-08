# Base de datos · DER y script SQL

DER actualizado al 08/11/2026, después de la Fase 11 y de las validaciones con el
cliente. Se generó directamente desde `schema.sql`, así que coincide con la base.

| Archivo | Qué es |
| --- | --- |
| [DER.png](DER.png) | El diagrama como imagen, para verlo o imprimirlo |
| [DER.svg](DER.svg) | El mismo diagrama, con zoom sin perder calidad |
| [DER.dot](DER.dot) | La fuente en Graphviz, por si hay que regenerarlo |
| [schema.sql](../../api-eventos/database/schema.sql) | Crea las 20 tablas, sus relaciones, restricciones e índices |
| [seed.sql](../../api-eventos/database/seed.sql) | Datos de prueba de 4 empresas (contraseña de todos: `admin123`) |

En el DER, **lo verde es lo nuevo desde el DER de la Fase 10**. Las relaciones grises
son las de `id_empresa`, que está en todas las tablas raíz: van más suaves para que no
tapen el resto.

## Cómo poner la base al día

**Si ya tenés una base con datos**, desde `api-eventos`:

```bash
npm run db:actualizar
```

Hace un respaldo en `laboratorio-bd/respaldos`, agrega lo nuevo y conserva todos los
registros. Se puede correr más de una vez.

**Si querés una base nueva desde cero:**

```bash
psql -U postgres -c "CREATE DATABASE eventos;"
psql -U postgres -d eventos -f api-eventos/database/schema.sql
psql -U postgres -d eventos -f api-eventos/database/seed.sql
```

`schema.sql` empieza borrando todas las tablas: no lo corras sobre una base con datos
que quieras conservar.

## Qué cambió desde la Fase 10

**Tablas nuevas**

| Tabla | Para qué |
| --- | --- |
| `sedes` | Catálogo de salones de cada empresa. Un salón no se ocupa dos veces el mismo día |
| `cambios_evento` | Historial de lo que cambia después de confirmar, con motivo, quién y cuándo |
| `afectados_cambio` | Servicios y tareas que un cambio dejó "a revisar", y su revisión |
| `cambios_estado_tarea` | Por qué estados pasó cada tarea, quién la cambió y cuándo |

**Columnas nuevas**

| Columna | Para qué |
| --- | --- |
| `solicitudes.id_sede`, `eventos.id_sede` | El salón del catálogo. Si lo reservó el cliente, va en `NULL` y el lugar se escribe en `sede_prevista` o `sede_acordada` |
| `presupuestos.token_publico` | El código del link que se le manda al cliente |
| `presupuestos.respuesta_cliente`, `fecha_respuesta_cliente`, `comentario_cliente` | Lo que el cliente respondió desde el link |
| `eventos.cantidad_asistentes` | Los asistentes acordados, que pueden cambiar después de confirmar |
| `servicios_x_evento.estado_servicio` | `acordado` o `cancelado`: un servicio se cancela, no se borra |
| `tareas.fecha_primera_finalizacion` | La primera vez que se terminó, aunque después se reabra |
| `afectados_cambio.cambios_revision` | Qué se actualizó al revisar, en palabras |

**Estados y reglas**

- `tareas.estado_tarea` suma `cancelada`.
- `servicios_x_evento.estado_proveedor` pasó a `pendiente`, `confirmado`, `completado` y `rechazado`.
- Índices únicos `uq_*` para no repetir datos: clientes por DNI/CUIT, proveedores por
  CUIT y razón social, servicios, tipos de evento y sedes por nombre, usuarios por email,
  solicitudes abiertas iguales y un salón por día (`uq_eventos_sede_dia`).

No se quitó ninguna columna. Lo que **no** está en la base porque se calcula en cada
consulta: tarea vencida, no realizada o a revisar, el total acordado del evento y los
indicadores del tablero. El porqué de cada decisión está en
[DECISIONES.md](../DECISIONES.md).
