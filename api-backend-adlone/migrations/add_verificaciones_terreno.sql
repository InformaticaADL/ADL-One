-- Migration: add_verificaciones_terreno
-- Los tres formularios de terreno que se llenan a partir de un muestreo (su folio OI-FoMa-01):
--
--   OI-FoGe-26  Verificación intermedia de equipos pH/T°, oxígeno y cloro   → mae_ma_verif_equipos
--   OI-FoMa-03  Lista de verificación del muestreador automático            → mae_ma_verif_mau
--   OI-FoMa-19  Lista de chequeo de materiales y EPP                        → mae_ma_lista_materiales
--
-- Cada fila se ata al folio de App_Ma_Agenda_MUESTREOS: de ahí salen empresa, punto, fecha, muestreador y
-- los equipos usados con su error de temperatura (App_Ma_Equipos_MUESTREOS.error0/15/30), así que el
-- encabezado y las casillas de error llegan ya rellenados. Lo que el muestreador marca a mano va en los
-- campos JSON (`items`, `mediciones`), igual que `lecturas` en mae_verificacion_caudal.
--
-- Estados: BORRADOR (se está llenando) · FIRMADA (cerrada, queda en el archivo) · ANULADA.
-- Se puede ejecutar más de una vez.

-- ── OI-FoGe-26 · pH / oxígeno / cloro ────────────────────────────────────────
IF OBJECT_ID('mae_ma_verif_equipos', 'U') IS NULL
BEGIN
    CREATE TABLE mae_ma_verif_equipos (
        id_verificacion     INT IDENTITY(1, 1) PRIMARY KEY,
        folio_foma          NUMERIC(10, 0) NULL,                  -- Folio OI-FoMa-01 (App_Ma_Agenda_MUESTREOS.Folio)
        id_agendamam        NUMERIC(10, 0) NULL,
        fecha_verificacion  DATE           NOT NULL,
        hora_verificacion   VARCHAR(5)     NULL,
        responsable_muestreo NVARCHAR(150) NULL,
        lugar_muestreo      NVARCHAR(250)  NULL,
        empresa             NVARCHAR(200)  NULL,
        -- Un formulario cubre hasta tres equipos; cada uno con su checklist y sus mediciones.
        id_equipo_ph        NUMERIC(10, 0) NULL,
        codigo_equipo_ph    VARCHAR(100)   NULL,
        error_t0            DECIMAL(8, 2)  NULL,                  -- «2.- ERROR T°» del formato
        error_t15           DECIMAL(8, 2)  NULL,
        error_t30           DECIMAL(8, 2)  NULL,
        items_ph            NVARCHAR(MAX)  NULL,                  -- JSON {clave: 'C'|'NC'|'NA'}
        ajuste_ph           NVARCHAR(MAX)  NULL,                  -- JSON de la tabla Control Medición Ajuste
        verificacion_ph     NVARCHAR(MAX)  NULL,                  -- JSON de la tabla Control Medición Verificación
        id_equipo_oxigeno   NUMERIC(10, 0) NULL,
        codigo_equipo_oxigeno VARCHAR(100) NULL,
        items_oxigeno       NVARCHAR(MAX)  NULL,
        referencia_oxigeno  NVARCHAR(MAX)  NULL,                  -- JSON {lote, caducidad, marca}
        mediciones_oxigeno  NVARCHAR(MAX)  NULL,
        id_equipo_cloro     NUMERIC(10, 0) NULL,
        codigo_equipo_cloro VARCHAR(100)   NULL,
        items_cloro         NVARCHAR(MAX)  NULL,
        referencia_cloro    NVARCHAR(MAX)  NULL,
        mediciones_cloro    NVARCHAR(MAX)  NULL,
        observaciones       NVARCHAR(2000) NULL,
        estado              VARCHAR(15)    NOT NULL CONSTRAINT DF_ma_verif_eq_estado DEFAULT 'BORRADOR',
        firma               NVARCHAR(MAX)  NULL,
        nombre_firma        NVARCHAR(150)  NULL,
        fecha_firma         DATETIME       NULL,
        motivo_anulacion    NVARCHAR(300)  NULL,
        id_usuario_crea     NUMERIC(10, 0) NOT NULL,
        nombre_crea         NVARCHAR(150)  NULL,
        fecha_creacion      DATETIME       NOT NULL CONSTRAINT DF_ma_verif_eq_fecha DEFAULT GETDATE(),
        CONSTRAINT CK_ma_verif_eq_estado CHECK (estado IN ('BORRADOR', 'FIRMADA', 'ANULADA'))
    );
    CREATE INDEX IX_ma_verif_eq_folio ON mae_ma_verif_equipos (folio_foma);
    CREATE INDEX IX_ma_verif_eq_fecha ON mae_ma_verif_equipos (fecha_verificacion DESC);
