IF OBJECT_ID('dbo.fac_aprobacion_cambio_empresa', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.fac_aprobacion_cambio_empresa (
        id_aprobacion               INT IDENTITY(1,1) PRIMARY KEY,
        origen_modulo               VARCHAR(30) NOT NULL DEFAULT 'SALUD',
        id_facturacion              NUMERIC(10, 0) NOT NULL,
        factura                     NUMERIC(10, 0) NULL,
        id_empresaservicio_anterior NUMERIC(10, 0) NOT NULL,
        rut_empresa_anterior        VARCHAR(30) NULL,
        nombre_empresa_anterior     VARCHAR(250) NOT NULL,
        id_empresaservicio_nueva    NUMERIC(10, 0) NOT NULL,
        rut_empresa_nueva           VARCHAR(30) NULL,
        nombre_empresa_nueva        VARCHAR(250) NOT NULL,
        cantidad_casos              INT NOT NULL DEFAULT 0,
        casos_detalle               VARCHAR(1000) NULL,
        uf_totalfac                 NUMERIC(12, 3) NULL,
        motivo_solicitud            VARCHAR(500) NOT NULL,
        id_usuario_solicita         NUMERIC(10, 0) NOT NULL DEFAULT 0,
        usuario_solicita            VARCHAR(100) NOT NULL,
        fecha_solicitud             DATETIME NOT NULL DEFAULT GETDATE(),
        estado                      VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
        id_usuario_resuelve         NUMERIC(10, 0) NULL,
        usuario_resuelve            VARCHAR(100) NULL,
        fecha_resolucion            DATETIME NULL,
        comentario_resolucion       VARCHAR(500) NULL
    );

    CREATE INDEX IX_fac_aprobacion_cambio_empresa_estado
        ON dbo.fac_aprobacion_cambio_empresa (estado, fecha_solicitud DESC);

    CREATE INDEX IX_fac_aprobacion_cambio_empresa_factura
        ON dbo.fac_aprobacion_cambio_empresa (id_facturacion, estado);
END
