-- Migration: add_firmas_pendientes_fichas
-- Fichas de equipo que se envían a firmar: quien las prepara (un asistente de Gestión de Calidad - Medio
-- Ambiente) las revisa y las envía; las personas que deben firmar reciben una solicitud de firma (sección
-- "Firmas pendientes" de Solicitudes), firman y, cuando firman todas, la ficha se guarda en el archivo de
-- documentos de Gestión de Calidad (mae_gc_documento) y a quien la preparó le llega un aviso.
--
--   mae_ficha_firma            Cada ficha enviada a firmar: de qué equipo, con qué datos se llenó (JSON, sin las
--                              firmas de quienes aún no firman), en qué estado está y quién la preparó.
--   mae_ficha_firma_firmante   Quién debe firmarla (responsable de entrega, responsable de área), si ya firmó, cómo
--                              (su firma registrada o en el momento) y la imagen de su firma.
--
-- Estados de la ficha: PENDIENTE (faltan firmas) · COMPLETA (firmaron todos; id_documento apunta al archivo) ·
-- CANCELADA (la anuló quien la preparó). Por ahora el único tipo de ficha es ENTREGA (OI-FoGe-36).
-- Se puede ejecutar más de una vez.

IF OBJECT_ID('mae_ficha_firma', 'U') IS NULL
BEGIN
    CREATE TABLE mae_ficha_firma (
        id_ficha_firma     INT IDENTITY(1, 1) PRIMARY KEY,
        tipo_ficha         VARCHAR(20)    NOT NULL CONSTRAINT DF_mae_ficha_firma_tipo DEFAULT 'ENTREGA',
        id_equipo          NUMERIC(10, 0) NULL,
        codigo_equipo      VARCHAR(100)   NULL,
        nombre_equipo      NVARCHAR(200)  NULL,
        sede               VARCHAR(10)    NULL,
        datos              NVARCHAR(MAX)  NOT NULL,                 -- JSON del formulario tal como se envió
        estado             VARCHAR(15)    NOT NULL CONSTRAINT DF_mae_ficha_firma_estado DEFAULT 'PENDIENTE',
        id_usuario_crea    NUMERIC(10, 0) NOT NULL,                 -- quién la preparó y envió
        nombre_crea        NVARCHAR(150)  NULL,
        fecha_creacion     DATETIME       NOT NULL CONSTRAINT DF_mae_ficha_firma_creacion DEFAULT GETDATE(),
        fecha_completa     DATETIME       NULL,
        id_documento       INT            NULL,                     -- → mae_gc_documento, cuando queda completa
        motivo_cancelacion NVARCHAR(300)  NULL,
        fecha_cancelacion  DATETIME       NULL,
        CONSTRAINT CK_mae_ficha_firma_tipo CHECK (tipo_ficha IN ('ENTREGA')),
        CONSTRAINT CK_mae_ficha_firma_estado CHECK (estado IN ('PENDIENTE', 'COMPLETA', 'CANCELADA'))
    );
END
GO

IF OBJECT_ID('mae_ficha_firma_firmante', 'U') IS NULL
BEGIN
    CREATE TABLE mae_ficha_firma_firmante (
        id_firmante     INT IDENTITY(1, 1) PRIMARY KEY,
        id_ficha_firma  INT            NOT NULL,
        rol             VARCHAR(20)    NOT NULL,                    -- ENTREGA | RESPONSABLE_AREA
        id_usuario      NUMERIC(10, 0) NOT NULL,                    -- quién debe firmar (mae_usuario)
        nombre          NVARCHAR(150)  NULL,
        cargo           NVARCHAR(150)  NULL,
        estado          VARCHAR(12)    NOT NULL CONSTRAINT DF_mae_ficha_firma_firmante_estado DEFAULT 'PENDIENTE',
        imagen          NVARCHAR(MAX)  NULL,                        -- firma en data URL, al firmar
        modo            VARCHAR(15)    NULL,                        -- GUARDADA (su firma registrada) | EN_EL_MOMENTO
        id_firma        INT            NULL,                        -- versión de mae_firma_digital usada (GUARDADA)
        fecha_firma     DATETIME       NULL,
        CONSTRAINT FK_mae_ficha_firma_firmante_ficha FOREIGN KEY (id_ficha_firma) REFERENCES mae_ficha_firma (id_ficha_firma),
        CONSTRAINT CK_mae_ficha_firma_firmante_rol CHECK (rol IN ('ENTREGA', 'RESPONSABLE_AREA')),
        CONSTRAINT CK_mae_ficha_firma_firmante_estado CHECK (estado IN ('PENDIENTE', 'FIRMADA')),
        CONSTRAINT CK_mae_ficha_firma_firmante_modo CHECK (modo IS NULL OR modo IN ('GUARDADA', 'EN_EL_MOMENTO'))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mae_ficha_firma_firmante_ficha' AND object_id = OBJECT_ID('mae_ficha_firma_firmante'))
    CREATE INDEX IX_mae_ficha_firma_firmante_ficha ON mae_ficha_firma_firmante (id_ficha_firma);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mae_ficha_firma_firmante_usuario' AND object_id = OBJECT_ID('mae_ficha_firma_firmante'))
    CREATE INDEX IX_mae_ficha_firma_firmante_usuario ON mae_ficha_firma_firmante (id_usuario, estado);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mae_ficha_firma_crea' AND object_id = OBJECT_ID('mae_ficha_firma'))
    CREATE INDEX IX_mae_ficha_firma_crea ON mae_ficha_firma (id_usuario_crea, estado, fecha_creacion);
GO
