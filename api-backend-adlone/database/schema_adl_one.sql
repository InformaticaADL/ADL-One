/* =============================================================================
   ADL ONE — Esquema Inicial de Base de Datos (T-SQL)
   -----------------------------------------------------------------------------
   Generado a partir del diseño de Arquitectura ADL ONE.
   Incluye: Dominios de Clientes, Personal, Catálogo, Precios y Fichas (Snapshots)
   ============================================================================= */

-- CREATE DATABASE ADL_ONE;
-- GO
-- USE ADL_ONE;
-- GO

/* =========================================================================
   DOMINIO 1: CLIENTES Y ENTIDADES
   ========================================================================= */

-- Empresa principal (para facturación)
CREATE TABLE dbo.empresa (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    rut             NVARCHAR(20) NOT NULL,
    razon_social    NVARCHAR(255) NOT NULL,
    giro            NVARCHAR(255) NULL,
    direccion       NVARCHAR(300) NULL,
    telefono        NVARCHAR(50) NULL,
    email_contacto  NVARCHAR(255) NULL,
    activo          BIT NOT NULL DEFAULT 1,
    creado_en       DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    CONSTRAINT uq_empresa_rut UNIQUE (rut)
);
GO

-- Empresa Servicio (filial/subsidiaria a la que se le presta el servicio)
CREATE TABLE dbo.empresa_servicio (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    id_empresa      INT NOT NULL REFERENCES dbo.empresa(id),
    rut             NVARCHAR(20) NOT NULL,
    razon_social    NVARCHAR(255) NOT NULL,
    giro            NVARCHAR(255) NULL,
    direccion       NVARCHAR(300) NULL,
    activo          BIT NOT NULL DEFAULT 1,
    creado_en       DATETIME2 NOT NULL DEFAULT GETDATE(),

    CONSTRAINT uq_empresa_servicio_rut UNIQUE (rut)
);
GO

-- Centro / Ubicación física donde ocurre el monitoreo
CREATE TABLE dbo.centro (
    id                   INT IDENTITY(1,1) PRIMARY KEY,
    id_empresa_servicio  INT NOT NULL REFERENCES dbo.empresa_servicio(id),
    nombre               NVARCHAR(200) NOT NULL,
    ubicacion            NVARCHAR(300) NULL,
    geo_lat              DECIMAL(10,5) NULL,
    geo_lng              DECIMAL(10,5) NULL,
    activo               BIT NOT NULL DEFAULT 1,
    creado_en            DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    CONSTRAINT uq_centro_nombre_empresa UNIQUE (id_empresa_servicio, nombre)
);
GO

/* =========================================================================
   DOMINIO 2: PERSONAL DE TERRENO (Muestreadores / Inspectores)
   ========================================================================= */

-- Catálogo de roles
CREATE TABLE dbo.rol_terreno (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    codigo      NVARCHAR(50) NOT NULL,      -- 'MUESTREADOR', 'INSPECTOR'
    nombre      NVARCHAR(100) NOT NULL,
    CONSTRAINT uq_rol_terreno_codigo UNIQUE (codigo)
);
GO
INSERT INTO dbo.rol_terreno (codigo, nombre) VALUES ('MUESTREADOR', 'Muestreador'), ('INSPECTOR', 'Inspector');
GO

-- Personas reales en terreno
CREATE TABLE dbo.persona_terreno (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    rut         NVARCHAR(20) NOT NULL,
    nombres     NVARCHAR(100) NOT NULL,
    apellidos   NVARCHAR(100) NOT NULL,
    email       NVARCHAR(200) NULL,
    activo      BIT NOT NULL DEFAULT 1,
    creado_en   DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    CONSTRAINT uq_persona_terreno_rut UNIQUE (rut)
);
GO

-- Relación N:N (Qué persona puede ejercer qué rol)
CREATE TABLE dbo.persona_rol (
    id_persona  INT NOT NULL REFERENCES dbo.persona_terreno(id),
    id_rol      INT NOT NULL REFERENCES dbo.rol_terreno(id),
    activo      BIT NOT NULL DEFAULT 1,
    
    CONSTRAINT pk_persona_rol PRIMARY KEY (id_persona, id_rol)
);
GO

/* =========================================================================
   DOMINIO 3: CATÁLOGO DE SERVICIOS (Técnicas y Packs)
   ========================================================================= */

