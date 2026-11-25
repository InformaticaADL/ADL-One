-- Migration: add_calidad_auditorias
-- G. Calidad → Calidad: archivo de quejas y apelaciones cerradas y auditorías internas (base ADL-One).
--
--   mae_gc_qa_archivo            Copia de cada queja o apelación CERRADA en ADLWeb (la copia el scheduler; si el caso se
--                                reabre y se vuelve a cerrar, la copia se actualiza). `tipo` distingue QUEJA / APELACION.
--   mae_gc_iso_elemento          Elementos del sistema de calidad que se auditan (OI-FoGe-07), editables.
--   mae_gc_programa_auditoria    Programa anual de auditorías internas (OI-FoGe-07): uno por año.
--   mae_gc_programa_item         Cada mes marcado de un elemento en el programa (= una auditoría programada).
--   mae_gc_auditoria             Una auditoría interna: plan (OI-FoGe-08) e informe (OI-FoGe-11).
--   mae_gc_auditoria_agenda      Filas del plan: horario, área, criterio, auditor (OI-FoGe-08).
--   mae_gc_auditoria_asistente   Asistentes y firmas de la reunión inicial y final (OI-FoGe-10).
--   mae_gc_auditoria_hoja        Hoja de hallazgos por área / proceso (OI-FoGe-09).
--   mae_gc_auditoria_hallazgo    Requisitos verificados en cada hoja: C / NC / OBS (OI-FoGe-09).
--   mae_gc_accion_correctiva     Acción correctiva (OI-FoGe-02) de una NC de auditoría u otro origen.
--
-- Permisos (Configurar rol / permisos → Gestión de Calidad):
--   GC_AUDITORIAS          Ver auditorías internas y el listado / archivo de quejas y apelaciones.
--   GC_AUDITORIAS_EDITAR   Crear y editar programa, auditorías, hallazgos, informes y acciones correctivas.
-- Se asignan a los roles de Gestión de Calidad e Informática.
--
-- Se puede ejecutar más de una vez.

