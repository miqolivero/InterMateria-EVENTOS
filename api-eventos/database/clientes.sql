-- Ejecutar sobre la base eventos, después de empresas.sql.
-- Conserva la clave id_empresa que utiliza la aplicación existente.
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa),
    nombre VARCHAR(150) NOT NULL CHECK (length(trim(nombre)) > 0),
    apellido VARCHAR(150) NOT NULL CHECK (length(trim(apellido)) > 0),
    dni_cuit VARCHAR(20),
    telefono VARCHAR(30),
    email VARCHAR(150)
);

CREATE INDEX IF NOT EXISTS clientes_empresa_idx ON clientes(id_empresa);
