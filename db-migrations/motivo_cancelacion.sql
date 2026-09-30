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
        ('Cliente no disponible / no autoriza ingreso', 'terreno', 1),
        ('Condiciones climáticas adversas', 'terreno', 2),
        ('Acceso restringido o cerrado', 'terreno', 3),
        ('Falla de equipo de medición', 'terreno', 4),
        ('Punto de muestreo inexistente o inaccesible', 'terreno', 5),
        ('Riesgo de seguridad para el muestreador', 'terreno', 6),
        ('Reprogramación solicitada por el cliente', 'coordinacion', 7),
        ('Error de coordinación / duplicidad de servicio', 'coordinacion', 8),
        ('Otro (especificar en observaciones)', 'ambos', 99);
END;

-- Columna en la agenda para guardar el motivo estructurado (además del texto libre
-- ya existente en motivo_cancelacion, que se conserva para el detalle).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('App_Ma_Agenda_MUESTREOS') AND name = 'id_motivocancelacion')
BEGIN
    ALTER TABLE App_Ma_Agenda_MUESTREOS ADD id_motivocancelacion INT NULL;
END;

GRANT SELECT, INSERT, UPDATE, DELETE ON mae_motivocancelacion TO adlone_app;
