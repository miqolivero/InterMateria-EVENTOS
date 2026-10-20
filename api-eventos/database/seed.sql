-- =============================================================================
-- Sistema de Gestion de Eventos · Datos de prueba
-- =============================================================================
-- Ejecutar DESPUES de schema.sql:
--   psql -U postgres -d eventos -f database/seed.sql
--
-- Los ids van explicitos para que los datos sean faciles de seguir y de citar
-- en el README. Al final se reacomodan las secuencias con setval, asi los
-- INSERT que haga la API despues no chocan con estos ids.
--
-- Las fechas son relativas a CURRENT_DATE: asi siempre hay eventos proximos y
-- al menos una tarea vencida, sin tener que editar el seed cada semana.
--
-- Contrasena de TODOS los usuarios de prueba: admin123
-- (el hash de abajo es bcrypt con 10 rondas, generado con bcryptjs)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Empresas (los 3 tenants)
-- -----------------------------------------------------------------------------
INSERT INTO empresas (id_empresa, nombre, cuit, email, telefono, direccion) VALUES
(1, 'Eventos del Centro', '30-71234567-8', 'contacto@eventosdelcentro.com', '351-4001122', 'Av. Colon 1200, Cordoba'),
(2, 'Fiestas Norte', '30-70987654-3', 'info@fiestasnorte.com', '351-4553344', 'Rafael Nunez 4500, Cordoba'),
(3, 'Producciones Sur', '30-69876543-1', 'hola@produccionessur.com', NULL, NULL);

-- -----------------------------------------------------------------------------
-- Tipos de tarea: los 4 pasos del seguimiento de un proveedor
-- -----------------------------------------------------------------------------
-- Tabla fija del sistema. El campo orden es el que hace cumplir la regla 5:
-- una tarea de orden N necesita la N-1 completada.
INSERT INTO tipos_tarea (id_tipo_tarea, nombre, descripcion, orden) VALUES
(1, 'Contactar al proveedor', 'Primer contacto para pedir disponibilidad y condiciones', 1),
(2, 'Confirmar asistencia', 'Confirmar con el proveedor que va a prestar el servicio', 2),
(3, 'Seguimiento previo', 'Repasar detalles, horarios y requerimientos antes del evento', 3),
(4, 'Cierre del servicio', 'Verificar que el servicio se presto y cerrar el pago', 4);

-- -----------------------------------------------------------------------------
-- Empleados
-- -----------------------------------------------------------------------------
-- Los empleados son globales; la relacion con la empresa va mas abajo.
INSERT INTO empleados (id_empleado, legajo, nombre, apellido, rol, email, telefono) VALUES
(1, 'E001', 'Laura', 'Gimenez', 'Coordinadora de eventos', 'laura.gimenez@eventosdelcentro.com', '351-5110011'),
(2, 'E002', 'Martin', 'Rios', 'Asistente de coordinacion', 'martin.rios@eventosdelcentro.com', '351-5110022'),
(3, 'E003', 'Carla', 'Vega', 'Responsable de presupuestos', 'carla.vega@eventosdelcentro.com', '351-5110033'),
(4, 'E004', 'Diego', 'Sosa', 'Atencion al cliente', 'diego.sosa@eventosdelcentro.com', '351-5110044'),
(5, 'E101', 'Nadia', 'Paz', 'Coordinadora de eventos', 'nadia.paz@fiestasnorte.com', '351-5220011');

INSERT INTO empleados_x_empresa (id_empleado, id_empresa, cargo, fecha_inicio) VALUES
(1, 1, 'Coordinadora de eventos', CURRENT_DATE - 720),
(2, 1, 'Asistente de coordinacion', CURRENT_DATE - 400),
(3, 1, 'Responsable de presupuestos', CURRENT_DATE - 600),
(4, 1, 'Atencion al cliente', CURRENT_DATE - 200),
(5, 2, 'Coordinadora de eventos', CURRENT_DATE - 300);

