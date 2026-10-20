-- =============================================================================
-- Sistema de Gestion de Eventos · Esquema completo (multitenant)
-- =============================================================================
-- Ejecutar:
--   psql -U postgres -c "CREATE DATABASE eventos;"
--   psql -U postgres -d eventos -f database/schema.sql
--   psql -U postgres -d eventos -f database/seed.sql
--
-- *** ATENCION ***
-- Este script empieza borrando TODAS las tablas del sistema. Correrlo sobre una
-- base con datos reales los elimina sin aviso. Esta hecho asi a proposito, para
-- poder recrear la base de desarrollo las veces que haga falta.
-- =============================================================================

DROP TABLE IF EXISTS tareas CASCADE;
DROP TABLE IF EXISTS tipos_tarea CASCADE;
DROP TABLE IF EXISTS servicios_x_evento CASCADE;
DROP TABLE IF EXISTS eventos CASCADE;
DROP TABLE IF EXISTS detalle_presupuesto CASCADE;
DROP TABLE IF EXISTS presupuestos CASCADE;
DROP TABLE IF EXISTS solicitudes CASCADE;
DROP TABLE IF EXISTS proveedores_x_servicio CASCADE;
DROP TABLE IF EXISTS proveedores CASCADE;
DROP TABLE IF EXISTS servicios CASCADE;
DROP TABLE IF EXISTS empleados_x_empresa CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS tipos_eventos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS empleados CASCADE;
DROP TABLE IF EXISTS empresas CASCADE;

-- =============================================================================
-- 1. Empresas organizadoras (el "tenant" del sistema)
-- =============================================================================
CREATE TABLE empresas (
    id_empresa SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    cuit VARCHAR(13) NOT NULL UNIQUE,
    email VARCHAR(150),
    telefono VARCHAR(30),
    direccion VARCHAR(200),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. Empleados
-- =============================================================================
-- El empleado no tiene id_empresa: la relacion con la empresa va en
-- empleados_x_empresa, porque el modelo guarda el historial (una persona puede
-- trabajar en una empresa, irse y volver, o estar en dos a la vez).
CREATE TABLE empleados (
    id_empleado SERIAL PRIMARY KEY,
    legajo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    rol VARCHAR(80),
    email VARCHAR(150),
    telefono VARCHAR(30),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- =============================================================================
-- 3. Usuarios del sistema (login)
-- =============================================================================
-- id_empresa es NOT NULL: todo usuario pertenece a una empresa y ese id viaja
-- en el token. Es la base de todo el filtrado multitenant.
-- id_empleado es opcional: hay usuarios administrativos que no estan cargados
-- como empleados. Se usa en la pantalla "Mis tareas" (fase 7).
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'usuario'
        CHECK (rol IN ('admin', 'usuario')),
    id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa),
    id_empleado INTEGER REFERENCES empleados(id_empleado),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_empresa ON usuarios(id_empresa);

-- =============================================================================
-- 4. Tipos de evento (catalogo por empresa)
-- =============================================================================
CREATE TABLE tipos_eventos (
    id_tipo_evento SERIAL PRIMARY KEY,
    id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa),
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(300),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_tipos_eventos_empresa ON tipos_eventos(id_empresa);

-- =============================================================================
-- 5. Clientes (quien encarga el evento)
-- =============================================================================
CREATE TABLE clientes (
    id_cliente SERIAL PRIMARY KEY,
    id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    dni_cuit VARCHAR(20),
    email VARCHAR(150),
    telefono VARCHAR(30),
    direccion VARCHAR(200),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_alta TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clientes_empresa ON clientes(id_empresa);

-- =============================================================================
-- 6. Empleados por empresa (N:M con historial)
-- =============================================================================
-- fecha_fin NULL = sigue trabajando ahi. La baja no borra la fila: la cierra.
CREATE TABLE empleados_x_empresa (
    id_empleado_x_empresa SERIAL PRIMARY KEY,
    id_empleado INTEGER NOT NULL REFERENCES empleados(id_empleado),
    id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa),
    cargo VARCHAR(100),
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin DATE,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_emp_x_emp_empresa ON empleados_x_empresa(id_empresa);
CREATE INDEX idx_emp_x_emp_empleado ON empleados_x_empresa(id_empleado);

-- =============================================================================
-- 7. Servicios (catalogo por empresa: catering, decoracion, sonido...)
-- =============================================================================
CREATE TABLE servicios (
    id_servicio SERIAL PRIMARY KEY,
    id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa),
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(300),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_servicios_empresa ON servicios(id_empresa);

-- =============================================================================
-- 8. Proveedores
-- =============================================================================
CREATE TABLE proveedores (
    id_proveedor SERIAL PRIMARY KEY,
    id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa),
    razon_social VARCHAR(150) NOT NULL,
    cuit VARCHAR(13),
    email VARCHAR(150),
    telefono VARCHAR(30),
    direccion VARCHAR(200),
    observaciones TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_proveedores_empresa ON proveedores(id_empresa);

-- =============================================================================
-- 9. Servicios que ofrece cada proveedor (N:M)
-- =============================================================================
-- Es lo que el proveedor PUEDE hacer. Lo efectivamente acordado para un evento
-- va en servicios_x_evento.
CREATE TABLE proveedores_x_servicio (
    id_proveedor_x_servicio SERIAL PRIMARY KEY,
    id_proveedor INTEGER NOT NULL REFERENCES proveedores(id_proveedor),
    id_servicio INTEGER NOT NULL REFERENCES servicios(id_servicio),
    UNIQUE (id_proveedor, id_servicio)
);

CREATE INDEX idx_prov_x_serv_servicio ON proveedores_x_servicio(id_servicio);

-- =============================================================================
-- 10. Solicitudes (el pedido inicial del cliente)
-- =============================================================================
CREATE TABLE solicitudes (
    id_solicitud SERIAL PRIMARY KEY,
    id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa),
    id_cliente INTEGER NOT NULL REFERENCES clientes(id_cliente),
    id_tipo_evento INTEGER NOT NULL REFERENCES tipos_eventos(id_tipo_evento),
    fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_evento_prevista DATE NOT NULL,
    cantidad_asistentes INTEGER NOT NULL CHECK (cantidad_asistentes > 0),
    sede_prevista VARCHAR(200),
    preferencias TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'presupuestada', 'aceptada',
                          'rechazada', 'cancelada'))
);

