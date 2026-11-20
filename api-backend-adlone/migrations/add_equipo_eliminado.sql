-- Migration: add_equipo_eliminado
-- Eliminación DEFINITIVA de un equipo (distinta de "Dar de baja", que es una baja suave: habilitado='N' pero el
-- registro sigue en mae_equipo). Pensada solo para ingresos erróneos: un equipo recién creado por error, que
-- todavía no tiene verificaciones, fichas guardadas ni puesta en marcha asociadas (si ya las tiene, se bloquea
-- y hay que usar "Dar de baja" en su lugar — esos son documentos y no se borran).
--
-- Borra el registro de mae_equipo y su propio historial (mae_equipo_historial), liberando el correlativo para que
-- un equipo nuevo del mismo tipo pueda reutilizarlo. Antes de borrar, deja una copia completa en
-- mae_equipo_eliminado (snapshot en JSON + motivo que escribió quien elimina + quién y cuándo), para tener
-- registro de qué se eliminó aunque el equipo ya no exista.
--
-- Requiere el permiso EQ_ELIMINAR_DEFINITIVO (Configurar rol / permisos), que se asigna acá a los roles de
-- Informática. Se puede ejecutar más de una vez.

IF OBJECT_ID('mae_equipo_eliminado', 'U') IS NULL
BEGIN
    CREATE TABLE mae_equipo_eliminado (
        id_eliminado        INT IDENTITY(1, 1) PRIMARY KEY,
        id_equipo_original   NUMERIC(10, 0) NOT NULL,
        codigo               VARCHAR(100)   NULL,
        nombre               NVARCHAR(200)  NULL,
        tipoequipo           NVARCHAR(200)  NULL,
        sede                 VARCHAR(10)    NULL,
        snapshot_json        NVARCHAR(MAX)  NOT NULL,               -- la fila completa de mae_equipo tal como estaba
        motivo               NVARCHAR(500)  NOT NULL,               -- observación obligatoria de quién elimina
        id_usuario_elimina   NUMERIC(10, 0) NULL,
        nombre_usuario       NVARCHAR(150)  NULL,
        fecha_eliminacion    DATETIME       NOT NULL CONSTRAINT DF_mae_equipo_eliminado_fecha DEFAULT GETDATE()
    );
    CREATE INDEX IX_mae_equipo_eliminado_fecha ON mae_equipo_eliminado (fecha_eliminacion DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM mae_permiso WHERE codigo = 'EQ_ELIMINAR_DEFINITIVO')
BEGIN
    INSERT INTO mae_permiso (codigo, modulo, submodulo, nombre, tipo, orden, habilitado)
    VALUES ('EQ_ELIMINAR_DEFINITIVO', 'Gestión de Calidad', 'EQUIPOS',
            N'Equipos: eliminar definitivamente (solo ingresos erróneos, sin verificaciones ni fichas asociadas)', 'ACCION', 136, 1);
END
GO

-- Se asigna a los roles de Informática (sin distinguir tildes ni mayúsculas), igual que el resto de permisos
-- nuevos de Gestión de Calidad (ver add_permisos_gestion_calidad.sql). Después se ajusta en Configurar rol / permisos.
INSERT INTO rel_rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM mae_rol r
CROSS JOIN mae_permiso p
WHERE p.codigo = 'EQ_ELIMINAR_DEFINITIVO'
  AND r.nombre_rol COLLATE Latin1_General_CI_AI LIKE '%informatica%'
  AND NOT EXISTS (SELECT 1 FROM rel_rol_permiso x WHERE x.id_rol = r.id_rol AND x.id_permiso = p.id_permiso);
GO
