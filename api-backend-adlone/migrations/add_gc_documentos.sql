-- Migration: add_gc_documentos
-- Documentos de Gestión de Calidad generados y guardados desde ADL One (desde
-- ahora los formularios se hacen en digital). Dos tablas:
--
--   mae_gc_formulario  Catálogo de formularios de Gestión de Calidad: código,
--                      nombre, área, módulo, versión y fechas del formato.
--   mae_gc_documento   Cada documento guardado: a qué formulario corresponde,
--                      de qué módulo (Equipos / Muestreadores) y de qué equipo o
--                      muestreador es, el PDF tal como salió (con sus firmas),
--                      los datos con que se llenó, quién lo hizo y cuándo.
--   mae_gc_documento_firma  Quién firmó cada documento, en qué calidad y con
--                      qué versión de su firma (mae_firma_digital).
--
-- Módulos:
--   EQUIPOS        documentos de un equipo        (entidad_tipo = 'EQUIPO',      id_entidad = mae_equipo.id_equipo)
--   MUESTREADORES  documentos de un muestreador   (entidad_tipo = 'MUESTREADOR', id_entidad = mae_muestreador.id_muestreador)
--
-- Un documento guardado no se modifica: si hay un error se anula (estado
-- ANULADO, con motivo) y se guarda uno nuevo.
--
-- Se puede ejecutar más de una vez.

