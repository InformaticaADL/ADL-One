-- Catálogo de bases de operación (sede/oficina desde la que se despacha el
-- servicio), asociado a la ficha al crearla (manual o carga masiva).
-- Editable desde ADL ONE > Informática > Maestros Hub > "Bases de Operación".
-- Requiere permisos DDL: ejecutar con una cuenta con CREATE TABLE/ALTER TABLE
-- en la base (adlone_app normalmente solo tiene permisos de lectura/escritura
-- de datos).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'mae_baseoperaciones')
BEGIN
    CREATE TABLE mae_baseoperaciones (
        id_baseoperaciones INT IDENTITY(1,1) PRIMARY KEY,
        nombre_baseoperaciones VARCHAR(100) NOT NULL,
        habilitado CHAR(1) NOT NULL DEFAULT 'S',
        orden INT NOT NULL DEFAULT 0
    );

    -- Semilla mínima — completar/editar el resto desde Maestros Hub.
    INSERT INTO mae_baseoperaciones (nombre_baseoperaciones, orden) VALUES
        ('Puerto Montt', 1);
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('App_Ma_FichaIngresoServicio_ENC') AND name = 'id_baseoperaciones')
BEGIN
    ALTER TABLE App_Ma_FichaIngresoServicio_ENC ADD id_baseoperaciones INT NULL;
END;

GRANT SELECT, INSERT, UPDATE, DELETE ON mae_baseoperaciones TO adlone_app;