-- Cada técnica/parámetro analizado
CREATE TABLE dbo.tecnica (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    codigo      NVARCHAR(50) NOT NULL,      -- Ej: 'PH_01'
    nombre      NVARCHAR(255) NOT NULL,     -- Ej: 'Determinación de pH'
    matriz      NVARCHAR(100) NULL,         -- Ej: 'Agua Residual'
    acreditada  BIT NOT NULL DEFAULT 0,
    activo      BIT NOT NULL DEFAULT 1,
    
    CONSTRAINT uq_tecnica_codigo UNIQUE (codigo)
);
GO

-- Agrupaciones comerciales (Packs)
CREATE TABLE dbo.pack_analisis (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    codigo      NVARCHAR(50) NOT NULL,      -- Ej: 'PACK_DS90_BASICO'
    nombre      NVARCHAR(200) NOT NULL,
    descripcion NVARCHAR(500) NULL,
    activo      BIT NOT NULL DEFAULT 1,
    
    CONSTRAINT uq_pack_codigo UNIQUE (codigo)
);
GO

CREATE TABLE dbo.pack_tecnica (
    id_pack     INT NOT NULL REFERENCES dbo.pack_analisis(id),
    id_tecnica  INT NOT NULL REFERENCES dbo.tecnica(id),
    
    CONSTRAINT pk_pack_tecnica PRIMARY KEY (id_pack, id_tecnica)
);
GO

/* =========================================================================
   DOMINIO 4: PRECIOS Y COMERCIAL
   ========================================================================= */

-- CAPA 1: Lista de Precios Oficial (Catálogo General)
CREATE TABLE dbo.lista_precio (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    nombre          NVARCHAR(100) NOT NULL,
    vigencia_desde  DATE NOT NULL,
    vigencia_hasta  DATE,
    es_activa       BIT NOT NULL DEFAULT 0,
    creado_en       DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    CONSTRAINT uq_lista_precio_activa CHECK (es_activa IN (0, 1))
);
GO

CREATE TABLE dbo.lista_precio_tecnica (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    id_lista_precio     INT NOT NULL REFERENCES dbo.lista_precio(id),
    id_tecnica          INT NOT NULL REFERENCES dbo.tecnica(id),
    precio_uf           DECIMAL(18,5) NOT NULL,
    activo              BIT NOT NULL DEFAULT 1,
    
    CONSTRAINT uq_precio_tecnica UNIQUE (id_lista_precio, id_tecnica)
);
GO

CREATE TABLE dbo.lista_precio_pack (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    id_lista_precio     INT NOT NULL REFERENCES dbo.lista_precio(id),
    id_pack             INT NOT NULL REFERENCES dbo.pack_analisis(id),
    precio_uf           DECIMAL(18,5) NOT NULL,
    activo              BIT NOT NULL DEFAULT 1,
    
    CONSTRAINT uq_precio_pack UNIQUE (id_lista_precio, id_pack)
);
GO

