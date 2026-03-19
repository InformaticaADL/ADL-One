/*
==============================================================================
OBJETIVO: Crear una estructura de auditoría inmutable en SQL Server.
==============================================================================
*/

-- 1. Crear Función de Particionamiento (Mensual por fecha_registro)
-- Nota: Ajustar los límites según el período de retención deseado.
IF NOT EXISTS (SELECT * FROM sys.partition_functions WHERE name = 'PF_Audit_Monthly')
BEGIN
    CREATE PARTITION FUNCTION PF_Audit_Monthly (DATETIMEOFFSET)
    AS RANGE RIGHT FOR VALUES (
        '2024-01-01T00:00:00Z', '2024-02-01T00:00:00Z', '2024-03-01T00:00:00Z',
        '2024-04-01T00:00:00Z', '2024-05-01T00:00:00Z', '2024-06-01T00:00:00Z',
        '2024-07-01T00:00:00Z', '2024-08-01T00:00:00Z', '2024-09-01T00:00:00Z',
        '2024-10-01T00:00:00Z', '2024-11-01T00:00:00Z', '2024-12-01T00:00:00Z'
    );
END
GO

-- 2. Crear Esquema de Particionamiento
-- Nota: En un entorno real, 'PRIMARY' debería reemplazarse por filegroups específicos.
IF NOT EXISTS (SELECT * FROM sys.partition_schemes WHERE name = 'PS_Audit_Monthly')
BEGIN
    CREATE PARTITION SCHEME PS_Audit_Monthly
    AS PARTITION PF_Audit_Monthly
    ALL TO ([PRIMARY]);
END
GO

-- 3. Crear la Tabla de Auditoría
IF OBJECT_ID('[dbo].[App_Audit_Log]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[App_Audit_Log] (
        -- Identificación
        [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [usuario_id] NUMERIC(18,0) NOT NULL,      -- FK a mae_usuario
        [area_key] NVARCHAR(50) NOT NULL,        -- ej: 'ventas', 'it'
        [modulo_nombre] NVARCHAR(100) NOT NULL,  -- ej: 'nominas'
        [evento_tipo] NVARCHAR(50) NOT NULL,     -- ej: 'INSERT', 'UPDATE'

        -- Trazabilidad
        [entidad_nombre] NVARCHAR(100) NOT NULL, -- ej: 'App_Ma_FichaIngresoServicio_ENC'
        [entidad_id] NVARCHAR(100) NOT NULL,     -- soportar UUID o IDs numéricos
        [descripcion_humana] NVARCHAR(500) NULL,

        -- Payload (JSON)
        [datos_anteriores] NVARCHAR(MAX) NULL,
        [datos_nuevos] NVARCHAR(MAX) NULL,
        [metadatos_extra] NVARCHAR(MAX) NULL,

        -- Seguridad y Contexto de Red
        [ip_address] VARCHAR(45) NULL,
        [trace_id] UNIQUEIDENTIFIER NULL,
        [severidad] INT NOT NULL DEFAULT 1,      -- 1: Info, 2: Warning, 3: Critical
        [fecha_registro] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),

        -- Restricciones JSON (ISJSON previene datos mal formados en NVARCHAR(MAX))
        CONSTRAINT [CK_App_Audit_Log_DatosAnteriores_JSON] CHECK (ISJSON([datos_anteriores]) > 0 OR [datos_anteriores] IS NULL),
        CONSTRAINT [CK_App_Audit_Log_DatosNuevos_JSON] CHECK (ISJSON([datos_nuevos]) > 0 OR [datos_nuevos] IS NULL),
        CONSTRAINT [CK_App_Audit_Log_MetadatosExtra_JSON] CHECK (ISJSON([metadatos_extra]) > 0 OR [metadatos_extra] IS NULL),

        -- PK debe incluir la columna de partición
        CONSTRAINT [PK_App_Audit_Log] PRIMARY KEY CLUSTERED ([id], [fecha_registro])
    ) ON PS_Audit_Monthly([fecha_registro]);
END
GO

-- 4. Índices para Optimización
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_App_Audit_Log_Usuario' AND object_id = OBJECT_ID('[dbo].[App_Audit_Log]'))
BEGIN
    CREATE INDEX [IX_App_Audit_Log_Usuario] ON [dbo].[App_Audit_Log] ([usuario_id]) ON PS_Audit_Monthly([fecha_registro]);
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_App_Audit_Log_Area_Fecha' AND object_id = OBJECT_ID('[dbo].[App_Audit_Log]'))
BEGIN
    CREATE INDEX [IX_App_Audit_Log_Area_Fecha] ON [dbo].[App_Audit_Log] ([area_key], [fecha_registro]) ON PS_Audit_Monthly([fecha_registro]);
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_App_Audit_Log_Entidad' AND object_id = OBJECT_ID('[dbo].[App_Audit_Log]'))
BEGIN
    CREATE INDEX [IX_App_Audit_Log_Entidad] ON [dbo].[App_Audit_Log] ([entidad_nombre], [entidad_id]) ON PS_Audit_Monthly([fecha_registro]);
END
GO

-- 5. Trigger para Inmutabilidad (Solo permitir INSERT)
IF OBJECT_ID('[dbo].[TR_App_Audit_Log_Immutable]', 'TR') IS NOT NULL
BEGIN
    DROP TRIGGER [dbo].[TR_App_Audit_Log_Immutable];
END
GO

CREATE TRIGGER [TR_App_Audit_Log_Immutable]
ON [dbo].[App_Audit_Log]
FOR UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    RAISERROR ('La tabla App_Audit_Log es inmutable. No se permiten actualizaciones ni eliminaciones.', 16, 1);
    ROLLBACK TRANSACTION;
END
GO

-- 6. Notas de Implementación (Ejemplos de Eventos solicitados)
/*
   Para capturar los eventos solicitados, se recomienda usar los siguientes valores en [evento_tipo]:
   - 'FICHA_CREACION'
   - 'APROBACION_TECNICA', 'RECHAZO_TECNICA'
   - 'APROBACION_COORDINACION', 'RECHAZO_COORDINACION'
   - 'ASIGNACION_MUESTREO_COORDINACION'
   - 'SOLICITUD_ENVIADA_TECNICA'
   - 'SOLICITUD_RESPONDIDA_CALIDAD'
   - 'CAMBIO_COMERCIAL'
   - 'REASIGNACION_MUESTREADORES'
*/
