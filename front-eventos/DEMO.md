# Recorrido de demostración · 10 minutos

Usar la API real y las cuentas de demostración que documente el responsable del
backend. No usar la vista ficticia de 5175 para demostrar guardados o reglas del
servidor. Acordar previamente qué datos de prueba se pueden crear/modificar.

1. **Acceso (1 min).** Ingresar y mostrar empresa, usuario y rol. Enseñar que un
   usuario común no puede acceder al formulario de administración de empresas.
2. **Catálogos (1 min).** Abrir cliente y proveedor; revisar los servicios que
   ofrece. Mostrar búsqueda y filtro de inactivos. Explicar la baja lógica.
3. **Solicitud (1 min).** Crear un pedido con cliente, tipo, fecha, asistentes,
   sede y preferencias. Usar “Crear cliente” si hace falta sin abandonar el pedido.
4. **Presupuesto (2 min).** Agregar un servicio y proveedor. Mostrar costo total
   e importe total al cliente: cantidad informativa, margen y sumas desde la API.
   Presentar, crear nueva versión y recorrer ambas. Aceptar la última propuesta.
5. **Evento (1 min).** Completar fecha, sede, condiciones y coordinador. Abrir
   el evento creado y mostrar resumen, calendario y servicios acordados.
6. **Tareas (2 min).** Generar los cuatro pasos. Intentar adelantar el segundo;
   completar el primero. Explicar que completar una tarea no confirma al proveedor.
   Confirmar al proveedor en su pestaña, asignar una tarea interna y abrir Mis tareas.
7. **Seguimiento (1 min).** Revisar próximos eventos, avance, tareas vencidas y
   servicios sin confirmar. Cambiar de 7 a 30 días.
8. **Cierre (1 min).** Mostrar aviso de pendientes y confirmación de cierre. Al
   realizar el evento, registrar feedback. Ver que servicios y tareas ya no se
   editan. En otro evento de prueba, cancelar exige un motivo.

Para la defensa: la tarea es trabajo interno; la confirmación es el compromiso
del proveedor. Los presupuestos conservan versiones y los servicios del evento
guardan lo efectivamente acordado. El aislamiento empresarial se aplica en la API,
no mediante un selector de empresa en el navegador.
