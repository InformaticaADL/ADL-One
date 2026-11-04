-- Catálogo de motivos de cancelación de un muestreo, seleccionable desde la app
-- ADL Sampling al cancelar un servicio. Editable desde ADL ONE > Informática >
-- Maestros Hub > "Motivos de Cancelación" (tabla genérica vía /maestros/:tableName).
-- Requiere permisos DDL: ejecutar con una cuenta con CREATE TABLE en la base
-- (adlone_app normalmente solo tiene permisos de lectura/escritura de datos).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'mae_motivocancelacion')
BEGIN
    CREATE TABLE mae_motivocancelacion (
        id_motivocancelacion INT IDENTITY(1,1) PRIMARY KEY,
        nombre_motivo VARCHAR(150) NOT NULL,
        aplica_a VARCHAR(20) NOT NULL DEFAULT 'ambos', -- 'terreno' | 'coordinacion' | 'ambos'
        habilitado CHAR(1) NOT NULL DEFAULT 'S',
        orden INT NOT NULL DEFAULT 0
    );

    INSERT INTO mae_motivocancelacion (nombre_motivo, aplica_a, orden) VALUES
        ('Por solicitud del cliente', 'ambos', 1),
        ('Por decisión de ADL', 'ambos', 2),
        ('Por condición climática', 'ambos', 3),
        ('Por condición de seguridad', 'ambos', 4);
END;

-- Columna en la agenda para guardar el motivo estructurado (además del texto libre
-- ya existente en motivo_cancelacion, que se conserva para el detalle).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('App_Ma_Agenda_MUESTREOS') AND name = 'id_motivocancelacion')
BEGIN
    ALTER TABLE App_Ma_Agenda_MUESTREOS ADD id_motivocancelacion INT NULL;
END;

GRANT SELECT, INSERT, UPDATE, DELETE ON mae_motivocancelacion TO adlone_app;
