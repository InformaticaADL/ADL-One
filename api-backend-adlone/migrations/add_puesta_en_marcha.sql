-- Migration: add_puesta_en_marcha
-- Puesta en Marcha de equipos (formulario OI-FoGe-42), como registro propio: una fila por puesta en marcha, con su
-- verificación o validación compartida (Área Técnica de Medio Ambiente y Gestión de Calidad: si una realiza, la otra
-- valida) y los documentos que se adjuntan después.
--
--   mae_puesta_marcha           La puesta en marcha: equipo, fecha, tipo (equipo nuevo, retorno de servicio externo, cambio
--                               de sede, reactivación), recepción (Cumple / No cumple), funcionamiento (Operativo /
--                               No operativo), patrón de referencia, observación, verificación vinculada y las dos firmas.
--   mae_puesta_marcha_adjunto   Documentos que se asocian a la puesta en marcha (informe del proveedor, certificado, etc.).
--
-- Estados: PENDIENTE_FIRMA (faltan firmas) · APROBADA (con las dos firmas; entra al historial del equipo) · ANULADA.
-- Se puede ejecutar más de una vez.

IF OBJECT_ID('mae_puesta_marcha', 'U') IS NULL
BEGIN
    CREATE TABLE mae_puesta_marcha (
        id_puesta_marcha     INT IDENTITY(1, 1) PRIMARY KEY,
        id_equipo            NUMERIC(10, 0) NOT NULL,
        codigo_equipo        VARCHAR(100)   NULL,
        nombre_equipo        NVARCHAR(200)  NULL,
        sede                 VARCHAR(10)    NULL,
        tipo                 VARCHAR(20)    NOT NULL,                 -- EQUIPO_NUEVO · RETORNO_SERVICIO · CAMBIO_SEDE · REACTIVACION
        fecha                DATE           NOT NULL,                 -- cuándo se realizó la puesta en marcha
        area_realiza         VARCHAR(10)    NOT NULL,                 -- TECNICA · CALIDAD: la otra valida
        estado_recepcion     VARCHAR(10)    NOT NULL,                 -- CUMPLE · NO_CUMPLE
        funcionamiento       VARCHAR(12)    NOT NULL,                 -- OPERATIVO · NO_OPERATIVO (sale de la recepción)
        patron_referencia    NVARCHAR(300)  NULL,                     -- equipo (tipo y código) o buffer usado
        observacion          NVARCHAR(1500) NOT NULL,
        verificacion_tipo    VARCHAR(12)    NULL,                     -- TEMPERATURA · CAUDAL
        verificacion_id      INT            NULL,                     -- mae_verificacion_temperatura (si es de temperatura)
        verificacion_codigo  NVARCHAR(100)  NULL,                     -- código del documento vinculado
        verificacion_fecha   DATE           NULL,
        estado               VARCHAR(15)    NOT NULL CONSTRAINT DF_mae_puesta_marcha_estado DEFAULT 'PENDIENTE_FIRMA',
        firma_tecnica        NVARCHAR(MAX)  NULL,
        nombre_tecnica       NVARCHAR(150)  NULL,
        id_usuario_tecnica   NUMERIC(10, 0) NULL,
        fecha_firma_tecnica  DATETIME       NULL,
        firma_calidad        NVARCHAR(MAX)  NULL,
        nombre_calidad       NVARCHAR(150)  NULL,
        id_usuario_calidad   NUMERIC(10, 0) NULL,
        fecha_firma_calidad  DATETIME       NULL,
        en_historial         BIT            NOT NULL CONSTRAINT DF_mae_puesta_marcha_hist DEFAULT 0,
        motivo_anulacion     NVARCHAR(300)  NULL,
        id_usuario_crea      NUMERIC(10, 0) NOT NULL,
        nombre_crea          NVARCHAR(150)  NULL,
        fecha_creacion       DATETIME       NOT NULL CONSTRAINT DF_mae_puesta_marcha_creacion DEFAULT GETDATE(),
        fecha_modificacion   DATETIME       NULL
    );
    CREATE INDEX IX_mae_puesta_marcha_equipo ON mae_puesta_marcha (id_equipo, fecha);
END
GO

IF OBJECT_ID('mae_puesta_marcha_adjunto', 'U') IS NULL
BEGIN
    CREATE TABLE mae_puesta_marcha_adjunto (
        id_adjunto        INT IDENTITY(1, 1) PRIMARY KEY,
        id_puesta_marcha  INT            NOT NULL,
        documento         NVARCHAR(200)  NOT NULL,                    -- qué documento es (lo digita quien lo adjunta)
        archivo_nombre    NVARCHAR(260)  NOT NULL,
        archivo_ruta      NVARCHAR(500)  NOT NULL,
        id_usuario        NUMERIC(10, 0) NULL,
        nombre_usuario    NVARCHAR(150)  NULL,
        fecha             DATETIME       NOT NULL CONSTRAINT DF_mae_puesta_marcha_adj_fecha DEFAULT GETDATE(),
        CONSTRAINT FK_mae_puesta_marcha_adj FOREIGN KEY (id_puesta_marcha) REFERENCES mae_puesta_marcha (id_puesta_marcha)
    );
END
GO

-- Link en el menú lateral de "G. Calidad".
IF NOT EXISTS (SELECT 1 FROM mae_menu_link WHERE id_modulo = 'gestion_calidad' AND id_accion = 'gc-puesta-marcha')
    INSERT INTO mae_menu_link (id_modulo, id_accion, label, permissions_str, sort_order, activo)
    VALUES ('gestion_calidad', 'gc-puesta-marcha', 'Puesta en Marcha', 'MA_A_GEST_EQUIPO,GC_ACCESO', 24, 1);
GO