-- -----------------------------------------------------------------------------
-- Usuarios: un admin y uno comun por empresa
-- -----------------------------------------------------------------------------
-- Los dos usuarios de la empresa 1 estan vinculados a un empleado, para poder
-- probar "Mis tareas" (fase 7). Los demas van sin empleado a proposito.
INSERT INTO usuarios (id_usuario, nombre, email, password, rol, id_empresa, id_empleado) VALUES
(1, 'Laura Gimenez', 'admin@eventosdelcentro.com',   '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'admin',   1, 1),
(2, 'Martin Rios',   'usuario@eventosdelcentro.com', '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'usuario', 1, 2),
(3, 'Nadia Paz',     'admin@fiestasnorte.com',       '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'admin',   2, 5),
(4, 'Pablo Herrera', 'usuario@fiestasnorte.com',     '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'usuario', 2, NULL),
(5, 'Ana Torres',    'admin@produccionessur.com',    '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'admin',   3, NULL),
(6, 'Lucas Franco',  'usuario@produccionessur.com',  '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'usuario', 3, NULL);

-- =============================================================================
-- EMPRESA 1 · set completo (es la que se usa para la demo)
-- =============================================================================

-- Tipos de evento
INSERT INTO tipos_eventos (id_tipo_evento, id_empresa, nombre, descripcion) VALUES
(1, 1, 'Cumpleanos de 15', 'Fiesta de quince anos'),
(2, 1, 'Casamiento', 'Fiesta de casamiento con cena'),
(3, 1, 'Egresados', 'Fiesta de egresados de secundario'),
(4, 1, 'Corporativo', 'Evento de empresa: fin de ano, lanzamientos');

-- Servicios del catalogo
INSERT INTO servicios (id_servicio, id_empresa, nombre, descripcion) VALUES
(1, 1, 'Catering', 'Comida y bebida para el evento'),
(2, 1, 'Decoracion', 'Ambientacion del salon'),
(3, 1, 'Sonido e iluminacion', 'Equipos de audio y luces'),
(4, 1, 'Fotografia y video', 'Cobertura fotografica y filmacion'),
(5, 1, 'Animacion y DJ', 'Musica en vivo y animacion');

-- Proveedores
INSERT INTO proveedores (id_proveedor, id_empresa, razon_social, cuit, email, telefono, observaciones) VALUES
(1, 1, 'Catering Dona Rosa', '30-61112223-4', 'ventas@donarosa.com', '351-4771100', 'Pide confirmar el menu con 15 dias de anticipacion'),
(2, 1, 'Luz y Sonido Cordoba', '30-62223334-5', 'contacto@luzysonido.com', '351-4772200', NULL),
(3, 1, 'Flores y Ambientes', '30-63334445-6', 'hola@floresyambientes.com', '351-4773300', 'Trabaja solo con sena del 50%'),
(4, 1, 'Estudio Clic', '30-64445556-7', 'estudio@clic.com', '351-4774400', NULL);

-- Que servicio ofrece cada proveedor
INSERT INTO proveedores_x_servicio (id_proveedor, id_servicio) VALUES
(1, 1),           -- Dona Rosa: catering
(2, 3), (2, 5),   -- Luz y Sonido: sonido y animacion
(3, 2),           -- Flores y Ambientes: decoracion
(4, 4);           -- Estudio Clic: fotografia

-- Clientes
INSERT INTO clientes (id_cliente, id_empresa, nombre, apellido, dni_cuit, email, telefono, direccion) VALUES
(1, 1, 'Sofia', 'Martinez', '38123456', 'sofia.martinez@gmail.com', '351-6001122', 'Belgrano 450, Cordoba'),
(2, 1, 'Juan', 'Perez', '30987654', 'juan.perez@gmail.com', '351-6002233', 'San Martin 980, Cordoba'),
(3, 1, 'Valeria', 'Luna', '35456789', 'valeria.luna@gmail.com', '351-6003344', NULL);

-- -----------------------------------------------------------------------------
-- Solicitud 1: recien entrada, todavia sin presupuesto
-- -----------------------------------------------------------------------------
INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(1, 1, 1, 1, CURRENT_DATE - 5, CURRENT_DATE + 75, 120,
 'Salon Las Palmas', 'Quiere barra de tragos sin alcohol y pista de baile iluminada', 'pendiente');

-- -----------------------------------------------------------------------------
-- Solicitud 2: aceptada, con 2 versiones de presupuesto y evento confirmado
-- -----------------------------------------------------------------------------
INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(2, 1, 2, 2, CURRENT_DATE - 40, CURRENT_DATE + 25, 180,
 'Estancia El Molino', 'Cena servida en mesa, ceremonia al aire libre si el clima acompana', 'aceptada');

-- Version 1: la primera propuesta. El cliente pidio sumar fotografia, asi que
-- quedo 'reemplazado' por la version 2 (regla 3).
INSERT INTO presupuestos (id_presupuesto, id_solicitud, numero_version, fecha_emision,
                          validez_dias, observaciones, importe_total, estado) VALUES
(1, 2, 1, CURRENT_DATE - 35, 15, 'Propuesta inicial sin cobertura fotografica', 1950000.00, 'reemplazado');

INSERT INTO detalle_presupuesto (id_detalle, id_presupuesto, id_servicio, id_proveedor,
                                 descripcion, cantidad, costo_proveedor, importe_cliente) VALUES
(1, 1, 1, 1, 'Cena para 180 personas con servicio de mesa', 1,  900000.00, 1200000.00),
(2, 1, 2, 3, 'Ambientacion de salon y ceremonia',            1,  250000.00,  350000.00),
(3, 1, 3, 2, 'Sonido e iluminacion para 8 horas',            1,  300000.00,  400000.00);
-- Total v1: 1200000 + 350000 + 400000 = 1950000 (coincide con importe_total)

-- Version 2: la que el cliente acepto.
INSERT INTO presupuestos (id_presupuesto, id_solicitud, numero_version, fecha_emision,
                          validez_dias, observaciones, importe_total, estado) VALUES
(2, 2, 2, CURRENT_DATE - 28, 15, 'Se agrega fotografia y video y se ajusta el catering', 2600000.00, 'aceptado');

INSERT INTO detalle_presupuesto (id_detalle, id_presupuesto, id_servicio, id_proveedor,
                                 descripcion, cantidad, costo_proveedor, importe_cliente) VALUES
(4, 2, 1, 1, 'Cena para 180 personas con servicio de mesa', 1,  950000.00, 1300000.00),
(5, 2, 2, 3, 'Ambientacion de salon y ceremonia',            1,  250000.00,  350000.00),
(6, 2, 3, 2, 'Sonido e iluminacion para 8 horas',            1,  300000.00,  400000.00),
(7, 2, 4, 4, 'Cobertura fotografica y video del evento',     1,  400000.00,  550000.00);
-- Total v2: 1300000 + 350000 + 400000 + 550000 = 2600000 (coincide)

-- El evento que nacio al aceptar la version 2 (regla 4)
INSERT INTO eventos (id_evento, id_empresa, id_solicitud, id_presupuesto_aceptado,
                     id_empleado_coordinador, fecha_evento_confirmada, sede_acordada,
                     condiciones_acordadas, estado) VALUES
(1, 1, 2, 2, 1, CURRENT_DATE + 25, 'Estancia El Molino',
 'Sena del 40% pagada. El saldo se abona 5 dias antes del evento.', 'en_preparacion');

-- Los servicios acordados: copia del detalle de la version 2, cada uno con su
-- propio estado de proveedor.
INSERT INTO servicios_x_evento (id_servicio_x_evento, id_evento, id_servicio, id_proveedor,
                                descripcion, cantidad, costo_acordado_proveedor,
                                importe_acordado_cliente, estado_proveedor,
                                fecha_confirmacion_proveedor, observaciones) VALUES
(1, 1, 1, 1, 'Cena para 180 personas con servicio de mesa', 1,  950000.00, 1300000.00,
 'confirmada', CURRENT_DATE - 10, 'Menu cerrado: entrada fria, plato principal y postre'),
(2, 1, 2, 3, 'Ambientacion de salon y ceremonia',            1,  250000.00,  350000.00,
 'solicitada', NULL, 'Todavia no respondieron el presupuesto de flores'),
(3, 1, 3, 2, 'Sonido e iluminacion para 8 horas',            1,  300000.00,  400000.00,
 'en_seguimiento', CURRENT_DATE - 12, NULL),
(4, 1, 4, 4, 'Cobertura fotografica y video del evento',     1,  400000.00,  550000.00,
 'solicitada', NULL, NULL);

-- -----------------------------------------------------------------------------
-- Tareas del evento 1
-- -----------------------------------------------------------------------------
-- Catering: los dos primeros pasos cerrados, el tercero en curso.
INSERT INTO tareas (id_tarea, id_evento, id_empleado_responsable, id_servicio_x_evento,
                    id_tipo_tarea, descripcion, fecha_prevista, fecha_finalizacion,
                    estado_tarea) VALUES
(1, 1, 1, 1, 1, 'Contactar a Catering Dona Rosa',            CURRENT_DATE - 20, CURRENT_DATE - 20, 'completada'),
(2, 1, 1, 1, 2, 'Confirmar asistencia del catering',         CURRENT_DATE - 12, CURRENT_DATE - 10, 'completada'),
(3, 1, 2, 1, 3, 'Seguimiento previo del menu y horarios',    CURRENT_DATE + 5,  NULL,              'en_curso'),
(4, 1, 2, 1, 4, 'Cierre del servicio de catering',           CURRENT_DATE + 26, NULL,              'pendiente');

-- Sonido: el paso 2 quedo PENDIENTE y con la fecha pasada -> la API lo va a
-- devolver como vencida = true (regla 1), sin guardar nada en la tabla.
INSERT INTO tareas (id_tarea, id_evento, id_empleado_responsable, id_servicio_x_evento,
                    id_tipo_tarea, descripcion, fecha_prevista, fecha_finalizacion,
                    estado_tarea) VALUES
(5, 1, 2, 3, 1, 'Contactar a Luz y Sonido Cordoba',          CURRENT_DATE - 18, CURRENT_DATE - 18, 'completada'),
(6, 1, 2, 3, 2, 'Confirmar asistencia de sonido',            CURRENT_DATE - 3,  NULL,              'pendiente'),
(7, 1, 2, 3, 3, 'Seguimiento previo de equipos',             CURRENT_DATE + 10, NULL,              'pendiente'),
(8, 1, 2, 3, 4, 'Cierre del servicio de sonido',             CURRENT_DATE + 26, NULL,              'pendiente');

-- Fotografia: aca se ve la regla 6. Las tareas "Contactar" y "Confirmar
-- asistencia" estan COMPLETADAS, pero el estado del proveedor sigue en
-- 'solicitada': que el empleado haya hecho el trabajo no significa que el
-- proveedor haya confirmado.
INSERT INTO tareas (id_tarea, id_evento, id_empleado_responsable, id_servicio_x_evento,
                    id_tipo_tarea, descripcion, fecha_prevista, fecha_finalizacion,
                    estado_tarea) VALUES
(9,  1, 1, 4, 1, 'Contactar a Estudio Clic',                 CURRENT_DATE - 15, CURRENT_DATE - 15, 'completada'),
(10, 1, 1, 4, 2, 'Confirmar asistencia del fotografo',       CURRENT_DATE - 8,  CURRENT_DATE - 7,  'completada'),
(11, 1, 1, 4, 3, 'Seguimiento previo de tomas y horarios',   CURRENT_DATE + 8,  NULL,              'pendiente'),
(12, 1, 1, 4, 4, 'Cierre del servicio de fotografia',        CURRENT_DATE + 26, NULL,              'pendiente');

-- Tarea libre: trabajo interno, sin proveedor ni tipo. No entra en la secuencia.
INSERT INTO tareas (id_tarea, id_evento, id_empleado_responsable, id_servicio_x_evento,
                    id_tipo_tarea, descripcion, fecha_prevista, fecha_finalizacion,
                    estado_tarea, observaciones) VALUES
(13, 1, 2, NULL, NULL, 'Armar el cronograma del dia del evento', CURRENT_DATE + 12, NULL,
 'pendiente', 'Coordinar con la novia los horarios de la ceremonia');

-- La decoracion (servicio_x_evento 2) queda SIN tareas a proposito, para poder
-- probar el boton "Generar tareas" de la fase 7.

-- =============================================================================
-- EMPRESA 2 · unos pocos datos propios, para probar el aislamiento multitenant
-- =============================================================================
INSERT INTO tipos_eventos (id_tipo_evento, id_empresa, nombre, descripcion) VALUES
(5, 2, 'Cumpleanos infantil', 'Fiesta para chicos con animacion');

INSERT INTO servicios (id_servicio, id_empresa, nombre, descripcion) VALUES
(6, 2, 'Catering infantil', 'Mesa dulce y comida para chicos');

INSERT INTO proveedores (id_proveedor, id_empresa, razon_social, cuit, email, telefono) VALUES
(5, 2, 'Banquetes del Norte', '30-65556667-8', 'ventas@banquetesnorte.com', '351-4885500');

INSERT INTO proveedores_x_servicio (id_proveedor, id_servicio) VALUES
(5, 6);

INSERT INTO clientes (id_cliente, id_empresa, nombre, apellido, dni_cuit, email, telefono) VALUES
(4, 2, 'Hernan', 'Diaz', '33222111', 'hernan.diaz@gmail.com', '351-6554433');

INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(3, 2, 4, 5, CURRENT_DATE - 2, CURRENT_DATE + 45, 40,
 'Salon Girasoles', 'Tematica de superheroes', 'pendiente');

-- =============================================================================
-- Reacomodar las secuencias
-- =============================================================================
-- Como los ids se insertaron a mano, las secuencias quedaron en 1 y el proximo
-- INSERT de la API chocaria con la PK. Esto las deja en el ultimo id usado.
SELECT setval('empresas_id_empresa_seq',                     (SELECT MAX(id_empresa) FROM empresas));
SELECT setval('empleados_id_empleado_seq',                   (SELECT MAX(id_empleado) FROM empleados));
SELECT setval('empleados_x_empresa_id_empleado_x_empresa_seq', (SELECT MAX(id_empleado_x_empresa) FROM empleados_x_empresa));
SELECT setval('usuarios_id_usuario_seq',                     (SELECT MAX(id_usuario) FROM usuarios));
SELECT setval('tipos_eventos_id_tipo_evento_seq',            (SELECT MAX(id_tipo_evento) FROM tipos_eventos));
SELECT setval('clientes_id_cliente_seq',                     (SELECT MAX(id_cliente) FROM clientes));
SELECT setval('servicios_id_servicio_seq',                   (SELECT MAX(id_servicio) FROM servicios));
SELECT setval('proveedores_id_proveedor_seq',                (SELECT MAX(id_proveedor) FROM proveedores));
SELECT setval('proveedores_x_servicio_id_proveedor_x_servicio_seq', (SELECT MAX(id_proveedor_x_servicio) FROM proveedores_x_servicio));
SELECT setval('solicitudes_id_solicitud_seq',                (SELECT MAX(id_solicitud) FROM solicitudes));
SELECT setval('presupuestos_id_presupuesto_seq',             (SELECT MAX(id_presupuesto) FROM presupuestos));
SELECT setval('detalle_presupuesto_id_detalle_seq',          (SELECT MAX(id_detalle) FROM detalle_presupuesto));
SELECT setval('eventos_id_evento_seq',                       (SELECT MAX(id_evento) FROM eventos));
SELECT setval('servicios_x_evento_id_servicio_x_evento_seq', (SELECT MAX(id_servicio_x_evento) FROM servicios_x_evento));
SELECT setval('tipos_tarea_id_tipo_tarea_seq',               (SELECT MAX(id_tipo_tarea) FROM tipos_tarea));
SELECT setval('tareas_id_tarea_seq',                         (SELECT MAX(id_tarea) FROM tareas));
