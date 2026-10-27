-- Varios puntos por muestreo: un GRUPO es una visita (una recepción en el laboratorio) y reúne las fichas de sus puntos.
-- Cada punto sigue siendo una ficha completa (su caso, su FoMa, sus resultados). El vínculo vive en tablas aparte:
-- NO se agrega ninguna columna a App_Ma_FichaIngresoServicio_ENC, porque ADLSOFT (FoxPro) lee esa tabla.
-- Aditiva y reversible: DROP TABLE dbo.App_Ma_GrupoMuestreo_Ficha, dbo.App_Ma_GrupoMuestreo. Idempotente.
IF OBJECT_ID(N'dbo.App_Ma_GrupoMuestreo', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.App_Ma_GrupoMuestreo (
        id_grupo        INT IDENTITY(1,1) PRIMARY KEY,
        id_empresa      NUMERIC(10,0) NULL,
        id_centro       NUMERIC(10,0) NULL,
        creado_por      NUMERIC(10,0) NULL,
        creado_en       DATETIME NOT NULL CONSTRAINT DF_gm_creado DEFAULT GETDATE(),
        nota            NVARCHAR(250) NULL
    );
END

IF OBJECT_ID(N'dbo.App_Ma_GrupoMuestreo_Ficha', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.App_Ma_GrupoMuestreo_Ficha (
        id_grupo                 INT NOT NULL,
        id_fichaingresoservicio  NUMERIC(10,0) NOT NULL,
        orden                    INT NOT NULL CONSTRAINT DF_gmf_orden DEFAULT 0,
        CONSTRAINT PK_gmf PRIMARY KEY (id_grupo, id_fichaingresoservicio),
        CONSTRAINT UQ_gmf_ficha UNIQUE (id_fichaingresoservicio),   -- una ficha pertenece a un solo grupo
        CONSTRAINT FK_gmf_grupo FOREIGN KEY (id_grupo) REFERENCES dbo.App_Ma_GrupoMuestreo(id_grupo)
    );
END
