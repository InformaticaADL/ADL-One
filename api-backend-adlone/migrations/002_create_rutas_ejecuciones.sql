-- Migration: 002_create_rutas_ejecuciones
-- Adds execution tracking tables for the template→execution route model.
-- A "ruta planificada" (mae_rutas_planificadas) is now a reusable template of N fichas.
-- Each time it is run, a "ejecucion" row is created selecting a subset + specific correlativos.

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'mae_rutas_ejecuciones')
BEGIN
    CREATE TABLE mae_rutas_ejecuciones (
        id_ejecucion          INT IDENTITY(1,1)   NOT NULL,
        id_ruta_planificada   INT                 NOT NULL,
        fecha_ejecucion       DATE                NOT NULL,
        id_muestreador_inst   INT                 NOT NULL,
        id_muestreador_ret    INT                 NULL,
        estado                VARCHAR(50)         NOT NULL CONSTRAINT DF_ejecucion_estado DEFAULT 'ASIGNADA',
        observaciones         VARCHAR(500)        NULL,
        id_usuario_creador    INT                 NULL,
        fecha_creacion        DATETIME            NOT NULL CONSTRAINT DF_ejecucion_fecha_creacion DEFAULT GETUTCDATE(),

        CONSTRAINT PK_rutas_ejecuciones PRIMARY KEY (id_ejecucion),
        CONSTRAINT FK_ejecucion_ruta FOREIGN KEY (id_ruta_planificada)
            REFERENCES mae_rutas_planificadas (id_ruta_planificada)
    );
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'mae_rutas_ejecuciones_detalle')
BEGIN
    CREATE TABLE mae_rutas_ejecuciones_detalle (
        id_detalle_ejec         INT IDENTITY(1,1)   NOT NULL,
        id_ejecucion            INT                 NOT NULL,
        id_fichaingresoservicio NUMERIC(10,0)       NOT NULL,
        orden                   INT                 NOT NULL,
        frecuencia_correlativo  VARCHAR(100)        NULL,
        id_agendamam            INT                 NULL,

        CONSTRAINT PK_rutas_ejecuciones_detalle PRIMARY KEY (id_detalle_ejec),
        CONSTRAINT FK_detalle_ejec_ejecucion FOREIGN KEY (id_ejecucion)
            REFERENCES mae_rutas_ejecuciones (id_ejecucion)
    );
END;
