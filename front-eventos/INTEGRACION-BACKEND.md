# Estado de integración

Frontend desarrollado sobre `main` (`c681148`), contrastado con el contrato final
de `origin/backend` (`a10ece7`). Este documento no modifica `docs/API.md` ni
supone que el backend esté integrado en main.

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

No se fusionó la rama backend, no se modificaron controllers ni SQL y no se
ejecutaron schema.sql o seed.sql sobre la base del usuario.

## API real

Dirección confirmada por el usuario: `http://localhost:3000/api`.

La verificación previa de esa API local devolvió 200 en GET /empresas, mientras
el login de la cuenta de demostración devolvió 500. Ese resultado corresponde a
la copia ejecutada entonces; no demuestra un fallo del backend nuevo que está
en otra rama. La prueba autenticada real debe repetirse con la implementación
y los datos configurados por el responsable del backend.

En la comprobación final, `localhost:3000` no respondió a las consultas de
empresas, clientes o resumen de seguimiento. No se inició otro backend ni se
cambió su configuración para resolverlo.

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

1. El responsable del backend ejecuta su implementación y verifica su conexión
   a la base. El frontend conserva la URL de .env; no cambia PostgreSQL.
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

Hasta repetir este checklist con la API nueva, el estado es: frontend
implementado y validado contra el contrato; integración real pendiente.