-- ── Catálogo de formularios ────────────────────────────────────────────────
IF OBJECT_ID('mae_gc_formulario', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_formulario (
        codigo_formulario  VARCHAR(20)    NOT NULL PRIMARY KEY,   -- ej. OI-FoGe-22
        nombre             NVARCHAR(150)  NOT NULL,               -- ej. Ficha Técnica de Equipos
        area               NVARCHAR(80)   NOT NULL,               -- área dueña del formulario
        modulo             VARCHAR(20)    NOT NULL,               -- EQUIPOS | MUESTREADORES
        tipo_documento     VARCHAR(30)    NOT NULL,               -- clave interna (FICHA_TECNICA, HISTORIAL…)
        version            VARCHAR(20)    NULL,                   -- ej. Versión 01
        fecha_vigencia     DATE           NULL,
        fecha_revision     DATE           NULL,
        descripcion        NVARCHAR(300)  NULL,
        activo             BIT            NOT NULL CONSTRAINT DF_mae_gc_formulario_activo DEFAULT 1,
        CONSTRAINT CK_mae_gc_formulario_modulo CHECK (modulo IN ('EQUIPOS', 'MUESTREADORES'))
    );
END
GO

-- Formularios de equipos que ya se generan en ADL One.
MERGE mae_gc_formulario AS t
USING (VALUES
    ('OI-FoGe-22', N'Ficha Técnica de Equipos', 'FICHA_TECNICA', 'Versión 01', '2016-06-20', '2026-01-12',
     N'Datos del equipo, frecuencias y registro de calibraciones y mantenciones.'),
    ('OI-FoGe-24', N'Historial de Equipo', 'HISTORIAL', 'Versión 01', '2016-06-20', '2026-01-12',
     N'Observaciones del equipo de un año.'),
    ('OI-FoGe-36', N'Ficha Entrega de Equipo', 'ENTREGA', 'Versión 01', '2013-03-10', '2026-01-12',
     N'Acta de entrega del equipo a su responsable.'),
    ('OI-FoGe-42', N'Recepción, Puesta en Marcha y Verificación de Equipo', 'RECEPCION', 'Versión 01', '2020-12-28', '2026-01-12',
     N'Revisión del equipo al llegar: caja, contenido, puesta en marcha y verificación.')
) AS s (codigo_formulario, nombre, tipo_documento, version, fecha_vigencia, fecha_revision, descripcion)
ON t.codigo_formulario = s.codigo_formulario
WHEN NOT MATCHED THEN
    INSERT (codigo_formulario, nombre, area, modulo, tipo_documento, version, fecha_vigencia, fecha_revision, descripcion)
    VALUES (s.codigo_formulario, s.nombre, N'Gestión de Calidad', 'EQUIPOS', s.tipo_documento, s.version, s.fecha_vigencia, s.fecha_revision, s.descripcion);
GO

-- ── Documentos guardados ───────────────────────────────────────────────────
IF OBJECT_ID('mae_gc_documento', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_documento (
        id_documento       INT IDENTITY(1, 1) PRIMARY KEY,
        -- Qué es
        codigo_formulario  VARCHAR(20)    NOT NULL,               -- → mae_gc_formulario
        area               NVARCHAR(80)   NOT NULL,               -- copia del formulario al guardar
        modulo             VARCHAR(20)    NOT NULL,               -- EQUIPOS | MUESTREADORES
        tipo_documento     VARCHAR(30)    NOT NULL,               -- FICHA_TECNICA, HISTORIAL, ENTREGA, RECEPCION…
        -- De quién es (equipo o muestreador). id_entidad NULL: el equipo se
        -- estaba creando y aún no tenía id (queda su código y nombre).
        entidad_tipo       VARCHAR(20)    NOT NULL,               -- EQUIPO | MUESTREADOR
        id_entidad         NUMERIC(10, 0) NULL,
        codigo_entidad     VARCHAR(100)   NULL,                   -- ej. STP.01/MA.PM
        nombre_entidad     NVARCHAR(200)  NULL,                   -- ej. Sonda termometro patrón
        sede               VARCHAR(10)    NULL,
        -- Periodo que cubre (ej. el historial de un año) y fecha del documento.
        anio               INT            NULL,
        fecha_documento    DATE           NOT NULL CONSTRAINT DF_mae_gc_documento_fecha_doc DEFAULT CAST(GETDATE() AS DATE),
        -- El documento
        nombre_archivo     NVARCHAR(200)  NOT NULL,
        pdf                VARBINARY(MAX) NOT NULL,               -- PDF tal como salió, con sus firmas
        tamano_bytes       INT            NULL,
        datos              NVARCHAR(MAX)  NULL,                   -- JSON con lo que se llenó (sin las imágenes de firma)
        con_firmas         BIT            NOT NULL CONSTRAINT DF_mae_gc_documento_firmas DEFAULT 0,
        -- Estado
        estado             VARCHAR(15)    NOT NULL CONSTRAINT DF_mae_gc_documento_estado DEFAULT 'VIGENTE',
        motivo_anulacion   NVARCHAR(300)  NULL,
        fecha_anulacion    DATETIME       NULL,
        id_usuario_anula   NUMERIC(10, 0) NULL,
        -- Quién y cuándo
        id_usuario         NUMERIC(10, 0) NULL,
        nombre_usuario     NVARCHAR(150)  NULL,
        fecha_creacion     DATETIME       NOT NULL CONSTRAINT DF_mae_gc_documento_creacion DEFAULT GETDATE(),
        CONSTRAINT FK_mae_gc_documento_formulario FOREIGN KEY (codigo_formulario) REFERENCES mae_gc_formulario (codigo_formulario),
        CONSTRAINT CK_mae_gc_documento_modulo CHECK (modulo IN ('EQUIPOS', 'MUESTREADORES')),
        CONSTRAINT CK_mae_gc_documento_entidad CHECK (entidad_tipo IN ('EQUIPO', 'MUESTREADOR')),
        CONSTRAINT CK_mae_gc_documento_estado CHECK (estado IN ('VIGENTE', 'ANULADO'))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mae_gc_documento_entidad' AND object_id = OBJECT_ID('mae_gc_documento'))
    CREATE INDEX IX_mae_gc_documento_entidad ON mae_gc_documento (modulo, entidad_tipo, id_entidad, codigo_formulario, fecha_creacion);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mae_gc_documento_formulario' AND object_id = OBJECT_ID('mae_gc_documento'))
    CREATE INDEX IX_mae_gc_documento_formulario ON mae_gc_documento (codigo_formulario, fecha_documento);
GO

-- ── Firmas de cada documento ───────────────────────────────────────────────
-- Una fila por cada firma que lleva un documento guardado: quién firmó, en qué
-- calidad y cómo. La imagen no se repite aquí (ya va dentro del PDF).
--   rol   REALIZA | VALIDA | RECIBE | ENTREGA | RESPONSABLE_AREA
--   modo  GUARDADA       usó su firma del perfil → id_firma = versión usada
--                        (mae_firma_digital.id_firma; si la persona cambia su
--                        firma después, el documento sigue apuntando a esta)
--         EN_EL_MOMENTO  la dibujó al llenar el documento (sin id_firma)
-- tipo_firmante / id_firmante quedan en NULL cuando quien firma no es un
-- usuario ni un muestreador identificado (ej. quien recibe un equipo, por nombre).
IF OBJECT_ID('mae_gc_documento_firma', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_documento_firma (
        id_documento_firma  INT IDENTITY(1, 1) PRIMARY KEY,
        id_documento        INT            NOT NULL,              -- → mae_gc_documento
        rol                 VARCHAR(20)    NOT NULL,
        tipo_firmante       VARCHAR(15)    NULL,                  -- USUARIO | MUESTREADOR
        id_firmante         NUMERIC(10, 0) NULL,
        nombre_firmante     NVARCHAR(150)  NULL,                  -- como aparece en el documento
        cargo               NVARCHAR(150)  NULL,
        modo                VARCHAR(15)    NOT NULL,              -- GUARDADA | EN_EL_MOMENTO
        id_firma            INT            NULL,                  -- → mae_firma_digital (solo GUARDADA)
        fecha_firma         DATETIME       NOT NULL CONSTRAINT DF_mae_gc_documento_firma_fecha DEFAULT GETDATE(),
        CONSTRAINT FK_mae_gc_documento_firma_documento FOREIGN KEY (id_documento) REFERENCES mae_gc_documento (id_documento),
        CONSTRAINT CK_mae_gc_documento_firma_rol CHECK (rol IN ('REALIZA', 'VALIDA', 'RECIBE', 'ENTREGA', 'RESPONSABLE_AREA')),
        CONSTRAINT CK_mae_gc_documento_firma_tipo CHECK (tipo_firmante IS NULL OR tipo_firmante IN ('USUARIO', 'MUESTREADOR')),
        CONSTRAINT CK_mae_gc_documento_firma_modo CHECK (modo IN ('GUARDADA', 'EN_EL_MOMENTO'))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mae_gc_documento_firma_documento' AND object_id = OBJECT_ID('mae_gc_documento_firma'))
    CREATE INDEX IX_mae_gc_documento_firma_documento ON mae_gc_documento_firma (id_documento);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mae_gc_documento_firma_firmante' AND object_id = OBJECT_ID('mae_gc_documento_firma'))
    CREATE INDEX IX_mae_gc_documento_firma_firmante ON mae_gc_documento_firma (tipo_firmante, id_firmante, rol);
GO
