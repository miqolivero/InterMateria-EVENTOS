# Recorrido de demostración · 15 minutos

Preparar una base nueva de demostración siguiendo [Instalación](../docs/INSTALACION.md)
y arrancar la API real. El seed incluye `admin@eventosdelcentro.com` y
`usuario@eventosdelcentro.com`, ambos con contraseña `admin123`; las demás
cuentas están en el [README del backend](../api-eventos/README.md).
No usar la vista ficticia de 5175 para demostrar guardados o reglas del servidor.
Acordar previamente qué datos de prueba se pueden crear/modificar.

1. **Acceso (1 min).** Ingresar y mostrar empresa, usuario y rol. Enseñar que un
   usuario común no puede acceder al formulario de administración de empresas.
2. **Catálogos (1 min).** Abrir cliente, proveedor y sedes; revisar los servicios
   que ofrece cada proveedor. Mostrar búsqueda, filtro de inactivos y "Limpiar
   filtros". Explicar la baja lógica.
3. **Solicitud (1 min).** Crear un pedido con cliente, tipo, fecha, asistentes (hasta
   10.000), una sede del catálogo y preferencias. Usar “Crear cliente” si hace falta sin abandonar el pedido.
4. **Presupuesto (2 min).** Agregar un servicio y proveedor. El alquiler del salón, si se
   cobra, es un servicio más con su importe para este evento. Mostrar costo total
   e importe total al cliente: cantidad informativa, margen y sumas desde la API.
   Presentar y abrir el link del cliente en una ventana de incógnito: no pide usuario
   ni muestra costos o proveedores. Responder, crear nueva versión y recorrer ambas.
5. **Evento (1 min).** Aceptar y confirmar la última versión: la respuesta del cliente
   no crea el evento. Completar fecha, sede, condiciones y coordinador. Un salón no se
   ocupa dos veces el mismo día. Mostrar resumen, calendario, "Por estado" y servicios.
6. **Tareas (2 min).** Con "Pasos", elegir los que hacen falta, con su fecha: se
   completan en cualquier orden. Explicar que completar una tarea no confirma al
   proveedor. Confirmarlo en Servicios, asignar una tarea interna, abrir "Historial" de
   una tarea y ver Mis tareas.
7. **Seguimiento (1 min).** Revisar el próximo evento, las tarjetas, tareas vencidas y
   servicios sin confirmar. Cambiar de 7 a 30 días y entrar a una tarjeta.
8. **Un cambio (2 min).** "Cambiar lo acordado": mover la fecha pide motivo y deja
   elegir las tareas afectadas. En "A revisar", revisar una tarea actualizando su fecha,
   responsable o estado. En "Historial", el cambio dice "Falta revisar" hasta terminar.
9. **Cierre (1 min).** Mostrar aviso de pendientes y confirmación de cierre. Al
   realizar el evento, registrar feedback. Ver que servicios y tareas ya no se
   editan. En otro evento de prueba, cancelar exige un motivo.

Para la defensa: la tarea es trabajo interno; la confirmación es el compromiso
del proveedor. Los presupuestos conservan versiones y los servicios del evento
guardan lo efectivamente acordado. El aislamiento empresarial se aplica en la API,
no mediante un selector de empresa en el navegador.