END

-- ── OI-FoMa-03 · Muestreador automático ──────────────────────────────────────
IF OBJECT_ID('mae_ma_verif_mau', 'U') IS NULL
BEGIN
    CREATE TABLE mae_ma_verif_mau (
        id_verificacion     INT IDENTITY(1, 1) PRIMARY KEY,
        folio_foma          NUMERIC(10, 0) NULL,
        id_agendamam        NUMERIC(10, 0) NULL,
        fecha_verificacion  DATE           NOT NULL,
        hora_verificacion   VARCHAR(5)     NULL,
        responsable_muestreo NVARCHAR(150) NULL,
        lugar_muestreo      NVARCHAR(250)  NULL,
        empresa             NVARCHAR(200)  NULL,
        id_equipo           NUMERIC(10, 0) NULL,                  -- muestreador automático (MAU.__/MA.__)
        codigo_equipo       VARCHAR(100)   NULL,
        id_sonda_caudal     NUMERIC(10, 0) NULL,                  -- sonda de caudal (MCA.__/MA.__)
        codigo_sonda_caudal VARCHAR(100)   NULL,
        error_t0            DECIMAL(8, 2)  NULL,
        error_t15           DECIMAL(8, 2)  NULL,
        error_t30           DECIMAL(8, 2)  NULL,
        items               NVARCHAR(MAX)  NULL,                  -- JSON {clave: 'C'|'NC'|'NA'} de los 20 parámetros
        nivel_real          DECIMAL(12, 3) NULL,
        nivel_equipo        DECIMAL(12, 3) NULL,
        acepta_nivel        BIT            NULL,
        volumen_obtenido    DECIMAL(12, 3) NULL,
        volumen_real        DECIMAL(12, 3) NULL,
        acepta_volumen      BIT            NULL,
        hora_inicio         VARCHAR(5)     NULL,
        hora_termino        VARCHAR(5)     NULL,
        observaciones       NVARCHAR(2000) NULL,
        estado              VARCHAR(15)    NOT NULL CONSTRAINT DF_ma_verif_mau_estado DEFAULT 'BORRADOR',
        firma               NVARCHAR(MAX)  NULL,
        nombre_firma        NVARCHAR(150)  NULL,
        fecha_firma         DATETIME       NULL,
        motivo_anulacion    NVARCHAR(300)  NULL,
        id_usuario_crea     NUMERIC(10, 0) NOT NULL,
        nombre_crea         NVARCHAR(150)  NULL,
        fecha_creacion      DATETIME       NOT NULL CONSTRAINT DF_ma_verif_mau_fecha DEFAULT GETDATE(),
        CONSTRAINT CK_ma_verif_mau_estado CHECK (estado IN ('BORRADOR', 'FIRMADA', 'ANULADA'))
    );
    CREATE INDEX IX_ma_verif_mau_folio ON mae_ma_verif_mau (folio_foma);
    CREATE INDEX IX_ma_verif_mau_fecha ON mae_ma_verif_mau (fecha_verificacion DESC);
END