-- ── Archivo de quejas y apelaciones cerradas ─────────────────────────────────
IF OBJECT_ID('mae_gc_qa_archivo', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_qa_archivo (
        id_archivo          INT IDENTITY(1, 1) PRIMARY KEY,
        id_caso_adlweb      INT            NOT NULL,              -- dbo.quejas_apelaciones.id en ADLWeb
        tipo                VARCHAR(10)    NOT NULL,              -- QUEJA · APELACION
        folio               NVARCHAR(50)   NULL,
        origen              VARCHAR(10)    NULL,                  -- INTERNO · EXTERNO
        empresa             NVARCHAR(150)  NULL,
        nombre              NVARCHAR(150)  NULL,
        correo              NVARCHAR(254)  NULL,
        fecha_recepcion     DATE           NULL,
        motivo              NVARCHAR(MAX)  NULL,
        conclusiones        NVARCHAR(MAX)  NULL,
        responsable         NVARCHAR(150)  NULL,
        estado              VARCHAR(20)    NOT NULL,              -- cerrada · no_procede
        procede             BIT            NULL,
        cerrado_en          DATETIME       NULL,
        actualizado_adlweb  DATETIME       NULL,                  -- para saber si cambió desde la última copia
        acciones            INT            NOT NULL CONSTRAINT DF_gc_qa_archivo_acciones DEFAULT 0,
        datos               NVARCHAR(MAX)  NOT NULL,              -- el caso completo (registro, evaluación, tratamiento, notificaciones, acciones) en JSON
        fecha_copia         DATETIME       NOT NULL CONSTRAINT DF_gc_qa_archivo_copia DEFAULT GETDATE(),
        fecha_actualizacion DATETIME       NULL,
        CONSTRAINT UQ_gc_qa_archivo_caso UNIQUE (id_caso_adlweb),
        CONSTRAINT CK_gc_qa_archivo_tipo CHECK (tipo IN ('QUEJA', 'APELACION'))
    );
    CREATE INDEX IX_gc_qa_archivo_fecha ON mae_gc_qa_archivo (tipo, fecha_recepcion);
END
GO

-- ── Elementos del sistema de calidad (OI-FoGe-07) ────────────────────────────
IF OBJECT_ID('mae_gc_iso_elemento', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_iso_elemento (
        id_elemento  INT IDENTITY(1, 1) PRIMARY KEY,
        referencia   NVARCHAR(30)  NULL,                          -- «4.1», «7.5; 7.6»; vacío para «Seguimiento Auditoría Previa»
        nombre       NVARCHAR(200) NOT NULL,
        orden        INT           NOT NULL,
        activo       BIT           NOT NULL CONSTRAINT DF_gc_iso_elemento_activo DEFAULT 1
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM mae_gc_iso_elemento)
    INSERT INTO mae_gc_iso_elemento (referencia, nombre, orden) VALUES
        (NULL, N'Seguimiento Auditoría Previa', 1),
        (N'4.1', N'Imparcialidad e Independencia', 2),
        (N'4.1.1', N'Matriz de Imparcialidad', 3),
        (N'4.2', N'Confidencialidad', 4),
        (N'5.1', N'Requisitos Administrativos', 5),
        (N'5.1.1', N'Matriz de Riesgos y Disposiciones para cubrir negligencias técnicas', 6),
        (N'5.2', N'Organización y Gestión', 7),
        (N'6.1', N'Personal', 8),
        (N'6.2', N'Instalaciones', 9),
        (N'6.2', N'Equipos', 10),
        (N'6.2.11', N'Abastecimiento, Evaluación de Proveedores, Almacenamiento', 11),
        (N'6.3', N'Subcontratación', 12),
        (N'7.1', N'Métodos y Procedimientos de Inspección', 13),
        (N'7.1.5', N'Revisión de Solicitudes y Cotizaciones', 14),
        (N'7.2', N'Tratamiento de los Ítems de Inspección y de Muestra', 15),
        (N'7.3', N'Registros de Inspección', 16),
        (N'7.4', N'Informes de Inspección', 17),
        (N'7.5; 7.6', N'Quejas y Apelaciones', 18),
        (N'8.1', N'Requisitos Relativos al Sistema de Gestión', 19),
        (N'8.2', N'Documentos del Sistema de Gestión', 20),
        (N'8.3', N'Control de Documentos', 21),
        (N'8.4', N'Control de los registros', 22),
        (N'8.5', N'Revisión por la Dirección', 23),
        (N'8.6', N'Auditorías Internas', 24),
        (N'8.7', N'Acciones Correctivas', 25),
        (N'8.8', N'Acciones Preventivas', 26);
GO

-- ── Programa anual (OI-FoGe-07) ──────────────────────────────────────────────
IF OBJECT_ID('mae_gc_programa_auditoria', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_programa_auditoria (
        id_programa         INT IDENTITY(1, 1) PRIMARY KEY,
        anio                INT            NOT NULL,
        fecha_actualizacion DATE           NULL,
        observaciones       NVARCHAR(1000) NULL,
        id_usuario_crea     NUMERIC(10, 0) NULL,
        nombre_crea         NVARCHAR(150)  NULL,
        fecha_creacion      DATETIME       NOT NULL CONSTRAINT DF_gc_programa_creacion DEFAULT GETDATE(),
        fecha_modificacion  DATETIME       NULL,
        CONSTRAINT UQ_gc_programa_anio UNIQUE (anio)
    );
END
GO

IF OBJECT_ID('mae_gc_programa_item', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_programa_item (
        id_item      INT IDENTITY(1, 1) PRIMARY KEY,
        id_programa  INT           NOT NULL,
        id_elemento  INT           NOT NULL,
        referencia   NVARCHAR(30)  NULL,                          -- copia del elemento al programarlo (si después se edita, el programa no cambia)
        elemento     NVARCHAR(200) NOT NULL,
        mes          TINYINT       NOT NULL,                      -- 1..12
        estado       VARCHAR(15)   NOT NULL CONSTRAINT DF_gc_programa_item_estado DEFAULT 'PROGRAMADA', -- PROGRAMADA · REALIZADA · REPROGRAMADA · CANCELADA
        id_auditoria INT           NULL,                          -- la auditoría que lo cubre
        CONSTRAINT UQ_gc_programa_item UNIQUE (id_programa, id_elemento, mes),
        CONSTRAINT CK_gc_programa_item_mes CHECK (mes BETWEEN 1 AND 12)
    );
END
GO

-- ── Auditoría: plan (OI-FoGe-08) e informe (OI-FoGe-11) ──────────────────────
IF OBJECT_ID('mae_gc_auditoria', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_auditoria (
        id_auditoria            INT IDENTITY(1, 1) PRIMARY KEY,
        folio                   VARCHAR(20)    NULL,              -- AI-2026-01
        anio                    INT            NOT NULL,
        mes                     TINYINT        NULL,
        id_programa             INT            NULL,
        estado                  VARCHAR(15)    NOT NULL CONSTRAINT DF_gc_auditoria_estado DEFAULT 'PLANIFICADA', -- PLANIFICADA · EN_CURSO · CERRADA · ANULADA
        -- Plan
        fecha                   DATE           NULL,
        objetivos               NVARCHAR(2000) NULL,
        alcance                 NVARCHAR(2000) NULL,
        auditor_lider           NVARCHAR(150)  NULL,
        -- Reunión inicial y final
        fecha_reunion_inicial   DATE           NULL,
        fecha_reunion_final     DATE           NULL,
        -- Informe
        representante_auditado  NVARCHAR(300)  NULL,
        documentos_referencia   NVARCHAR(2000) NULL,
        entrevistados           NVARCHAR(2000) NULL,
        descripcion_hallazgos   NVARCHAR(MAX)  NULL,
        juicio_auditor          NVARCHAR(MAX)  NULL,
        capacidad_sistema       NVARCHAR(MAX)  NULL,
        oportunidades           NVARCHAR(MAX)  NULL,
        distribucion            NVARCHAR(1000) NULL,
        fecha_informe           DATE           NULL,
        firma_auditor_lider     NVARCHAR(MAX)  NULL,
        motivo_anulacion        NVARCHAR(300)  NULL,
        id_usuario_crea         NUMERIC(10, 0) NULL,
        nombre_crea             NVARCHAR(150)  NULL,
        fecha_creacion          DATETIME       NOT NULL CONSTRAINT DF_gc_auditoria_creacion DEFAULT GETDATE(),
        fecha_modificacion      DATETIME       NULL
    );
    CREATE INDEX IX_gc_auditoria_anio ON mae_gc_auditoria (anio, mes);
END
GO

IF OBJECT_ID('mae_gc_auditoria_agenda', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_auditoria_agenda (
        id_agenda    INT IDENTITY(1, 1) PRIMARY KEY,
        id_auditoria INT            NOT NULL,
        orden        INT            NOT NULL CONSTRAINT DF_gc_agenda_orden DEFAULT 0,
        horario      NVARCHAR(50)   NULL,
        area         NVARCHAR(200)  NULL,
        criterio     NVARCHAR(500)  NULL,                         -- elemento(s) ISO que se auditan
        auditor      NVARCHAR(150)  NULL,
        observacion  NVARCHAR(1000) NULL
    );
    CREATE INDEX IX_gc_agenda_auditoria ON mae_gc_auditoria_agenda (id_auditoria, orden);
END
GO

IF OBJECT_ID('mae_gc_auditoria_asistente', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_auditoria_asistente (
        id_asistente INT IDENTITY(1, 1) PRIMARY KEY,
        id_auditoria INT            NOT NULL,
        reunion      VARCHAR(10)    NOT NULL,                     -- INICIAL · FINAL
        orden        INT            NOT NULL CONSTRAINT DF_gc_asistente_orden DEFAULT 0,
        nombre       NVARCHAR(150)  NOT NULL,
        cargo        NVARCHAR(150)  NULL,
        firma        NVARCHAR(MAX)  NULL,                         -- imagen data:image/png;base64
        fecha_firma  DATETIME       NULL,
        CONSTRAINT CK_gc_asistente_reunion CHECK (reunion IN ('INICIAL', 'FINAL'))
    );
    CREATE INDEX IX_gc_asistente_auditoria ON mae_gc_auditoria_asistente (id_auditoria, reunion, orden);
END
GO

-- ── Hallazgos (OI-FoGe-09) ───────────────────────────────────────────────────
IF OBJECT_ID('mae_gc_auditoria_hoja', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_auditoria_hoja (
        id_hoja                 INT IDENTITY(1, 1) PRIMARY KEY,
        id_auditoria            INT            NOT NULL,
        id_agenda               INT            NULL,              -- fila del plan de la que salió
        orden                   INT            NOT NULL CONSTRAINT DF_gc_hoja_orden DEFAULT 0,
        area                    NVARCHAR(200)  NULL,
        auditor                 NVARCHAR(150)  NULL,
        fecha                   DATE           NULL,
        observaciones_oportunidades NVARCHAR(MAX) NULL
    );
    CREATE INDEX IX_gc_hoja_auditoria ON mae_gc_auditoria_hoja (id_auditoria, orden);
END
GO

IF OBJECT_ID('mae_gc_auditoria_hallazgo', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_auditoria_hallazgo (
        id_hallazgo         INT IDENTITY(1, 1) PRIMARY KEY,
        id_hoja             INT            NOT NULL,
        id_auditoria        INT            NOT NULL,
        orden               INT            NOT NULL CONSTRAINT DF_gc_hallazgo_orden DEFAULT 0,
        requisito           NVARCHAR(500)  NULL,
        que_verificar       NVARCHAR(1000) NULL,
        evidencia           NVARCHAR(MAX)  NULL,
        resultado           VARCHAR(3)     NULL,                  -- C · NC · OBS
        observaciones       NVARCHAR(1000) NULL,
        id_accion           INT            NULL,                  -- acción correctiva abierta por esta NC
        CONSTRAINT CK_gc_hallazgo_resultado CHECK (resultado IS NULL OR resultado IN ('C', 'NC', 'OBS'))
    );
    CREATE INDEX IX_gc_hallazgo_hoja ON mae_gc_auditoria_hallazgo (id_hoja, orden);
    CREATE INDEX IX_gc_hallazgo_auditoria ON mae_gc_auditoria_hallazgo (id_auditoria, resultado);
END
GO

-- ── Acciones correctivas (OI-FoGe-02) ────────────────────────────────────────
IF OBJECT_ID('mae_gc_accion_correctiva', 'U') IS NULL
BEGIN
    CREATE TABLE mae_gc_accion_correctiva (
        id_accion               INT IDENTITY(1, 1) PRIMARY KEY,
        folio                   VARCHAR(20)    NULL,              -- AC-2026-01
        origen                  VARCHAR(25)    NOT NULL,          -- AUDITORIA_INTERNA · AUDITORIA_EXTERNA_2 · AUDITORIA_EXTERNA_3 · QUEJA · APELACION · REVISION_GERENCIA · AUTODETECTADA · OTRO
        origen_otro             NVARCHAR(150)  NULL,
        id_auditoria            INT            NULL,
        id_hallazgo             INT            NULL,
        estado                  VARCHAR(10)    NOT NULL CONSTRAINT DF_gc_ac_estado DEFAULT 'ABIERTA', -- ABIERTA · CERRADA · ANULADA
        area                    NVARCHAR(200)  NULL,
        fecha_deteccion         DATE           NULL,
        fecha_inicio            DATE           NULL,
        detectado_por           NVARCHAR(300)  NULL,              -- nombre y cargo
        requisito               NVARCHAR(500)  NULL,
        -- Sección I
        hallazgo                NVARCHAR(MAX)  NULL,
        justificacion           NVARCHAR(MAX)  NULL,
        correccion_inmediata    NVARCHAR(MAX)  NULL,
        procede_ac              BIT            NULL,
        -- Sección II
        participantes           NVARCHAR(1000) NULL,
        tecnica                 NVARCHAR(200)  NULL,
        alcance                 NVARCHAR(MAX)  NULL,
        -- Sección III
        accion_propuesta        NVARCHAR(MAX)  NULL,
        responsable             NVARCHAR(150)  NULL,
        plazo                   DATE           NULL,
        fecha_seguimiento       DATE           NULL,
        cumplimiento_plazo      BIT            NULL,
        observaciones           NVARCHAR(MAX)  NULL,
        -- Sección IV
        seguimientos            NVARCHAR(MAX)  NULL,              -- JSON: [{ fecha, cumplimiento, responsable, observaciones }] (hasta 3)
        eficacia                NVARCHAR(MAX)  NULL,
        causa_eliminada         BIT            NULL,
        se_levanta_nc           BIT            NULL,
        observaciones_finales   NVARCHAR(MAX)  NULL,
        cierre_nombre           NVARCHAR(150)  NULL,
        cierre_fecha            DATE           NULL,
        cierre_firma            NVARCHAR(MAX)  NULL,
        motivo_anulacion        NVARCHAR(300)  NULL,
        id_usuario_crea         NUMERIC(10, 0) NULL,
        nombre_crea             NVARCHAR(150)  NULL,
        fecha_creacion          DATETIME       NOT NULL CONSTRAINT DF_gc_ac_creacion DEFAULT GETDATE(),
        fecha_modificacion      DATETIME       NULL
    );
    CREATE INDEX IX_gc_ac_auditoria ON mae_gc_accion_correctiva (id_auditoria);
    CREATE INDEX IX_gc_ac_estado ON mae_gc_accion_correctiva (estado, plazo);
END
GO

-- ── Formularios en Revisión documental (encabezado de cada PDF) ──────────────
IF OBJECT_ID('mae_documento_control', 'U') IS NOT NULL
BEGIN
    DECLARE @d TABLE (codigo VARCHAR(20), nombre NVARCHAR(200), version VARCHAR(20));
    INSERT INTO @d VALUES
        ('OI-FoGe-02', N'Acción Correctiva', 'Versión 02'),
        ('OI-FoGe-06', N'Listado de Quejas y Apelaciones', 'Versión 01'),
        ('OI-FoGe-07', N'Programa Anual de Auditorías Internas', 'Versión 02'),
        ('OI-FoGe-08', N'Plan de Auditoría Interna', 'Versión 01'),
        ('OI-FoGe-09', N'Hallazgos de Auditoría', 'Versión 01'),
        ('OI-FoGe-10', N'Reunión Inicial y Final Auditoría Interna', 'Versión 01'),
        ('OI-FoGe-11', N'Informe de Auditorías Internas', 'Versión 01');
    INSERT INTO mae_documento_control (codigo, nombre, version, fecha_vigencia)
    SELECT d.codigo, d.nombre, d.version, '2016-06-20' FROM @d d
    WHERE NOT EXISTS (SELECT 1 FROM mae_documento_control x WHERE x.codigo = d.codigo);
END
GO

-- ── Permisos ─────────────────────────────────────────────────────────────────
INSERT INTO mae_permiso (codigo, modulo, submodulo, nombre, tipo, orden, habilitado)
SELECT n.codigo, 'Gestión de Calidad', 'CALIDAD', n.nombre, n.tipo, n.orden, 1
FROM (VALUES
    ('GC_AUDITORIAS', N'Calidad: ver auditorías internas, acciones correctivas y el listado de quejas y apelaciones', 'VISTA', 137),
    ('GC_AUDITORIAS_EDITAR', N'Calidad: crear y editar programa, auditorías, hallazgos, informes y acciones correctivas', 'ACCION', 138)
) n (codigo, nombre, tipo, orden)
WHERE NOT EXISTS (SELECT 1 FROM mae_permiso x WHERE x.codigo = n.codigo);
GO

INSERT INTO rel_rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM mae_rol r
JOIN mae_permiso p ON p.codigo IN ('GC_AUDITORIAS', 'GC_AUDITORIAS_EDITAR')
WHERE (r.nombre_rol COLLATE Latin1_General_CI_AI LIKE '%gestion de calidad%'
    OR r.nombre_rol COLLATE Latin1_General_CI_AI LIKE '%informatica%')
  AND NOT EXISTS (SELECT 1 FROM rel_rol_permiso x WHERE x.id_rol = r.id_rol AND x.id_permiso = p.id_permiso);
GO

-- Para revisar.
SELECT p.codigo, r.nombre_rol
FROM rel_rol_permiso rp
JOIN mae_permiso p ON p.id_permiso = rp.id_permiso
JOIN mae_rol r ON r.id_rol = rp.id_rol
WHERE p.codigo IN ('GC_AUDITORIAS', 'GC_AUDITORIAS_EDITAR')
ORDER BY p.codigo, r.nombre_rol;
SELECT COUNT(*) AS elementos_iso FROM mae_gc_iso_elemento;