CREATE INDEX idx_solicitudes_empresa ON solicitudes(id_empresa);
CREATE INDEX idx_solicitudes_cliente ON solicitudes(id_cliente);
CREATE INDEX idx_solicitudes_estado ON solicitudes(estado);

-- =============================================================================
-- 11. Presupuestos (una fila por version de la propuesta)
-- =============================================================================
-- importe_total lo recalcula siempre la API sumando el detalle: nunca se toma
-- del body (regla 2 de CLAUDE.md).
CREATE TABLE presupuestos (
    id_presupuesto SERIAL PRIMARY KEY,
    id_solicitud INTEGER NOT NULL REFERENCES solicitudes(id_solicitud),
    numero_version INTEGER NOT NULL DEFAULT 1,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    validez_dias INTEGER,
    observaciones TEXT,
    importe_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador'
        CHECK (estado IN ('borrador', 'presentado', 'aceptado',
                          'rechazado', 'reemplazado')),
    UNIQUE (id_solicitud, numero_version)
);

CREATE INDEX idx_presupuestos_solicitud ON presupuestos(id_solicitud);

-- =============================================================================
-- 12. Detalle del presupuesto (los renglones de la propuesta)
-- =============================================================================
-- costo_proveedor = lo que cobra el proveedor.
-- importe_cliente = lo que se le cobra al cliente.
-- No hay formula entre los dos: el cliente pidio cargarlos a mano.
CREATE TABLE detalle_presupuesto (
    id_detalle SERIAL PRIMARY KEY,
    id_presupuesto INTEGER NOT NULL REFERENCES presupuestos(id_presupuesto),
    id_servicio INTEGER NOT NULL REFERENCES servicios(id_servicio),
    id_proveedor INTEGER REFERENCES proveedores(id_proveedor),
    descripcion VARCHAR(300),
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    costo_proveedor NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (costo_proveedor >= 0),
    importe_cliente NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (importe_cliente >= 0)
);

CREATE INDEX idx_detalle_presupuesto ON detalle_presupuesto(id_presupuesto);