-- ── OI-FoMa-19 · Materiales y EPP ────────────────────────────────────────────
IF OBJECT_ID('mae_ma_lista_materiales', 'U') IS NULL
BEGIN
    CREATE TABLE mae_ma_lista_materiales (
        id_lista            INT IDENTITY(1, 1) PRIMARY KEY,
        folio_foma          NUMERIC(10, 0) NULL,
        id_agendamam        NUMERIC(10, 0) NULL,
        fecha               DATE           NOT NULL,
        empresa             NVARCHAR(200)  NULL,
        muestreador         NVARCHAR(150)  NULL,
        lote_lavado         NVARCHAR(100)  NULL,
        -- «Características de la muestra»: se precarga desde el tipo de agua del muestreo.
        caracteristica      VARCHAR(20)    NULL,                  -- AS | RIL | MAR | SUPERFICIAL | OTROS
        caracteristica_otro NVARCHAR(150)  NULL,
        items               NVARCHAR(MAX)  NULL,                  -- JSON {clave: true} de lo que se lleva
        observaciones       NVARCHAR(2000) NULL,
        estado              VARCHAR(15)    NOT NULL CONSTRAINT DF_ma_lista_mat_estado DEFAULT 'BORRADOR',
        firma               NVARCHAR(MAX)  NULL,
        nombre_firma        NVARCHAR(150)  NULL,
        fecha_firma         DATETIME       NULL,
        motivo_anulacion    NVARCHAR(300)  NULL,
        id_usuario_crea     NUMERIC(10, 0) NOT NULL,
        nombre_crea         NVARCHAR(150)  NULL,
        fecha_creacion      DATETIME       NOT NULL CONSTRAINT DF_ma_lista_mat_fecha DEFAULT GETDATE(),
        CONSTRAINT CK_ma_lista_mat_estado CHECK (estado IN ('BORRADOR', 'FIRMADA', 'ANULADA')),
        CONSTRAINT CK_ma_lista_mat_carac CHECK (caracteristica IS NULL OR caracteristica IN ('AS', 'RIL', 'MAR', 'SUPERFICIAL', 'OTROS'))
    );
    CREATE INDEX IX_ma_lista_mat_folio ON mae_ma_lista_materiales (folio_foma);
    CREATE INDEX IX_ma_lista_mat_fecha ON mae_ma_lista_materiales (fecha DESC);
END

-- ── Permisos ─────────────────────────────────────────────────────────────────
-- Ver y llenar los tres formularios. Se asignan a las mismas áreas que ya administran equipos.
IF NOT EXISTS (SELECT 1 FROM mae_permiso WHERE codigo = 'MA_VERIF_TERRENO')
    INSERT INTO mae_permiso (codigo, nombre, modulo, submodulo, tipo, orden, habilitado)
    VALUES ('MA_VERIF_TERRENO', 'Verificaciones de terreno (OI-FoGe-26, OI-FoMa-03, OI-FoMa-19)',
            'Gestión de Calidad', 'Medio Ambiente', 'ACCESO', 100, 1);

INSERT INTO rel_rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM mae_rol r CROSS JOIN mae_permiso p
WHERE p.codigo = 'MA_VERIF_TERRENO'
  AND r.nombre_rol IN ('Área Gestión de Calidad', 'Área Informática', 'Área Técnica MAM', 'Área Coordinación MAM')
  AND NOT EXISTS (SELECT 1 FROM rel_rol_permiso x WHERE x.id_rol = r.id_rol AND x.id_permiso = p.id_permiso);

-- ── Encabezado de los tres formularios (Revisión documental) ─────────────────
IF OBJECT_ID('mae_documento_control', 'U') IS NOT NULL
BEGIN
    INSERT INTO mae_documento_control (codigo, nombre, version, fecha_vigencia)
    SELECT d.codigo, d.nombre, d.version, d.fecha_vigencia
    FROM (VALUES
        ('OI-FoGe-26', N'Lista de Verificación intermedia de equipo pH, Temperatura oxígeno y cloro', N'Versión 07', '2021-08-13'),
        ('OI-FoMa-03', N'Lista de Verificación Muestreador Automático', N'Versión 06', '2016-07-18'),
        ('OI-FoMa-19', N'Lista de Verificación Materiales y equipos de muestreo', N'Versión 00', '2016-07-18')
    ) AS d(codigo, nombre, version, fecha_vigencia)
    WHERE NOT EXISTS (SELECT 1 FROM mae_documento_control c WHERE c.codigo = d.codigo);
END

SELECT 'mae_ma_verif_equipos'    AS tabla, COUNT(*) AS filas FROM mae_ma_verif_equipos
UNION ALL SELECT 'mae_ma_verif_mau', COUNT(*) FROM mae_ma_verif_mau
UNION ALL SELECT 'mae_ma_lista_materiales', COUNT(*) FROM mae_ma_lista_materiales
UNION ALL SELECT 'permiso MA_VERIF_TERRENO (roles)', COUNT(*)
          FROM rel_rol_permiso rp JOIN mae_permiso p ON p.id_permiso = rp.id_permiso WHERE p.codigo = 'MA_VERIF_TERRENO';
