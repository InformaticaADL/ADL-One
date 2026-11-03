-- Migration: add_observacion_to_muestreador_competencia
-- Habilitar o deshabilitar una competencia a un muestreador exige una
-- observación obligatoria (por qué se habilita/deshabilita, con qué respaldo).
--
--  * mae_muestreador_competencia: la asignación ya NO se borra al
--    deshabilitar. `habilitado` ('S'/'N') indica su estado; `observacion`,
--    `id_usuario_asignacion` y `fecha_modificacion` guardan el último cambio
--    (el motivo de la habilitación o de la deshabilitación, quién y cuándo).
--    Las asignaciones existentes quedan habilitadas ('S').
--  * mae_muestreador_competencia_historial: cada habilitación y
--    deshabilitación con su motivo, para no perder los cambios anteriores.
--
-- Se puede ejecutar más de una vez (cada bloque comprueba si ya existe).

IF COL_LENGTH('mae_muestreador_competencia', 'observacion') IS NULL
BEGIN
    ALTER TABLE mae_muestreador_competencia ADD
        observacion            NVARCHAR(1000) NULL,
        id_usuario_asignacion  NUMERIC(10, 0) NULL;
END;
GO

IF COL_LENGTH('mae_muestreador_competencia', 'habilitado') IS NULL
BEGIN
    ALTER TABLE mae_muestreador_competencia ADD
        habilitado          CHAR(1)  NOT NULL CONSTRAINT DF_mae_muestreador_competencia_habilitado DEFAULT 'S',
        fecha_modificacion  DATETIME NULL;
END;
GO

IF OBJECT_ID('mae_muestreador_competencia_historial', 'U') IS NULL
BEGIN
    CREATE TABLE mae_muestreador_competencia_historial (
        id_historial    INT IDENTITY(1, 1) PRIMARY KEY,
        id_muestreador  NUMERIC(10, 0) NOT NULL,
        id_competencia  INT            NOT NULL,
        -- 'HABILITADA' | 'DESHABILITADA'
        accion          VARCHAR(20)    NOT NULL,
        observacion     NVARCHAR(1000) NOT NULL,
        id_usuario      NUMERIC(10, 0) NULL,
        fecha           DATETIME       NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_mae_muestreador_competencia_historial
        ON mae_muestreador_competencia_historial (id_muestreador, id_competencia, fecha);
END;
GO