-- CAPA 2: Convenios Negociados
CREATE TABLE dbo.fac_convenio (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    id_empresa_servicio INT NOT NULL REFERENCES dbo.empresa_servicio(id),
    nombre              NVARCHAR(200) NOT NULL,
    id_lista_precio_base INT NULL REFERENCES dbo.lista_precio(id),
    fecha_inicio        DATE NOT NULL,
    fecha_termino       DATE NOT NULL,
    activo              BIT NOT NULL DEFAULT 1,
    creado_en           DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE dbo.convenio_precio (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    id_convenio     INT NOT NULL REFERENCES dbo.fac_convenio(id),
    id_tecnica      INT NULL REFERENCES dbo.tecnica(id),
    id_pack         INT NULL REFERENCES dbo.pack_analisis(id),
    
    tipo_precio     VARCHAR(20) NOT NULL DEFAULT 'precio_fijo',
    precio_uf       DECIMAL(18,5),
    descuento_pct   DECIMAL(10,4),
    
    activo          BIT NOT NULL DEFAULT 1,
    
    CONSTRAINT ck_convenio_precio_xor CHECK (
        (id_tecnica IS NOT NULL AND id_pack IS NULL) OR
        (id_tecnica IS NULL AND id_pack IS NOT NULL)
    ),
    CONSTRAINT uq_convenio_precio UNIQUE (id_convenio, id_tecnica, id_pack)
);
GO

-- CAPA 3: Descuentos y Promociones
CREATE TABLE dbo.descuento (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    nombre          NVARCHAR(150) NOT NULL,
    tipo            VARCHAR(25) NOT NULL,       -- 'porcentaje', 'precio_especial_uf'
    valor           DECIMAL(18,5) NOT NULL,
    
    id_empresa_servicio INT NULL REFERENCES dbo.empresa_servicio(id),
    id_tecnica      INT NULL REFERENCES dbo.tecnica(id),
    id_pack         INT NULL REFERENCES dbo.pack_analisis(id),
    
    aplica_sobre    VARCHAR(20) NOT NULL DEFAULT 'precio_final',
    fecha_inicio    DATE NOT NULL,
    fecha_termino   DATE NOT NULL,
    acumulable      BIT NOT NULL DEFAULT 0,
    habilitado      BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE dbo.descuento_volumen (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    nombre              NVARCHAR(150) NOT NULL,
    id_empresa_servicio INT NULL REFERENCES dbo.empresa_servicio(id),
    nivel_agrupacion    VARCHAR(20) NOT NULL DEFAULT 'ficha',
    vigencia_desde      DATE NOT NULL,
    vigencia_hasta      DATE NULL,
    habilitado          BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE dbo.descuento_volumen_tramo (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    id_descuento_volumen    INT NOT NULL REFERENCES dbo.descuento_volumen(id),
    desde_cantidad          SMALLINT NOT NULL,
    hasta_cantidad          SMALLINT NULL,
    descuento_pct           DECIMAL(10,4) NOT NULL,
    
    CONSTRAINT uq_tramo UNIQUE (id_descuento_volumen, desde_cantidad)
);
GO

/* =========================================================================
   DOMINIO 5: OPERATIVA CORE (FICHAS) Y SNAPSHOTS
   ========================================================================= */

CREATE TABLE dbo.ficha (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    codigo_oi               NVARCHAR(100) NOT NULL,     -- Ej: 'OI-2026-1054'
    
    -- Referencias relacionales vivas
    id_empresa_servicio     INT NOT NULL REFERENCES dbo.empresa_servicio(id),
    id_centro               INT NOT NULL REFERENCES dbo.centro(id),
    id_muestreador          INT NULL REFERENCES dbo.persona_terreno(id),
    id_inspector            INT NULL REFERENCES dbo.persona_terreno(id),
    
    -- SNAPSHOTS: Datos textuales congelados al momento de crear la ficha
    snap_empresa_facturar_rut      NVARCHAR(20) NOT NULL,
    snap_empresa_facturar_razon    NVARCHAR(255) NOT NULL,
    snap_empresa_servicio_rut      NVARCHAR(20) NOT NULL,
    snap_empresa_servicio_razon    NVARCHAR(255) NOT NULL,
    snap_centro_nombre             NVARCHAR(200) NOT NULL,
    snap_muestreador_nombre        NVARCHAR(200) NULL,
    snap_inspector_nombre          NVARCHAR(200) NULL,
    
    -- Metadatos operativos
    estado                  NVARCHAR(50) NOT NULL DEFAULT 'INGRESADA',
    fecha_apertura          DATETIME2 NOT NULL DEFAULT GETDATE(),
    fecha_cierre            DATETIME2 NULL,
    creado_por_id           INT NULL,
    
    CONSTRAINT uq_ficha_codigo UNIQUE (codigo_oi)
);
GO

CREATE TABLE dbo.ficha_analisis (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    id_ficha                INT NOT NULL REFERENCES dbo.ficha(id),
    
    -- Qué se analizó
    id_tecnica              INT NOT NULL REFERENCES dbo.tecnica(id),
    id_pack_origen          INT NULL REFERENCES dbo.pack_analisis(id),
    
    -- SNAPSHOTS DE FACTURACIÓN: El precio congelado para esta técnica
    snap_precio_uf          DECIMAL(18,5) NOT NULL,
    snap_precio_lista_uf    DECIMAL(18,5) NOT NULL, -- Referencia (cuánto habría costado sin descuentos)
    snap_precio_origen      VARCHAR(20) NOT NULL,   -- 'lista', 'convenio', 'pack'
    snap_id_convenio        INT NULL,               -- Si vino de un convenio
    snap_descuento_pct      DECIMAL(10,4) NULL,     -- Si aplicó algún descuento extra
    snap_descuento_origen   NVARCHAR(150) NULL,     -- Nombre del descuento que aplicó
    
    -- Resultados
    resultado_valor         NVARCHAR(100) NULL,
    resultado_fecha         DATETIME2 NULL,
    estado                  NVARCHAR(50) NOT NULL DEFAULT 'PENDIENTE',
    
    -- Para integraciones
    n_informe_lab           NVARCHAR(100) NULL
);
GO
CREATE INDEX ix_ficha_analisis_ficha ON dbo.ficha_analisis (id_ficha);
GO
