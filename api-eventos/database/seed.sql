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

-- El archivo esta en UTF-8. Sin esta linea, psql en Windows lo lee con la
-- codificacion de la consola (WIN1252) y caracteres como "·" quedan guardados
-- como "Â·".
SET client_encoding = 'UTF8';

-- -----------------------------------------------------------------------------
-- Empresas (los tenants)
-- -----------------------------------------------------------------------------
-- La empresa 4 esta SUSPENDIDA (activo = false): sirve para probar que sus
-- usuarios no pueden entrar (Fase 10).
INSERT INTO empresas (id_empresa, nombre, cuit, email, telefono, direccion, activo) VALUES
(1, 'Eventos del Centro', '30-71234567-8', 'contacto@eventosdelcentro.com', '351-4001122', 'Av. Colón 1200, Córdoba', TRUE),
(2, 'Fiestas Norte', '30-70987654-3', 'info@fiestasnorte.com', '351-4553344', 'Rafael Núñez 4500, Córdoba', TRUE),
(3, 'Producciones Sur', '30-69876543-1', 'hola@produccionessur.com', NULL, NULL, TRUE),
(4, 'Salones del Lago', '30-71555444-2', 'info@saloneslago.com', '3541-422233', 'Av. San Martín 300, Villa Carlos Paz', FALSE);

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
(1, 'E001', 'Laura', 'Giménez', 'Coordinadora de eventos', 'laura.gimenez@eventosdelcentro.com', '351-5110011'),
(2, 'E002', 'Martín', 'Ríos', 'Asistente de coordinación', 'martin.rios@eventosdelcentro.com', '351-5110022'),
(3, 'E003', 'Carla', 'Vega', 'Responsable de presupuestos', 'carla.vega@eventosdelcentro.com', '351-5110033'),
(4, 'E004', 'Diego', 'Sosa', 'Atención al cliente', 'diego.sosa@eventosdelcentro.com', '351-5110044'),
(5, 'E101', 'Nadia', 'Paz', 'Coordinadora de eventos', 'nadia.paz@fiestasnorte.com', '351-5220011');

INSERT INTO empleados_x_empresa (id_empleado, id_empresa, cargo, fecha_inicio) VALUES
(1, 1, 'Coordinadora de eventos', CURRENT_DATE - 720),
(2, 1, 'Asistente de coordinación', CURRENT_DATE - 400),
(3, 1, 'Responsable de presupuestos', CURRENT_DATE - 600),
(4, 1, 'Atención al cliente', CURRENT_DATE - 200),
(5, 2, 'Coordinadora de eventos', CURRENT_DATE - 300);

