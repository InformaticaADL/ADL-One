-- Acompañante de una visita: un muestreador que va a la visita junto al responsable, solo la acompaña (no reparte puntos, no firma, no ejecuta).
-- Es opcional: sin fila no hay acompañante. Una visita = un grupo (App_Ma_GrupoMuestreo) y un número de servicio (el 2.º segmento de frecuencia_correlativo).
-- Tabla aparte: NO se agrega ninguna columna a las tablas App_Ma_* que lee ADLSOFT.
-- Aditiva y reversible: DROP TABLE dbo.App_Ma_Visita_Acompanante. Idempotente.
IF OBJECT_ID(N'dbo.App_Ma_Visita_Acompanante', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.App_Ma_Visita_Acompanante (
        id_grupo         INT NOT NULL,
        servicio         INT NOT NULL,
        id_muestreador   NUMERIC(10,0) NOT NULL,
        creado_por       NUMERIC(10,0) NULL,
        creado_en        DATETIME NOT NULL CONSTRAINT DF_vac_creado DEFAULT GETDATE(),
        CONSTRAINT PK_vac PRIMARY KEY (id_grupo, servicio, id_muestreador),
        CONSTRAINT FK_vac_grupo FOREIGN KEY (id_grupo) REFERENCES dbo.App_Ma_GrupoMuestreo(id_grupo)
    );
END
