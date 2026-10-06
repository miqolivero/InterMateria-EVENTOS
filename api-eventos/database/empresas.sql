-- Base de datos del proyecto: sistema de eventos (multitenant)
-- Ejecutar:  psql -U postgres -c "CREATE DATABASE eventos;"
--            psql -U postgres -d eventos -f database/empresas.sql

CREATE TABLE empresas (
    id_empresa SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    cuit VARCHAR(13) NOT NULL UNIQUE,
    email VARCHAR(150),
    telefono VARCHAR(30),
    direccion VARCHAR(200),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Datos de prueba
INSERT INTO empresas (nombre, cuit, email, telefono, direccion) VALUES
('Eventos del Centro', '30-71234567-8', 'contacto@eventosdelcentro.com', '351-4001122', 'Av. Colón 1200, Córdoba'),
('Fiestas Norte', '30-70987654-3', 'info@fiestasnorte.com', '351-4553344', 'Rafael Núñez 4500, Córdoba'),
('Producciones Sur', '30-69876543-1', 'hola@produccionessur.com', NULL, NULL);
