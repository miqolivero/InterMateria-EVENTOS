# Arquitectura y funcionamiento

Este documento describe la aplicación actual. Para ejecutar una copia nueva,
seguir [Instalación](docs/INSTALACION.md). Los campos y respuestas completos
están en [el contrato de la API](docs/API.md).

## Componentes

```text
Navegador · React/Vite :5173
        │ HTTP y token JWT
        ▼
API · Express :3000/api
        │ consultas SQL parametrizadas
        ▼
PostgreSQL :5432 · base configurada en DB_NAME
```

| Carpeta | Responsabilidad |
| --- | --- |
| `front-eventos/src/paginas` | Pantallas de catálogos, solicitudes, presupuestos, eventos y seguimiento |
| `front-eventos/src/componentes` | Layout, protección de rutas y formularios reutilizables |
| `front-eventos/src/contexto` | Sesión, consultas y acciones de la interfaz |
| `front-eventos/src/servicios` | Llamadas HTTP mediante una instancia axios con token |
| `api-eventos/src/routes` | Rutas, autenticación y validación de identificadores |
| `api-eventos/src/controllers` | Validaciones, operaciones y transacciones de negocio |
| `api-eventos/src/data` | Pool PostgreSQL y conversión de fechas/importes |
| `api-eventos/src/utils` | Consultas y validaciones compartidas, respuestas de error |
| `api-eventos/database` | Esquema completo y seed de demostración |
| `api-eventos/scripts` | Actualización de la base antigua con respaldo previo |

No hay ORM ni infraestructura Docker en la versión actual. Los datos reales
se guardan en PostgreSQL; el navegador conserva el token y un perfil de sesión.

## Acceso y separación de empresas

El registro envía nombre, email, contraseña e `id_empresa` a
`POST /api/auth/register`. La empresa debe existir y estar activa. La API
guarda la contraseña con bcrypt y crea una cuenta con rol `usuario`.

El login compara ese hash y emite un JWT. Su contenido incluye el usuario,
el rol y la empresa. El frontend lo envía como `Authorization: Bearer …` y
verifica el perfil al entrar o recargar. Un 401 de una operación protegida
cierra la sesión; un 401 del login se muestra en el formulario.

Solo `/login` y `/registro` son pantallas públicas. Sin sesión, las demás
rutas redirigen al login y conservan la dirección solicitada. El guard de React
controla la navegación; la autorización real está en la API.

La API toma la empresa del token y filtra las operaciones de negocio por ella.
Los formularios no eligen otra empresa. El catálogo de empresas es público
para permitir el registro; su administración requiere el rol correspondiente.

## Circuito de trabajo

1. Configurar clientes, tipos de evento, servicios, proveedores y personal.
2. Registrar una solicitud con cliente, fecha, tipo y cantidad de asistentes.
3. Preparar un presupuesto con renglones, costos de proveedor e importes al
   cliente. La API calcula los totales; la cantidad es informativa.
4. Presentar la propuesta y, cuando corresponda, crear una nueva versión.
5. Aceptar el presupuesto: una transacción crea el evento y copia sus servicios.
6. Seguir por separado el compromiso del proveedor y las tareas del personal.
   Cada servicio puede tener cuatro tareas secuenciales; también hay tareas libres.
7. Revisar en el tablero próximos eventos, tareas vencidas y servicios sin confirmar.
8. Realizar o cancelar el evento con las validaciones del contrato. Un evento
   cerrado queda sin edición operativa; el realizado permite feedback del cliente.

Una tarea completada no significa que un proveedor esté confirmado. Los
estados de ambos se guardan por separado. El estado vencido de una tarea se
calcula a partir de su fecha y estado, no se persiste como otro estado.

## Datos, fechas y errores

El modelo contiene 16 tablas, con claves `id_<entidad>`, relaciones entre
empresas y empleados, versiones de presupuesto y servicios por evento. Consultar
`api-eventos/database/schema.sql` para el modelo completo. Ese archivo es un
script de recreación, no una migración sobre datos existentes.

Las fechas de negocio viajan como `YYYY-MM-DD` y se muestran como `DD/MM/YYYY`.
Los importes se devuelven como números y se formatean en ARS. Los endpoints
responden errores JSON con `{ mensaje }`: 400 para validación, 401 sin sesión,
403 sin permiso, 404 inexistente o ajeno a la empresa, 409 por conflicto y
500 para errores inesperados, cuyo detalle queda en la terminal de la API.

## Verificación y documentación de apoyo

Las pruebas del frontend cubren sesión, permisos, payloads y reglas de
interfaz. La vista de `localhost:5175` usa datos ficticios y escrituras
deshabilitadas; no reemplaza la API real. El circuito completo se comprueba
con una base de prueba siguiendo [la demo](front-eventos/DEMO.md).

Ver también [decisiones de diseño](docs/DECISIONES.md),
[estado de integración](front-eventos/INTEGRACION-BACKEND.md) y
[roadmap](ROADMAP.md). `CLAUDE.md` y `PROMPT_BACKEND.md` conservan las
convenciones y el procedimiento de trabajo del equipo.
