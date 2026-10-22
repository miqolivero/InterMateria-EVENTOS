# Estado de integración

Backend del equipo (`origin/backend`, `72a7d53`) integrado localmente en
`frontend` el 22/10/2026, junto con las correcciones visuales publicadas por el
equipo. No se publicó ningún cambio en main.

## Qué está preparado

Pantallas y servicios para las fases 1 a 8: acceso y empresas, catálogos,
solicitudes, presupuestos y versiones, confirmación y eventos, servicios del
evento y tareas, Mis tareas, tablero, cierre y feedback.

Los métodos, rutas, PK y payloads provienen del contrato. Los cambios finales
de la rama backend se incorporaron a la interfaz: cantidades enteras,
coordinador opcional, nueva versión solo desde la última, bloqueo de reapertura
hacia pendiente o en_curso si el siguiente paso comenzó y feedback con texto.

## Estado de las ramas revisadas

- `origin/main`: contrato completo, pero implementación de la fase 1.
- `origin/back/fase-2`: implementación de catálogos.
- `origin/backend`: implementación hasta la fase 9 y contrato revisado.

La base local anterior se actualizó con `npm run db:actualizar`, después de
generar un respaldo completo. Se conservaron las cuatro empresas y el cliente
existentes; no se ejecutaron los DROP de schema.sql ni se cargó seed.sql.

## API real

Dirección confirmada por el usuario: `http://localhost:3000/api`.

Se reemplazó el proceso antiguo `nodemon index.js` por `npm start` dentro de
`api-eventos`. La API actual responde en el puerto 3000 con el .env local.
Se comprobaron registro (201), login y perfil (200), persistencia con hash y
listados autenticados de clientes, tipos, servicios, proveedores, empleados,
solicitudes, eventos, Mis tareas y las cuatro consultas del tablero (200).
Sin token, clientes devuelve 401. Las cuentas temporales se eliminaron al
terminar; no se dejaron usuarios ni datos de demostración.

## Verificaciones del frontend

- Compilación, análisis estático y pruebas automáticas sin escrituras reales.
- Vista manual separada en localhost:5175, con fixtures del contrato y aviso
  visible de datos ficticios. Login ficticio, listados y pantallas; no crea
  usuarios ni guarda cambios en la API del equipo.
- Revisar formularios, validaciones y conservación de datos ante errores con
  esa vista no equivale a probar transacciones, concurrencia o multitenant reales.
- Pasaron 14 pruebas automáticas, lint y compilación. En navegador se recorrieron
  los módulos, el formulario de clientes con errores, el editor de presupuestos,
  la restricción de secuencia y fechas de tareas, Mis tareas y el cierre.
- Se comprobó el menú en 390 px de ancho. Los eventos realizados no muestran
  edición de servicios; permiten feedback. Los cancelados no ofrecen feedback.
  Una cancelación sin motivo se rechaza en el formulario.

## Checklist de integración real

1. API local y conexión a la base verificadas. El frontend conserva la URL de .env.
2. Login, perfil, registro y expiración de sesión. Validar roles admin/usuario.
3. Alta/edición/baja lógica de los cinco catálogos; oferta de servicios de proveedor.
4. Cliente → solicitud → presupuesto con dos versiones → aceptación → evento.
5. Importes del detalle y totales de API. Cantidad informativa, sin multiplicar.
6. Generar cuatro tareas, bloquear paso 2 sin paso 1, y confirmar un proveedor
   por separado. Probar tareas internas y Mis tareas con distintos responsables.
7. Pendientes, vencidas, próximos eventos y coherencia de los indicadores.
8. Cancelación con motivo, realización con pendientes, feedback y solo lectura
   después del cierre. Probar 400 y 409 conservando el formulario.
9. Usar una segunda empresa y confirmar que la API no devuelva ni modifique
   recursos de otra, incluso llamando rutas directamente.

Registro, login, perfil y consultas reales verificados. El circuito completo
de operaciones, concurrencia y aislamiento entre empresas sigue pendiente de
una prueba de integración dedicada; las comprobaciones de lectura no lo reemplazan.
