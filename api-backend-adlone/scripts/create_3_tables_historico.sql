USE [LaboratorioADLHistorico];
GO

-- ============================================================================
-- 1. TABLA FORMATO 1: AÑOS 2006 A 2008
-- ============================================================================
IF OBJECT_ID('dbo.historico_bmo_2006_2008', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.historico_bmo_2006_2008 (
        id_registro INT IDENTITY(1,1) PRIMARY KEY,
        n_caso VARCHAR(100) NULL,
        empresa VARCHAR(255) NULL,
        programa VARCHAR(255) NULL,
        centro VARCHAR(255) NULL,
        lugar_analisis VARCHAR(100) NULL,
        especie VARCHAR(100) NULL,
        estadio VARCHAR(100) NULL,
        lote VARCHAR(100) NULL,
        tipo_agua VARCHAR(100) NULL,
        tipo_muestra VARCHAR(150) NULL,
        tipo_muestreo VARCHAR(150) NULL,
        tejido VARCHAR(150) NULL,
        n_muestras INT NULL,
        pool VARCHAR(50) NULL,
        fecha_muestreo DATE NULL,
        fecha_recepcion DATE NULL,
        tecnica VARCHAR(100) NULL,
        agente VARCHAR(150) NULL,
        resultado VARCHAR(100) NULL,
        positivos INT NULL,
        negativos INT NULL,
        intensidad VARCHAR(100) NULL,
        expr1 VARCHAR(255) NULL,
        fuente_origen VARCHAR(100) NOT NULL,
        fecha_carga DATETIME2 NOT NULL
    );

    CREATE INDEX IX_hist_2006_2008_fechas ON dbo.historico_bmo_2006_2008(fecha_muestreo, fecha_recepcion);
    CREATE INDEX IX_hist_2006_2008_caso ON dbo.historico_bmo_2006_2008(n_caso);
END
GO

-- ============================================================================
-- 2. TABLA FORMATO 2: AÑOS 2009 A 2012
-- ============================================================================
IF OBJECT_ID('dbo.historico_bmo_2009_2012', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.historico_bmo_2009_2012 (
        id_registro INT IDENTITY(1,1) PRIMARY KEY,
        caso_adlab VARCHAR(100) NULL,
        rut_empresa VARCHAR(50) NULL,
        nombre_empresa VARCHAR(255) NULL,
        rut_empresaservicio VARCHAR(50) NULL,
        nombre_empresaservicio VARCHAR(255) NULL,
        nombre_centro VARCHAR(255) NULL,
        programa VARCHAR(255) NULL,
        matriz VARCHAR(150) NULL,
        pool VARCHAR(50) NULL,
        agente VARCHAR(150) NULL,
        ct DECIMAL(8,4) NULL,
        resultado VARCHAR(50) NULL,
        resultado2 VARCHAR(50) NULL,
        ct2 DECIMAL(8,4) NULL,
        positivos INT NULL,
        fecha_muestreo DATE NULL,
        fecha_recepcion DATE NULL,
        fuente_origen VARCHAR(100) NOT NULL,
        fecha_carga DATETIME2 NOT NULL
    );

    CREATE INDEX IX_hist_2009_2012_fechas ON dbo.historico_bmo_2009_2012(fecha_muestreo, fecha_recepcion);
    CREATE INDEX IX_hist_2009_2012_caso ON dbo.historico_bmo_2009_2012(caso_adlab);
END
GO

-- Migración idempotente de nuevas columnas para Formato 2 (2010–2012)
IF COL_LENGTH('dbo.historico_bmo_2009_2012', 'rut_empresa') IS NULL
    ALTER TABLE dbo.historico_bmo_2009_2012 ADD rut_empresa VARCHAR(50) NULL;
IF COL_LENGTH('dbo.historico_bmo_2009_2012', 'nombre_empresa') IS NULL
    ALTER TABLE dbo.historico_bmo_2009_2012 ADD nombre_empresa VARCHAR(255) NULL;
IF COL_LENGTH('dbo.historico_bmo_2009_2012', 'rut_empresaservicio') IS NULL
    ALTER TABLE dbo.historico_bmo_2009_2012 ADD rut_empresaservicio VARCHAR(50) NULL;
IF COL_LENGTH('dbo.historico_bmo_2009_2012', 'nombre_empresaservicio') IS NULL
    ALTER TABLE dbo.historico_bmo_2009_2012 ADD nombre_empresaservicio VARCHAR(255) NULL;
GO

-- ============================================================================
-- 3. TABLA FORMATO 3: AÑOS 2013 A 2016
-- ============================================================================
IF OBJECT_ID('dbo.historico_bmo_2013_2016', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.historico_bmo_2013_2016 (
        id_registro INT IDENTITY(1,1) PRIMARY KEY,
        rut_empresa VARCHAR(50) NULL,
        nombre_empresa VARCHAR(255) NULL,
        rut_empresaservicio VARCHAR(50) NULL,
        nombre_empresaservicio VARCHAR(255) NULL,
        caso_adlab VARCHAR(100) NULL,
        fecha_recepcion DATE NULL,
        lote VARCHAR(150) NULL,
        contenedor VARCHAR(255) NULL,
        nombre_centro VARCHAR(255) NULL,
        codigo_centro VARCHAR(100) NULL,
        nombre_tecnica VARCHAR(150) NULL,
        nombre_organo VARCHAR(150) NULL,
        pool INT NULL,
        resultado VARCHAR(50) NULL,
        pol_npooles INT NULL,
        pol_npeces INT NULL,
        ct DECIMAL(8,4) NULL,
        genovariante VARCHAR(20) NULL,
        estado_caso VARCHAR(50) NULL,
        fuente_origen VARCHAR(100) NOT NULL,
        fecha_carga DATETIME2 NOT NULL
    );

    CREATE INDEX IX_hist_2013_2016_fecha ON dbo.historico_bmo_2013_2016(fecha_recepcion);
    CREATE INDEX IX_hist_2013_2016_caso ON dbo.historico_bmo_2013_2016(caso_adlab);
END
GO

-- Migración idempotente de nuevas columnas para Formato 3 (2013–2016)
IF COL_LENGTH('dbo.historico_bmo_2013_2016', 'rut_empresa') IS NULL
    ALTER TABLE dbo.historico_bmo_2013_2016 ADD rut_empresa VARCHAR(50) NULL;
IF COL_LENGTH('dbo.historico_bmo_2013_2016', 'rut_empresaservicio') IS NULL
    ALTER TABLE dbo.historico_bmo_2013_2016 ADD rut_empresaservicio VARCHAR(50) NULL;
IF COL_LENGTH('dbo.historico_bmo_2013_2016', 'nombre_empresaservicio') IS NULL
    ALTER TABLE dbo.historico_bmo_2013_2016 ADD nombre_empresaservicio VARCHAR(255) NULL;
IF COL_LENGTH('dbo.historico_bmo_2013_2016', 'codigo_centro') IS NULL
    ALTER TABLE dbo.historico_bmo_2013_2016 ADD codigo_centro VARCHAR(100) NULL;
GO

-- ============================================================================
-- 4. PERMISOS PARA EL USUARIO DE APLICACIÓN (adlone_app)
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.historico_bmo_2006_2008 TO [adlone_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.historico_bmo_2009_2012 TO [adlone_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.historico_bmo_2013_2016 TO [adlone_app];
GO