-- -----------------------------------------------------------------------------
-- Usuarios: los 4 roles de la Fase 10
-- -----------------------------------------------------------------------------
-- - 7: el superadmin (los duenos del sistema). Sin empresa ni empleado.
-- - Empresa 1: un usuario de cada rol. El coordinador (2) era el "usuario"
--   comun de antes. La empleada (8, Carla Vega) tiene tareas con proveedor y
--   libres, y nace con debe_cambiar_password: su contrasena la "puso el admin",
--   asi que el front le pide cambiarla en el primer ingreso.
-- - Empresas 2 y 3: un admin y un coordinador cada una.
-- - 9: el admin de la empresa 4, que esta suspendida: no puede entrar.
-- - 10: Miqueas, el otro superadmin (dueno del sistema). Nace con
--   debe_cambiar_password: en el primer ingreso elige su propia contrasena.
INSERT INTO usuarios (id_usuario, nombre, email, password, rol, id_empresa, id_empleado, debe_cambiar_password) VALUES
(1, 'Laura Giménez', 'admin@eventosdelcentro.com',   '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'admin',       1,    1,    FALSE),
(2, 'Martín Ríos',   'usuario@eventosdelcentro.com', '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'coordinador', 1,    2,    FALSE),
(3, 'Nadia Paz',     'admin@fiestasnorte.com',       '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'admin',       2,    5,    FALSE),
(4, 'Pablo Herrera', 'usuario@fiestasnorte.com',     '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'coordinador', 2,    NULL, FALSE),
(5, 'Ana Torres',    'admin@produccionessur.com',    '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'admin',       3,    NULL, FALSE),
(6, 'Lucas Franco',  'usuario@produccionessur.com',  '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'coordinador', 3,    NULL, FALSE),
(7, 'Soporte',       'soporte@eventosapp.com',       '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'superadmin',  NULL, NULL, FALSE),
(8, 'Carla Vega',    'carla@eventosdelcentro.com',   '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'empleado',    1,    3,    TRUE),
(9, 'Sofía Luna',    'admin@saloneslago.com',        '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'admin',       4,    NULL, FALSE),
(10, 'Miqueas Olivero', 'miqueas@eventosapp.com',    '$2b$10$WufpnoOJvWfopKLXXB58Nu.eZ4L0iuAUQiF4DcfzYcLut0SFL6VYi', 'superadmin',  NULL, NULL, TRUE);

-- =============================================================================
-- EMPRESA 1 · set completo (es la que se usa para la demo)
-- =============================================================================

-- Tipos de evento
INSERT INTO tipos_eventos (id_tipo_evento, id_empresa, nombre, descripcion) VALUES
(1, 1, 'Cumpleaños de 15', 'Fiesta de quince años'),
(2, 1, 'Casamiento', 'Fiesta de casamiento con cena'),
(3, 1, 'Egresados', 'Fiesta de egresados de secundario'),
(4, 1, 'Corporativo', 'Evento de empresa: fin de año, lanzamientos');

-- Servicios del catalogo
INSERT INTO servicios (id_servicio, id_empresa, nombre, descripcion) VALUES
(1, 1, 'Catering', 'Comida y bebida para el evento'),
(2, 1, 'Decoración', 'Ambientación del salón'),
(3, 1, 'Sonido e iluminación', 'Equipos de audio y luces'),
(4, 1, 'Fotografía y video', 'Cobertura fotográfica y filmacion'),
(5, 1, 'Animación y DJ', 'Musica en vivo y animación');

-- Proveedores
INSERT INTO proveedores (id_proveedor, id_empresa, razon_social, cuit, email, telefono, observaciones) VALUES
(1, 1, 'Catering Doña Rosa', '30-61112223-4', 'ventas@donarosa.com', '351-4771100', 'Pide confirmar el menú con 15 días de anticipación'),
(2, 1, 'Luz y Sonido Córdoba', '30-62223334-5', 'contacto@luzysonido.com', '351-4772200', NULL),
(3, 1, 'Flores y Ambientes', '30-63334445-6', 'hola@floresyambientes.com', '351-4773300', 'Trabaja solo con seña del 50%'),
(4, 1, 'Estudio Clic', '30-64445556-7', 'estudio@clic.com', '351-4774400', NULL);

-- Que servicio ofrece cada proveedor
INSERT INTO proveedores_x_servicio (id_proveedor, id_servicio) VALUES
(1, 1),           -- Doña Rosa: catering
(2, 3), (2, 5),   -- Luz y Sonido: sonido y animación
(3, 2),           -- Flores y Ambientes: decoracion
(4, 4);           -- Estudio Clic: fotografía

-- Clientes
INSERT INTO clientes (id_cliente, id_empresa, nombre, apellido, dni_cuit, email, telefono, direccion) VALUES
(1, 1, 'Sofía', 'Martínez', '38123456', 'sofia.martinez@gmail.com', '351-6001122', 'Belgrano 450, Córdoba'),
(2, 1, 'Juan', 'Pérez', '30987654', 'juan.perez@gmail.com', '351-6002233', 'San Martín 980, Córdoba'),
(3, 1, 'Valeria', 'Luna', '35456789', 'valeria.luna@gmail.com', '351-6003344', NULL);

-- -----------------------------------------------------------------------------
-- Solicitud 1: recien entrada, todavia sin presupuesto
-- -----------------------------------------------------------------------------
INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(1, 1, 1, 1, CURRENT_DATE - 5, CURRENT_DATE + 75, 120,
 'Salón Las Palmas', 'Quiere barra de tragos sin alcohol y pista de baile iluminada', 'pendiente');

-- -----------------------------------------------------------------------------
-- Solicitud 2: aceptada, con 2 versiones de presupuesto y evento confirmado
-- -----------------------------------------------------------------------------
INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(2, 1, 2, 2, CURRENT_DATE - 40, CURRENT_DATE + 25, 180,
 'Estancia El Molino', 'Cena servida en mesa, ceremonia al aire libre si el clima acompaña', 'aceptada');

-- Version 1: la primera propuesta. El cliente pidio sumar fotografia, asi que
-- quedo 'reemplazado' por la version 2 (regla 3).
INSERT INTO presupuestos (id_presupuesto, id_solicitud, numero_version, fecha_emision,
                          validez_dias, observaciones, importe_total, estado) VALUES
(1, 2, 1, CURRENT_DATE - 35, 15, 'Propuesta inicial sin cobertura fotográfica', 1950000.00, 'reemplazado');

INSERT INTO detalle_presupuesto (id_detalle, id_presupuesto, id_servicio, id_proveedor,
                                 descripcion, cantidad, costo_proveedor, importe_cliente) VALUES
(1, 1, 1, 1, 'Cena para 180 personas con servicio de mesa', 1,  900000.00, 1200000.00),
(2, 1, 2, 3, 'Ambientación de salón y ceremonia',            1,  250000.00,  350000.00),
(3, 1, 3, 2, 'Sonido e iluminación para 8 horas',            1,  300000.00,  400000.00);
-- Total v1: 1200000 + 350000 + 400000 = 1950000 (coincide con importe_total)

-- Version 2: la que el cliente acepto.
INSERT INTO presupuestos (id_presupuesto, id_solicitud, numero_version, fecha_emision,
                          validez_dias, observaciones, importe_total, estado) VALUES
(2, 2, 2, CURRENT_DATE - 28, 15, 'Se agrega fotografía y video y se ajusta el catering', 2600000.00, 'aceptado');

INSERT INTO detalle_presupuesto (id_detalle, id_presupuesto, id_servicio, id_proveedor,
                                 descripcion, cantidad, costo_proveedor, importe_cliente) VALUES
(4, 2, 1, 1, 'Cena para 180 personas con servicio de mesa', 1,  950000.00, 1300000.00),
(5, 2, 2, 3, 'Ambientación de salón y ceremonia',            1,  250000.00,  350000.00),
(6, 2, 3, 2, 'Sonido e iluminación para 8 horas',            1,  300000.00,  400000.00),
(7, 2, 4, 4, 'Cobertura fotográfica y video del evento',     1,  400000.00,  550000.00);
-- Total v2: 1300000 + 350000 + 400000 + 550000 = 2600000 (coincide)

-- El evento que nacio al aceptar la version 2 (regla 4)
INSERT INTO eventos (id_evento, id_empresa, id_solicitud, id_presupuesto_aceptado,
                     id_empleado_coordinador, fecha_evento_confirmada, sede_acordada,
                     condiciones_acordadas, estado) VALUES
(1, 1, 2, 2, 1, CURRENT_DATE + 25, 'Estancia El Molino',
 'Seña del 40% pagada. El saldo se abona 5 días antes del evento.', 'en_preparacion');

-- Los servicios acordados: copia del detalle de la version 2, cada uno con su
-- propio estado de proveedor.
INSERT INTO servicios_x_evento (id_servicio_x_evento, id_evento, id_servicio, id_proveedor,
                                descripcion, cantidad, costo_acordado_proveedor,
                                importe_acordado_cliente, estado_proveedor,
                                fecha_confirmacion_proveedor, observaciones) VALUES
(1, 1, 1, 1, 'Cena para 180 personas con servicio de mesa', 1,  950000.00, 1300000.00,
 'confirmada', CURRENT_DATE - 10, 'Menú cerrado: entrada fria, plato principal y postre'),
(2, 1, 2, 3, 'Ambientación de salón y ceremonia',            1,  250000.00,  350000.00,
 'solicitada', NULL, 'Todavía no respondieron el presupuesto de flores'),
(3, 1, 3, 2, 'Sonido e iluminación para 8 horas',            1,  300000.00,  400000.00,
 'en_seguimiento', CURRENT_DATE - 12, NULL),
(4, 1, 4, 4, 'Cobertura fotográfica y video del evento',     1,  400000.00,  550000.00,
 'solicitada', NULL, NULL);

-- -----------------------------------------------------------------------------
-- Tareas del evento 1
-- -----------------------------------------------------------------------------
-- Catering: los dos primeros pasos cerrados, el tercero en curso.
INSERT INTO tareas (id_tarea, id_evento, id_empleado_responsable, id_servicio_x_evento,
                    id_tipo_tarea, descripcion, fecha_prevista, fecha_finalizacion,
                    estado_tarea) VALUES
(1, 1, 1, 1, 1, 'Contactar a Catering Doña Rosa',            CURRENT_DATE - 20, CURRENT_DATE - 20, 'completada'),
(2, 1, 1, 1, 2, 'Confirmar asistencia del catering',         CURRENT_DATE - 12, CURRENT_DATE - 10, 'completada'),
(3, 1, 2, 1, 3, 'Seguimiento previo del menú y horarios',    CURRENT_DATE + 5,  NULL,              'en_curso'),
(4, 1, 2, 1, 4, 'Cierre del servicio de catering',           CURRENT_DATE + 26, NULL,              'pendiente');

-- Sonido: el paso 2 quedo PENDIENTE y con la fecha pasada -> la API lo va a
-- devolver como vencida = true (regla 1), sin guardar nada en la tabla.
INSERT INTO tareas (id_tarea, id_evento, id_empleado_responsable, id_servicio_x_evento,
                    id_tipo_tarea, descripcion, fecha_prevista, fecha_finalizacion,
                    estado_tarea) VALUES
(5, 1, 2, 3, 1, 'Contactar a Luz y Sonido Córdoba',          CURRENT_DATE - 18, CURRENT_DATE - 18, 'completada'),
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
(10, 1, 1, 4, 2, 'Confirmar asistencia del fotógrafo',       CURRENT_DATE - 8,  CURRENT_DATE - 7,  'completada'),
(11, 1, 1, 4, 3, 'Seguimiento previo de tomas y horarios',   CURRENT_DATE + 8,  NULL,              'pendiente'),
(12, 1, 1, 4, 4, 'Cierre del servicio de fotografía',        CURRENT_DATE + 26, NULL,              'pendiente');

-- Tarea libre: trabajo interno, sin proveedor ni tipo. No entra en la secuencia.
INSERT INTO tareas (id_tarea, id_evento, id_empleado_responsable, id_servicio_x_evento,
                    id_tipo_tarea, descripcion, fecha_prevista, fecha_finalizacion,
                    estado_tarea, observaciones) VALUES
(13, 1, 2, NULL, NULL, 'Armar el cronograma del dia del evento', CURRENT_DATE + 12, NULL,
 'pendiente', 'Coordinar con la novia los horarios de la ceremonia');

-- La decoracion (servicio_x_evento 2) queda SIN tareas a proposito, para poder
-- probar el boton "Generar tareas" de la fase 6.

-- =============================================================================
-- EMPRESA 2 · unos pocos datos propios, para probar el aislamiento multitenant
-- =============================================================================
INSERT INTO tipos_eventos (id_tipo_evento, id_empresa, nombre, descripcion) VALUES
(5, 2, 'Cumpleaños infantil', 'Fiesta para chicos con animación');

INSERT INTO servicios (id_servicio, id_empresa, nombre, descripcion) VALUES
(6, 2, 'Catering infantil', 'Mesa dulce y comida para chicos');

INSERT INTO proveedores (id_proveedor, id_empresa, razon_social, cuit, email, telefono) VALUES
(5, 2, 'Banquetes del Norte', '30-65556667-8', 'ventas@banquetesnorte.com', '351-4885500');

INSERT INTO proveedores_x_servicio (id_proveedor, id_servicio) VALUES
(5, 6);

INSERT INTO clientes (id_cliente, id_empresa, nombre, apellido, dni_cuit, email, telefono) VALUES
(4, 2, 'Hernán', 'Díaz', '33222111', 'hernan.diaz@gmail.com', '351-6554433');

INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(3, 2, 4, 5, CURRENT_DATE - 2, CURRENT_DATE + 45, 40,
 'Salón Girasoles', 'Temática de superheroes', 'pendiente');

-- =============================================================================
-- DATOS DE DEMO (fase 9)
-- =============================================================================
-- Completan el circuito para la presentacion: 6 eventos en total, en las dos
-- empresas y en todos los estados, y solicitudes en todos sus estados. Todo
-- respeta las reglas de negocio, igual que si se hubiera cargado desde la API:
--   - importe_total de cada presupuesto = suma de su detalle (regla 2);
--   - cada evento sale de un presupuesto aceptado y sus servicios son copia
--     del detalle de ese presupuesto (regla 4);
--   - ninguna tarea arranco sin la anterior completada (regla 5);
--   - los proveedores de cada renglon ofrecen ese servicio.
--
-- Resumen:
--   evento 1 · empresa 1 · en_preparacion (el set original de arriba)
--   evento 2 · empresa 1 · confirmado     · en 10 dias, con una tarea vencida
--   evento 3 · empresa 1 · realizado      · hace 15 dias, con feedback
--   evento 4 · empresa 1 · cancelado      · con el motivo cargado
--   evento 5 · empresa 2 · en_preparacion · en 6 dias, con una tarea vencida
--   evento 6 · empresa 2 · confirmado     · en 20 dias, sin coordinador
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Empresa 1: clientes nuevos
-- -----------------------------------------------------------------------------
-- Para un cliente empresa, la razon social va en nombre y el apellido es '-'
-- (lo dice el contrato).
INSERT INTO clientes (id_cliente, id_empresa, nombre, apellido, dni_cuit, email, telefono, direccion) VALUES
(5, 1, 'Grupo Andes SA', '-', '30-71555666-1', 'eventos@grupoandes.com', '351-4225566', 'Av. Hipólito Yrigoyen 300, Córdoba'),
(6, 1, 'Colegio San José', '-', '30-60111222-9', 'secretaria@sanjose.edu.ar', '351-4336677', 'Duarte Quirós 1500, Córdoba'),
(7, 1, 'Martina', 'Ruiz', '42111333', 'martina.ruiz@gmail.com', '351-6007788', NULL);

-- -----------------------------------------------------------------------------
-- Solicitud 4: presupuestada. Tiene un presupuesto PRESENTADO esperando la
-- respuesta del cliente: sirve para mostrar en vivo "aceptar y confirmar".
-- -----------------------------------------------------------------------------
INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(4, 1, 3, 1, CURRENT_DATE - 12, CURRENT_DATE + 50, 90,
 'Salón Las Palmas', 'Vals con fuegos fríos y mesa de dulces', 'presupuestada');

INSERT INTO presupuestos (id_presupuesto, id_solicitud, numero_version, fecha_emision,
                          validez_dias, observaciones, importe_total, estado) VALUES
(3, 4, 1, CURRENT_DATE - 3, 15, 'Incluye mesa de dulces dentro del catering', 1400000.00, 'presentado');

INSERT INTO detalle_presupuesto (id_detalle, id_presupuesto, id_servicio, id_proveedor,
                                 descripcion, cantidad, costo_proveedor, importe_cliente) VALUES
(8, 3, 1, 1, 'Cena y mesa de dulces para 90 personas', 90, 800000.00, 1100000.00),
(9, 3, 2, 3, 'Ambientación con flores y luces cálidas',   1, 200000.00,  300000.00);
-- Total: 1100000 + 300000 = 1400000

-- -----------------------------------------------------------------------------
-- Solicitud 5 -> evento 2: CONFIRMADO, en 10 dias
-- -----------------------------------------------------------------------------
INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(5, 1, 5, 4, CURRENT_DATE - 30, CURRENT_DATE + 10, 150,
 'Hotel Quinto Centenario', 'Cena de fin de año con discurso del directorio', 'aceptada');

INSERT INTO presupuestos (id_presupuesto, id_solicitud, numero_version, fecha_emision,
                          validez_dias, observaciones, importe_total, estado) VALUES
(4, 5, 1, CURRENT_DATE - 20, 10, NULL, 1700000.00, 'aceptado');

INSERT INTO detalle_presupuesto (id_detalle, id_presupuesto, id_servicio, id_proveedor,
                                 descripcion, cantidad, costo_proveedor, importe_cliente) VALUES
(10, 4, 1, 1, 'Cena de fin de año para 150 personas', 150, 1000000.00, 1350000.00),
(11, 4, 3, 2, 'Sonido para discursos y musica funcional', 1, 250000.00,  350000.00);
-- Total: 1350000 + 350000 = 1700000

INSERT INTO eventos (id_evento, id_empresa, id_solicitud, id_presupuesto_aceptado,
                     id_empleado_coordinador, fecha_evento_confirmada, sede_acordada,
                     condiciones_acordadas, estado) VALUES
(2, 1, 5, 4, 3, CURRENT_DATE + 10, 'Hotel Quinto Centenario',
 'Pago contra factura a 15 días', 'confirmado');

INSERT INTO servicios_x_evento (id_servicio_x_evento, id_evento, id_servicio, id_proveedor,
                                descripcion, cantidad, costo_acordado_proveedor,
                                importe_acordado_cliente, estado_proveedor,
                                fecha_confirmacion_proveedor, observaciones) VALUES
(5, 2, 1, 1, 'Cena de fin de año para 150 personas',     150, 1000000.00, 1350000.00,
 'confirmada', CURRENT_DATE - 5, NULL),
(6, 2, 3, 2, 'Sonido para discursos y musica funcional', 1,   250000.00,  350000.00,
 'solicitada', NULL, 'Esperando que confirmen el equipo inalambrico');

-- Catering: el paso 3 quedo pendiente con la fecha de ayer -> vencida.
-- El sonido (servicio_x_evento 6) todavia no tiene tareas generadas.
INSERT INTO tareas (id_tarea, id_evento, id_empleado_responsable, id_servicio_x_evento,
                    id_tipo_tarea, descripcion, fecha_prevista, fecha_finalizacion,
                    estado_tarea) VALUES
(14, 2, 3, 5, 1, 'Contactar al proveedor · Catering (Catering Doña Rosa)', CURRENT_DATE - 12, CURRENT_DATE - 12, 'completada'),
(15, 2, 3, 5, 2, 'Confirmar asistencia · Catering (Catering Doña Rosa)',   CURRENT_DATE - 6,  CURRENT_DATE - 5,  'completada'),
(16, 2, 3, 5, 3, 'Seguimiento previo · Catering (Catering Doña Rosa)',     CURRENT_DATE - 1,  NULL,              'pendiente'),
(17, 2, 3, 5, 4, 'Cierre del servicio · Catering (Catering Doña Rosa)',    CURRENT_DATE + 11, NULL,              'pendiente');

-- -----------------------------------------------------------------------------
-- Solicitud 6 -> evento 3: REALIZADO hace 15 dias, con feedback.
-- La version 1 la rechazo el cliente por precio; se acepto la version 2.
-- -----------------------------------------------------------------------------
INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(6, 1, 6, 3, CURRENT_DATE - 75, CURRENT_DATE - 15, 250,
 'Club Atlético Belgrano', 'Fiesta de egresados de 5to año', 'aceptada');

INSERT INTO presupuestos (id_presupuesto, id_solicitud, numero_version, fecha_emision,
                          validez_dias, observaciones, importe_total, estado) VALUES
(5, 6, 1, CURRENT_DATE - 60, 10, 'Primera propuesta', 2600000.00, 'rechazado'),
(6, 6, 2, CURRENT_DATE - 50, 10, 'Se ajusta el menú para bajar el precio', 2350000.00, 'aceptado');

INSERT INTO detalle_presupuesto (id_detalle, id_presupuesto, id_servicio, id_proveedor,
                                 descripcion, cantidad, costo_proveedor, importe_cliente) VALUES
(12, 5, 1, 1, 'Cena completa para 250 personas', 250, 1500000.00, 2000000.00),
(13, 5, 5, 2, 'DJ y animación por 6 horas',       1,  400000.00,  600000.00),
(14, 6, 1, 1, 'Menú de pasos para 250 personas',  250, 1400000.00, 1800000.00),
(15, 6, 5, 2, 'DJ y animación por 6 horas',       1,  400000.00,  550000.00);
-- Total v1: 2000000 + 600000 = 2600000 · Total v2: 1800000 + 550000 = 2350000

INSERT INTO eventos (id_evento, id_empresa, id_solicitud, id_presupuesto_aceptado,
                     id_empleado_coordinador, fecha_evento_confirmada, sede_acordada,
                     condiciones_acordadas, estado, observaciones_cierre,
                     feedback_cliente, fecha_cierre) VALUES
(3, 1, 6, 6, 1, CURRENT_DATE - 15, 'Club Atlético Belgrano',
 'Seña del 50%. Saldo en dos cuotas.', 'realizado',
 'Todo según lo previsto. El DJ extendió una hora a pedido de los chicos.',
 'Excelente organización, los chicos quedaron muy contentos.', CURRENT_DATE - 14);

INSERT INTO servicios_x_evento (id_servicio_x_evento, id_evento, id_servicio, id_proveedor,
                                descripcion, cantidad, costo_acordado_proveedor,
                                importe_acordado_cliente, estado_proveedor,
                                fecha_confirmacion_proveedor, observaciones) VALUES
(7, 3, 1, 1, 'Menú de pasos para 250 personas', 250, 1400000.00, 1800000.00,
 'finalizada', CURRENT_DATE - 40, NULL),
(8, 3, 5, 2, 'DJ y animación por 6 horas',       1,  400000.00,  550000.00,
 'finalizada', CURRENT_DATE - 38, 'Cobró una hora extra aparte');

-- Las 8 tareas completas: el evento ya paso
INSERT INTO tareas (id_tarea, id_evento, id_empleado_responsable, id_servicio_x_evento,
                    id_tipo_tarea, descripcion, fecha_prevista, fecha_finalizacion,
                    estado_tarea) VALUES
(18, 3, 1, 7, 1, 'Contactar al proveedor · Catering (Catering Doña Rosa)',         CURRENT_DATE - 48, CURRENT_DATE - 48, 'completada'),
(19, 3, 1, 7, 2, 'Confirmar asistencia · Catering (Catering Doña Rosa)',           CURRENT_DATE - 40, CURRENT_DATE - 40, 'completada'),
(20, 3, 1, 7, 3, 'Seguimiento previo · Catering (Catering Doña Rosa)',             CURRENT_DATE - 20, CURRENT_DATE - 19, 'completada'),
(21, 3, 1, 7, 4, 'Cierre del servicio · Catering (Catering Doña Rosa)',            CURRENT_DATE - 14, CURRENT_DATE - 14, 'completada'),
(22, 3, 2, 8, 1, 'Contactar al proveedor · Animación y DJ (Luz y Sonido Córdoba)', CURRENT_DATE - 47, CURRENT_DATE - 47, 'completada'),
(23, 3, 2, 8, 2, 'Confirmar asistencia · Animación y DJ (Luz y Sonido Córdoba)',   CURRENT_DATE - 38, CURRENT_DATE - 38, 'completada'),
(24, 3, 2, 8, 3, 'Seguimiento previo · Animación y DJ (Luz y Sonido Córdoba)',     CURRENT_DATE - 18, CURRENT_DATE - 18, 'completada'),
(25, 3, 2, 8, 4, 'Cierre del servicio · Animación y DJ (Luz y Sonido Córdoba)',    CURRENT_DATE - 14, CURRENT_DATE - 13, 'completada');

-- -----------------------------------------------------------------------------
-- Solicitud 7 -> evento 4: CANCELADO. Al cancelar, la solicitud tambien pasa
-- a 'cancelada' (fase 8). Tiene una tarea con fecha pasada sin completar, pero
-- NO aparece en el tablero: los eventos cerrados quedan afuera del seguimiento.
-- -----------------------------------------------------------------------------
INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(7, 1, 7, 1, CURRENT_DATE - 35, CURRENT_DATE + 40, 100,
 'Salón Las Palmas', 'Temática París', 'cancelada');

INSERT INTO presupuestos (id_presupuesto, id_solicitud, numero_version, fecha_emision,
                          validez_dias, observaciones, importe_total, estado) VALUES
(7, 7, 1, CURRENT_DATE - 25, 15, NULL, 480000.00, 'aceptado');

INSERT INTO detalle_presupuesto (id_detalle, id_presupuesto, id_servicio, id_proveedor,
                                 descripcion, cantidad, costo_proveedor, importe_cliente) VALUES
(16, 7, 4, 4, 'Fotografía de la fiesta y book previo', 1, 350000.00, 480000.00);

INSERT INTO eventos (id_evento, id_empresa, id_solicitud, id_presupuesto_aceptado,
                     id_empleado_coordinador, fecha_evento_confirmada, sede_acordada,
                     condiciones_acordadas, estado, observaciones_cierre, fecha_cierre) VALUES
(4, 1, 7, 7, 2, CURRENT_DATE + 40, 'Salón Las Palmas', 'Seña del 30%', 'cancelado',
 'La familia canceló por un viaje al exterior. Se devolvió la seña.', CURRENT_DATE - 2);

INSERT INTO servicios_x_evento (id_servicio_x_evento, id_evento, id_servicio, id_proveedor,
                                descripcion, cantidad, costo_acordado_proveedor,
                                importe_acordado_cliente, estado_proveedor,
                                fecha_confirmacion_proveedor, observaciones) VALUES
(9, 4, 4, 4, 'Fotografía de la fiesta y book previo', 1, 350000.00, 480000.00,
 'solicitada', NULL, NULL);

INSERT INTO tareas (id_tarea, id_evento, id_empleado_responsable, id_servicio_x_evento,
                    id_tipo_tarea, descripcion, fecha_prevista, fecha_finalizacion,
                    estado_tarea) VALUES
(26, 4, 2, 9, 1, 'Contactar al proveedor · Fotografía y video (Estudio Clic)', CURRENT_DATE - 20, CURRENT_DATE - 20, 'completada'),
(27, 4, 2, 9, 2, 'Confirmar asistencia · Fotografía y video (Estudio Clic)',   CURRENT_DATE - 5,  NULL,              'pendiente'),
(28, 4, 2, 9, 3, 'Seguimiento previo · Fotografía y video (Estudio Clic)',     CURRENT_DATE + 30, NULL,              'pendiente'),
(29, 4, 2, 9, 4, 'Cierre del servicio · Fotografía y video (Estudio Clic)',    CURRENT_DATE + 41, NULL,              'pendiente');

-- -----------------------------------------------------------------------------
-- Solicitud 8: RECHAZADA. El cliente no siguio despues de la primera version.
-- -----------------------------------------------------------------------------
INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(8, 1, 5, 4, CURRENT_DATE - 18, CURRENT_DATE + 90, 60,
 NULL, 'Lanzamiento de producto con cóctel', 'rechazada');

INSERT INTO presupuestos (id_presupuesto, id_solicitud, numero_version, fecha_emision,
                          validez_dias, observaciones, importe_total, estado) VALUES
(8, 8, 1, CURRENT_DATE - 10, 10, NULL, 850000.00, 'rechazado');

INSERT INTO detalle_presupuesto (id_detalle, id_presupuesto, id_servicio, id_proveedor,
                                 descripcion, cantidad, costo_proveedor, importe_cliente) VALUES
(17, 8, 1, 1, 'Cóctel para 60 personas', 60, 600000.00, 850000.00);

-- -----------------------------------------------------------------------------
-- Empresa 2: un empleado, un servicio y una clienta mas, y dos eventos
-- -----------------------------------------------------------------------------
INSERT INTO empleados (id_empleado, legajo, nombre, apellido, rol, email, telefono) VALUES
(6, 'E102', 'Ramiro', 'Ortiz', 'Asistente', 'ramiro.ortiz@fiestasnorte.com', '351-5220022');

INSERT INTO empleados_x_empresa (id_empleado, id_empresa, cargo, fecha_inicio) VALUES
(6, 2, 'Asistente', CURRENT_DATE - 150);

-- Sin proveedor que lo ofrezca: lo hace el personal propio
INSERT INTO servicios (id_servicio, id_empresa, nombre, descripcion) VALUES
(7, 2, 'Animación infantil', 'Juegos, pelotero y show de magia');

INSERT INTO clientes (id_cliente, id_empresa, nombre, apellido, dni_cuit, email, telefono) VALUES
(8, 2, 'Paula', 'Sánchez', '36777888', 'paula.sanchez@gmail.com', '351-6558899');

-- Solicitud 9 -> evento 5: EN PREPARACION, en 6 dias, con una tarea vencida y
-- un servicio sin proveedor (la animacion la hace el personal propio)
INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(9, 2, 8, 5, CURRENT_DATE - 25, CURRENT_DATE + 6, 35,
 'Salón Pequeños Gigantes', 'Cumple de 5 años, temática dinosaurios', 'aceptada');

INSERT INTO presupuestos (id_presupuesto, id_solicitud, numero_version, fecha_emision,
                          validez_dias, observaciones, importe_total, estado) VALUES
(9, 9, 1, CURRENT_DATE - 15, 7, NULL, 410000.00, 'aceptado');

INSERT INTO detalle_presupuesto (id_detalle, id_presupuesto, id_servicio, id_proveedor,
                                 descripcion, cantidad, costo_proveedor, importe_cliente) VALUES
(18, 9, 6, 5,    'Mesa dulce y comida para 35 chicos', 35, 180000.00, 260000.00),
(19, 9, 7, NULL, 'Animación de 3 horas',                1,       0.00, 150000.00);
-- Total: 260000 + 150000 = 410000

INSERT INTO eventos (id_evento, id_empresa, id_solicitud, id_presupuesto_aceptado,
                     id_empleado_coordinador, fecha_evento_confirmada, sede_acordada,
                     condiciones_acordadas, estado) VALUES
(5, 2, 9, 9, 5, CURRENT_DATE + 6, 'Salón Pequeños Gigantes', 'Pago total por adelantado', 'en_preparacion');

INSERT INTO servicios_x_evento (id_servicio_x_evento, id_evento, id_servicio, id_proveedor,
                                descripcion, cantidad, costo_acordado_proveedor,
                                importe_acordado_cliente, estado_proveedor,
                                fecha_confirmacion_proveedor, observaciones) VALUES
(10, 5, 6, 5,    'Mesa dulce y comida para 35 chicos', 35, 180000.00, 260000.00,
 'confirmada', CURRENT_DATE - 8, NULL),
(11, 5, 7, NULL, 'Animación de 3 horas',                1,       0.00, 150000.00,
 'solicitada', NULL, 'La hace el personal propio');

INSERT INTO tareas (id_tarea, id_evento, id_empleado_responsable, id_servicio_x_evento,
                    id_tipo_tarea, descripcion, fecha_prevista, fecha_finalizacion,
                    estado_tarea, observaciones) VALUES
(30, 5, 6, 10, 1, 'Contactar al proveedor · Catering infantil (Banquetes del Norte)', CURRENT_DATE - 12, CURRENT_DATE - 12, 'completada', NULL),
(31, 5, 6, 10, 2, 'Confirmar asistencia · Catering infantil (Banquetes del Norte)',   CURRENT_DATE - 8,  CURRENT_DATE - 8,  'completada', NULL),
(32, 5, 6, 10, 3, 'Seguimiento previo · Catering infantil (Banquetes del Norte)',     CURRENT_DATE - 2,  NULL,              'pendiente',  NULL),
(33, 5, 6, 10, 4, 'Cierre del servicio · Catering infantil (Banquetes del Norte)',    CURRENT_DATE + 7,  NULL,              'pendiente',  NULL),
(34, 5, 5, NULL, NULL, 'Comprar los souvenirs',                                        CURRENT_DATE + 3,  NULL,              'pendiente',  'Dinosaurios de goma, 35 unidades');

-- Solicitud 10 -> evento 6: CONFIRMADO, en 20 dias, todavia sin coordinador
INSERT INTO solicitudes (id_solicitud, id_empresa, id_cliente, id_tipo_evento,
                         fecha_solicitud, fecha_evento_prevista, cantidad_asistentes,
                         sede_prevista, preferencias, estado) VALUES
(10, 2, 4, 5, CURRENT_DATE - 9, CURRENT_DATE + 20, 50,
 'Salón Girasoles', 'Cumple de 8 años', 'aceptada');

INSERT INTO presupuestos (id_presupuesto, id_solicitud, numero_version, fecha_emision,
                          validez_dias, observaciones, importe_total, estado) VALUES
(10, 10, 1, CURRENT_DATE - 7, 7, NULL, 300000.00, 'aceptado');

INSERT INTO detalle_presupuesto (id_detalle, id_presupuesto, id_servicio, id_proveedor,
                                 descripcion, cantidad, costo_proveedor, importe_cliente) VALUES
(20, 10, 6, 5, 'Mesa dulce y comida para 50 chicos', 50, 200000.00, 300000.00);

INSERT INTO eventos (id_evento, id_empresa, id_solicitud, id_presupuesto_aceptado,
                     id_empleado_coordinador, fecha_evento_confirmada, sede_acordada,
                     condiciones_acordadas, estado) VALUES
(6, 2, 10, 10, NULL, CURRENT_DATE + 20, 'Salón Girasoles', NULL, 'confirmado');

INSERT INTO servicios_x_evento (id_servicio_x_evento, id_evento, id_servicio, id_proveedor,
                                descripcion, cantidad, costo_acordado_proveedor,
                                importe_acordado_cliente, estado_proveedor,
                                fecha_confirmacion_proveedor, observaciones) VALUES
(12, 6, 6, 5, 'Mesa dulce y comida para 50 chicos', 50, 200000.00, 300000.00,
 'solicitada', NULL, NULL);

-- =============================================================================
-- Fase 10 · tareas libres de Carla Vega (la usuaria con rol empleado)
-- =============================================================================
-- Carla ya tiene la secuencia del catering del evento 2 (tareas 14 a 17).
-- Con estas suma tareas libres en dos eventos, una de ellas vencida, para que
-- su panel muestre de todo: con proveedor, libres, vencidas y de dos eventos.
INSERT INTO tareas (id_tarea, id_evento, id_empleado_responsable, id_servicio_x_evento,
                    id_tipo_tarea, descripcion, fecha_prevista, fecha_finalizacion,
                    estado_tarea, observaciones) VALUES
(40, 2, 3, NULL, NULL, 'Imprimir las tarjetas de ubicación de las mesas', CURRENT_DATE - 2, NULL, 'pendiente', NULL),
(41, 1, 3, NULL, NULL, 'Retirar los centros de mesa del depósito',       CURRENT_DATE + 6, NULL, 'en_curso',  'Están en el depósito de la calle Ituzaingó');

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
