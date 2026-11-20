-- Esquema completo de Facturación Salud y Aprobaciones en ADLFacturacion
-- Correlativos IDENTITY(1,1) limpios desde 1, sin dependencia de Mae_id ni mf = 3.

IF OBJECT_ID('dbo.facturacion_enc', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.facturacion_enc (
        id_facturacion          INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        id_empresaservicio      NUMERIC(10, 0) NOT NULL,
        nombre_empresaservicios VARCHAR(250) NOT NULL DEFAULT '',
        rut_empresaservicios    VARCHAR(30) NOT NULL DEFAULT '',
        sigla                   VARCHAR(50) NOT NULL DEFAULT '',
        fecha_facturacion       VARCHAR(10) NOT NULL DEFAULT '',
        uf_totalotrosing        NUMERIC(14, 3) NOT NULL DEFAULT 0,
        uf_totalotrosdes        NUMERIC(14, 3) NOT NULL DEFAULT 0,
        uf_totalcaso            NUMERIC(14, 3) NOT NULL DEFAULT 0,
        uf_totalfac             NUMERIC(14, 3) NOT NULL DEFAULT 0,
        uf                      NUMERIC(14, 4) NOT NULL DEFAULT 0,
        mf                      INT NOT NULL DEFAULT 1,
        facturado_por           VARCHAR(60) NOT NULL DEFAULT 'Na',
        valor_agrupacion        VARCHAR(200) NOT NULL DEFAULT '',
        fecha_proceso_ini       VARCHAR(10) NOT NULL DEFAULT '',
        fecha_proceso_fin       VARCHAR(10) NOT NULL DEFAULT '',
        factura                 NUMERIC(12, 0) NOT NULL DEFAULT 0,
        fecha_informe_ini       VARCHAR(10) NOT NULL DEFAULT '',
        fecha_informe_fin       VARCHAR(10) NOT NULL DEFAULT '',
        peso_totalfac           NUMERIC(18, 0) NOT NULL DEFAULT 0,
        id_formapago            NUMERIC(10, 0) NOT NULL DEFAULT 1,
        nombre_formapago        VARCHAR(120) NOT NULL DEFAULT '',
        mes                     VARCHAR(40) NOT NULL DEFAULT '',
        id_glosa                NUMERIC(10, 0) NOT NULL DEFAULT 1,
        nombre_glosa            VARCHAR(300) NOT NULL DEFAULT '',
        observaciones           VARCHAR(1000) NOT NULL DEFAULT '',
        glosa                   VARCHAR(1000) NOT NULL DEFAULT '',
        emitido                 VARCHAR(1) NOT NULL DEFAULT '',
        ocompra                 VARCHAR(100) NOT NULL DEFAULT '',
        ocompra_fecha           VARCHAR(10) NOT NULL DEFAULT '',
        nota                    VARCHAR(1000) NOT NULL DEFAULT '',
        ano                     INT NULL,
        usd                     NUMERIC(14, 4) NOT NULL DEFAULT 0,
        usd_totalfac            NUMERIC(14, 3) NOT NULL DEFAULT 0,
        pdf                     VARCHAR(300) NULL,
        eliminado               VARCHAR(1) NOT NULL DEFAULT 'N',
        id_programa             NUMERIC(10, 0) NOT NULL DEFAULT 0,
        nombre_programa         VARCHAR(200) NOT NULL DEFAULT '',
        sigla_programa          VARCHAR(30) NOT NULL DEFAULT '',
        eligeprograma           INT NOT NULL DEFAULT 4,
        criterio_agrupacion     VARCHAR(60) NOT NULL DEFAULT 'Na',
        id_lote_emision         INT NULL,
        usuario_crea            VARCHAR(100) NOT NULL DEFAULT '',
        fecha_crea              DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        usuario_elimina         VARCHAR(100) NULL,
        fecha_elimina           DATETIME2 NULL
    );
    CREATE INDEX IX_facturacion_enc_estado ON dbo.facturacion_enc (eliminado, emitido, id_facturacion DESC);
    CREATE INDEX IX_facturacion_enc_factura ON dbo.facturacion_enc (factura);
END;

IF OBJECT_ID('dbo.facturacion_det', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.facturacion_det (
        id_detalle          BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        id_facturacion      INT NOT NULL,
        id_caso             NUMERIC(10, 0) NOT NULL,
        item                INT NOT NULL,
        id_tecnica          NUMERIC(10, 0) NOT NULL,
        n_analisis          NUMERIC(12, 2) NOT NULL DEFAULT 0,
        vtaunitario         NUMERIC(14, 4) NOT NULL DEFAULT 0,
        vtatotal            NUMERIC(14, 4) NOT NULL DEFAULT 0,
        uf                  NUMERIC(14, 4) NOT NULL DEFAULT 0,
        usd                 NUMERIC(14, 4) NOT NULL DEFAULT 0,
        caso_adlab          VARCHAR(40) NOT NULL DEFAULT '',
        n_recepcion         VARCHAR(40) NOT NULL DEFAULT '',
        fecha_recepcion     VARCHAR(10) NOT NULL DEFAULT '',
        fecha_muestreo      VARCHAR(10) NOT NULL DEFAULT '',
        fecha_informe       VARCHAR(10) NOT NULL DEFAULT '',
        id_programa         NUMERIC(10, 0) NOT NULL DEFAULT 0,
        nombre_programa     VARCHAR(200) NOT NULL DEFAULT '',
        id_centro           NUMERIC(10, 0) NOT NULL DEFAULT 0,
        nombre_centro       VARCHAR(200) NOT NULL DEFAULT '',
        id_tipoagua         NUMERIC(10, 0) NOT NULL DEFAULT 0,
        nombre_tipoagua     VARCHAR(100) NOT NULL DEFAULT '',
        cliente_entrega     VARCHAR(200) NOT NULL DEFAULT '',
        nombre_tecnica      VARCHAR(250) NOT NULL DEFAULT '',
        nombre_organo       VARCHAR(200) NOT NULL DEFAULT '',
        nombre_medios       VARCHAR(150) NOT NULL DEFAULT '',
        multiplex           VARCHAR(10) NOT NULL DEFAULT '',
        regla_aplicada      VARCHAR(200) NOT NULL DEFAULT '',
        id_empresaservicio  NUMERIC(10, 0) NOT NULL DEFAULT 0,
        CONSTRAINT FK_facturacion_det_enc FOREIGN KEY (id_facturacion) REFERENCES dbo.facturacion_enc(id_facturacion)
    );
    CREATE INDEX IX_facturacion_det_factura ON dbo.facturacion_det (id_facturacion);
    CREATE INDEX IX_facturacion_det_caso_item ON dbo.facturacion_det (id_caso, item, id_tecnica);
END;

IF OBJECT_ID('dbo.facturacion_valorizacion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.facturacion_valorizacion (
        id_caso             NUMERIC(10, 0) NOT NULL,
        item                INT NOT NULL,
        id_tecnica          NUMERIC(10, 0) NOT NULL,
        id_empresaservicio  NUMERIC(10, 0) NOT NULL,
        eligeprograma       INT NOT NULL DEFAULT 4,
        n_analisis          NUMERIC(12, 2) NOT NULL DEFAULT 0,
        vtaunitario         NUMERIC(14, 4) NOT NULL DEFAULT 0,
        vtatotal            NUMERIC(14, 4) NOT NULL DEFAULT 0,
        uf                  NUMERIC(14, 4) NOT NULL DEFAULT 0,
        usd                 NUMERIC(14, 4) NOT NULL DEFAULT 0,
        mf                  INT NOT NULL DEFAULT 1,
        regla_aplicada      VARCHAR(200) NOT NULL DEFAULT '',
        ind_nmuestras       NUMERIC(10, 0) NOT NULL DEFAULT 0,
        pol_npooles         NUMERIC(10, 0) NOT NULL DEFAULT 0,
        fecha_valorizacion  DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT PK_facturacion_valorizacion PRIMARY KEY (id_caso, item, id_tecnica)
    );
END;

IF OBJECT_ID('dbo.facturacion_des', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.facturacion_des (
        id_des              BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        id_facturacion      INT NOT NULL,
        id_otrosdescuentos  NUMERIC(10, 0) NOT NULL,
        nombre_otrosdescuentos VARCHAR(250) NOT NULL DEFAULT '',
        valor               NUMERIC(14, 3) NOT NULL DEFAULT 0,
        peso                NUMERIC(18, 0) NOT NULL DEFAULT 0,
        observacion         VARCHAR(500) NOT NULL DEFAULT '',
        CONSTRAINT FK_facturacion_des_enc FOREIGN KEY (id_facturacion) REFERENCES dbo.facturacion_enc(id_facturacion)
    );
    CREATE INDEX IX_facturacion_des_factura ON dbo.facturacion_des (id_facturacion);
END;

IF OBJECT_ID('dbo.facturacion_ing', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.facturacion_ing (
        id_ing              BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        id_facturacion      INT NOT NULL,
        id_otrosingresos    NUMERIC(10, 0) NOT NULL,
        nombre_otrosingresos VARCHAR(250) NOT NULL DEFAULT '',
        valor               NUMERIC(14, 3) NOT NULL DEFAULT 0,
        peso                NUMERIC(18, 0) NOT NULL DEFAULT 0,
        observacion         VARCHAR(500) NOT NULL DEFAULT '',
        id_guia             NUMERIC(10, 0) NULL,
        CONSTRAINT FK_facturacion_ing_enc FOREIGN KEY (id_facturacion) REFERENCES dbo.facturacion_enc(id_facturacion)
    );
    CREATE INDEX IX_facturacion_ing_factura ON dbo.facturacion_ing (id_facturacion);
END;

IF OBJECT_ID('dbo.facturacion_ocompra', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.facturacion_ocompra (
        id_ocompra      BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        id_facturacion  INT NOT NULL,
        ocompra         VARCHAR(100) NOT NULL DEFAULT '',
        ocompra_fecha   VARCHAR(10) NOT NULL DEFAULT '',
        referencia      VARCHAR(300) NOT NULL DEFAULT '',
        tipo            VARCHAR(10) NOT NULL DEFAULT 'OC',
        orden           INT NOT NULL DEFAULT 1,
        CONSTRAINT FK_facturacion_ocompra_enc FOREIGN KEY (id_facturacion) REFERENCES dbo.facturacion_enc(id_facturacion)
    );
    CREATE INDEX IX_facturacion_ocompra_factura ON dbo.facturacion_ocompra (id_facturacion);
END;

IF OBJECT_ID('dbo.facturacion_oc', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.facturacion_oc (
        id_oc           BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        id_facturacion  INT NOT NULL,
        oc              VARCHAR(100) NOT NULL,
        oc_fecha_emision VARCHAR(10) NOT NULL DEFAULT '',
        oc_moneda       VARCHAR(10) NOT NULL DEFAULT '$',
        oc_valor        NUMERIC(16, 4) NOT NULL DEFAULT 0,
        oc_conversion   NUMERIC(18, 0) NOT NULL DEFAULT 0,
        id_usuario      NUMERIC(10, 0) NOT NULL DEFAULT 0,
        fecha           VARCHAR(10) NOT NULL DEFAULT '',
        hora            VARCHAR(10) NOT NULL DEFAULT '',
        CONSTRAINT FK_facturacion_oc_enc FOREIGN KEY (id_facturacion) REFERENCES dbo.facturacion_enc(id_facturacion)
    );
    CREATE INDEX IX_facturacion_oc_factura ON dbo.facturacion_oc (id_facturacion);
END;

IF OBJECT_ID('dbo.facturacion_guias', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.facturacion_guias (
        id_guia         NUMERIC(10, 0) NOT NULL PRIMARY KEY,
        id_facturacion  INT NOT NULL,
        estado          VARCHAR(30) NOT NULL DEFAULT 'FACTURADO',
        fecha_factura   VARCHAR(10) NOT NULL DEFAULT '',
        uf              NUMERIC(14, 4) NOT NULL DEFAULT 0,
        CONSTRAINT FK_facturacion_guias_enc FOREIGN KEY (id_facturacion) REFERENCES dbo.facturacion_enc(id_facturacion)
    );
END;

IF OBJECT_ID('dbo.facturacion_otro', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.facturacion_otro (
        id_facturacion      INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        id_empresaservicio  NUMERIC(10, 0) NOT NULL,
        nombre_empresaservicios VARCHAR(250) NOT NULL DEFAULT '',
        rut_empresaservicios VARCHAR(30) NOT NULL DEFAULT '',
        tipo_documento      VARCHAR(10) NOT NULL DEFAULT 'OV',
        fecha               VARCHAR(10) NOT NULL DEFAULT '',
        mes                 VARCHAR(40) NOT NULL DEFAULT '',
        id_glosa            NUMERIC(10, 0) NOT NULL DEFAULT 0,
        glosa               VARCHAR(1000) NOT NULL DEFAULT '',
        id_formapago        NUMERIC(10, 0) NOT NULL DEFAULT 1,
        uf_totalfac         NUMERIC(14, 3) NOT NULL DEFAULT 0,
        uf                  NUMERIC(14, 4) NOT NULL DEFAULT 0,
        peso_totalfac       NUMERIC(18, 0) NOT NULL DEFAULT 0,
        usd                 NUMERIC(14, 4) NOT NULL DEFAULT 0,
        usd_totalfac        NUMERIC(14, 3) NOT NULL DEFAULT 0,
        factura             NUMERIC(12, 0) NOT NULL DEFAULT 0,
        emitido             VARCHAR(1) NOT NULL DEFAULT '',
        eliminado           VARCHAR(1) NOT NULL DEFAULT 'N',
        nota                VARCHAR(1000) NOT NULL DEFAULT '',
        observaciones       VARCHAR(1000) NOT NULL DEFAULT '',
        id_facturacion_ref  INT NULL,
        usuario_crea        VARCHAR(100) NOT NULL DEFAULT '',
        fecha_crea          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END;

-- Extensiones de facturacion_otro para Otras Ventas, NC/ND y exportacion DTE 100% en ADLFacturacion
IF COL_LENGTH('dbo.facturacion_otro', 'id_otroscobros') IS NULL ALTER TABLE dbo.facturacion_otro ADD id_otroscobros NUMERIC(10, 0) NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.facturacion_otro', 'id_tipodocumento') IS NULL ALTER TABLE dbo.facturacion_otro ADD id_tipodocumento NUMERIC(10, 0) NOT NULL DEFAULT 1;
IF COL_LENGTH('dbo.facturacion_otro', 'concepto_cobro') IS NULL ALTER TABLE dbo.facturacion_otro ADD concepto_cobro VARCHAR(200) NOT NULL DEFAULT '';
IF COL_LENGTH('dbo.facturacion_otro', 'numero_documento') IS NULL ALTER TABLE dbo.facturacion_otro ADD numero_documento NUMERIC(10, 0) NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.facturacion_otro', 'fecha_documento') IS NULL ALTER TABLE dbo.facturacion_otro ADD fecha_documento VARCHAR(10) NOT NULL DEFAULT '';
IF COL_LENGTH('dbo.facturacion_otro', 'monto') IS NULL ALTER TABLE dbo.facturacion_otro ADD monto NUMERIC(14, 0) NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.facturacion_otro', 'monto_uf') IS NULL ALTER TABLE dbo.facturacion_otro ADD monto_uf NUMERIC(14, 3) NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.facturacion_otro', 'observacion') IS NULL ALTER TABLE dbo.facturacion_otro ADD observacion VARCHAR(1000) NOT NULL DEFAULT '';
IF COL_LENGTH('dbo.facturacion_otro', 'mf') IS NULL ALTER TABLE dbo.facturacion_otro ADD mf NUMERIC(10, 0) NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.facturacion_otro', 'tipo_ref') IS NULL ALTER TABLE dbo.facturacion_otro ADD tipo_ref VARCHAR(20) NOT NULL DEFAULT '';
IF COL_LENGTH('dbo.facturacion_otro', 'num_ref') IS NULL ALTER TABLE dbo.facturacion_otro ADD num_ref VARCHAR(20) NOT NULL DEFAULT '';
IF COL_LENGTH('dbo.facturacion_otro', 'fecha_ref') IS NULL ALTER TABLE dbo.facturacion_otro ADD fecha_ref VARCHAR(10) NOT NULL DEFAULT '';
IF COL_LENGTH('dbo.facturacion_otro', 'cod_razon') IS NULL ALTER TABLE dbo.facturacion_otro ADD cod_razon NUMERIC(10, 0) NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.facturacion_otro', 'motivo') IS NULL ALTER TABLE dbo.facturacion_otro ADD motivo VARCHAR(200) NOT NULL DEFAULT '';
IF COL_LENGTH('dbo.facturacion_otro', 'tipoimpuesto') IS NULL ALTER TABLE dbo.facturacion_otro ADD tipoimpuesto VARCHAR(5) NOT NULL DEFAULT 'AFE';

IF OBJECT_ID('dbo.fac_aprobacion_cambio_empresa', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.fac_aprobacion_cambio_empresa (
        id_aprobacion               INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        origen_modulo               VARCHAR(40) NOT NULL DEFAULT 'FACTURACION_SALUD',
        id_facturacion              NUMERIC(10, 0) NOT NULL,
        factura                     NUMERIC(10, 0) NULL DEFAULT 0,
        id_empresaservicio_anterior NUMERIC(10, 0) NOT NULL,
        rut_empresa_anterior        VARCHAR(30) NULL,
        nombre_empresa_anterior     VARCHAR(250) NOT NULL,
        id_empresaservicio_nueva    NUMERIC(10, 0) NOT NULL,
        rut_empresa_nueva           VARCHAR(30) NULL,
        nombre_empresa_nueva        VARCHAR(250) NOT NULL,
        cantidad_casos              INT NOT NULL DEFAULT 0,
        casos_detalle               VARCHAR(1000) NULL,
        uf_totalfac                 NUMERIC(12, 3) NULL DEFAULT 0,
        motivo_solicitud            VARCHAR(500) NOT NULL,
        id_usuario_solicita         NUMERIC(10, 0) NOT NULL DEFAULT 0,
        usuario_solicita            VARCHAR(100) NOT NULL,
        fecha_solicitud             DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        estado                      VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
        id_usuario_resuelve         NUMERIC(10, 0) NULL,
        usuario_resuelve            VARCHAR(100) NULL,
        fecha_resolucion            DATETIME2 NULL,
        comentario_resolucion       VARCHAR(500) NULL
    );
    CREATE INDEX IX_fac_aprob_estado ON dbo.fac_aprobacion_cambio_empresa (estado, id_facturacion);
END;

IF OBJECT_ID('dbo.auditoria', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.auditoria (
        id_auditoria    BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        id_referencia   NUMERIC(10, 0) NOT NULL,
        referencia      VARCHAR(150) NOT NULL,
        campo           VARCHAR(100) NOT NULL,
        original        VARCHAR(500) NULL,
        tipo            VARCHAR(30) NOT NULL,
        nuevo           VARCHAR(500) NULL,
        motivo          VARCHAR(500) NULL,
        id_usuario      NUMERIC(10, 0) NOT NULL DEFAULT 0,
        fecha_evento    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END;