-- =============================================================================
-- 13. Eventos (nace al aceptar un presupuesto, regla 4)
-- =============================================================================
-- id_solicitud e id_presupuesto_aceptado son UNIQUE: una solicitud genera un
-- solo evento y un presupuesto se acepta una sola vez.
CREATE TABLE eventos (
    id_evento SERIAL PRIMARY KEY,
    id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa),
    id_solicitud INTEGER NOT NULL UNIQUE REFERENCES solicitudes(id_solicitud),
    id_presupuesto_aceptado INTEGER NOT NULL UNIQUE
        REFERENCES presupuestos(id_presupuesto),
    id_empleado_coordinador INTEGER REFERENCES empleados(id_empleado),
    fecha_evento_confirmada DATE NOT NULL,
    sede_acordada VARCHAR(200),
    condiciones_acordadas TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'confirmado'
        CHECK (estado IN ('confirmado', 'en_preparacion',
                          'realizado', 'cancelado')),
    observaciones_cierre TEXT,
    feedback_cliente TEXT,
    fecha_cierre DATE
);

CREATE INDEX idx_eventos_empresa ON eventos(id_empresa);
CREATE INDEX idx_eventos_estado ON eventos(estado);
CREATE INDEX idx_eventos_fecha ON eventos(fecha_evento_confirmada);
CREATE INDEX idx_eventos_coordinador ON eventos(id_empleado_coordinador);

-- =============================================================================
-- 14. Servicios acordados del evento
-- =============================================================================
-- Copia de los renglones del presupuesto aceptado, mas el seguimiento del
-- proveedor. estado_proveedor es independiente del estado de las tareas
-- (regla 6): la tarea puede estar completada y el proveedor sin confirmar.
CREATE TABLE servicios_x_evento (
    id_servicio_x_evento SERIAL PRIMARY KEY,
    id_evento INTEGER NOT NULL REFERENCES eventos(id_evento),
    id_servicio INTEGER NOT NULL REFERENCES servicios(id_servicio),
    id_proveedor INTEGER REFERENCES proveedores(id_proveedor),
    descripcion VARCHAR(300),
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    costo_acordado_proveedor NUMERIC(12, 2) NOT NULL DEFAULT 0,
    importe_acordado_cliente NUMERIC(12, 2) NOT NULL DEFAULT 0,
    estado_proveedor VARCHAR(20) NOT NULL DEFAULT 'solicitada'
        CHECK (estado_proveedor IN ('solicitada', 'confirmada', 'en_seguimiento',
                                    'finalizada', 'rechazada')),
    fecha_confirmacion_proveedor DATE,
    observaciones TEXT
);

CREATE INDEX idx_serv_x_evento_evento ON servicios_x_evento(id_evento);
CREATE INDEX idx_serv_x_evento_estado ON servicios_x_evento(estado_proveedor);

-- =============================================================================
-- 15. Tipos de tarea (los 4 pasos secuenciales con un proveedor)
-- =============================================================================
-- Tabla fija del sistema, sin id_empresa: la secuencia es la misma para todas.
-- orden es UNIQUE porque define la secuencia de la regla 5.
CREATE TABLE tipos_tarea (
    id_tipo_tarea SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(300),
    orden INTEGER NOT NULL UNIQUE
);

-- =============================================================================
-- 16. Tareas del personal
-- =============================================================================
-- id_servicio_x_evento e id_tipo_tarea quedan NULL en las tareas libres
-- (trabajo interno que no corresponde a ningun proveedor).
-- "vencida" NO se guarda: lo calcula la API (regla 1).
CREATE TABLE tareas (
    id_tarea SERIAL PRIMARY KEY,
    id_evento INTEGER NOT NULL REFERENCES eventos(id_evento),
    id_empleado_responsable INTEGER REFERENCES empleados(id_empleado),
    id_servicio_x_evento INTEGER REFERENCES servicios_x_evento(id_servicio_x_evento),
    id_tipo_tarea INTEGER REFERENCES tipos_tarea(id_tipo_tarea),
    descripcion VARCHAR(300) NOT NULL,
    fecha_prevista DATE,
    fecha_finalizacion DATE,
    estado_tarea VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado_tarea IN ('pendiente', 'en_curso', 'completada')),
    observaciones TEXT
);

CREATE INDEX idx_tareas_evento ON tareas(id_evento);
CREATE INDEX idx_tareas_responsable ON tareas(id_empleado_responsable);
CREATE INDEX idx_tareas_servicio_evento ON tareas(id_servicio_x_evento);
CREATE INDEX idx_tareas_fecha_prevista ON tareas(fecha_prevista);
CREATE INDEX idx_tareas_estado ON tareas(estado_tarea);
