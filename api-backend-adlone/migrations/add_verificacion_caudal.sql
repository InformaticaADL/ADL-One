-- Migration: add_verificacion_caudal
-- Formulario OI-FoGe-30 «Verificación Intermedia Sonda Caudal» (verificación semestral, ±10 %): una fila por
-- verificación de una sonda de caudal contra un equipo de referencia (molinete).
--
--   lecturas           JSON con los caudales que marca la sonda (hasta 10, como las casillas del formulario).
--   caudal_promedio, desviacion_pct, indice, grado, cumple: resultado (índice = caudal menor / caudal mayor; se acepta > 0,90).
--   Estados: BORRADOR (se está llenando) · FIRMADA (con V°B°; se aplica al equipo y queda en el archivo) · ANULADA.
--
-- También: el formulario en el catálogo del Archivo de Fichas y el link «Verificación Caudal» en el menú de G. Calidad.
-- Se puede ejecutar más de una vez.

IF OBJECT_ID('mae_verificacion_caudal', 'U') IS NULL
BEGIN
    CREATE TABLE mae_verificacion_caudal (
        id_verificacion      INT IDENTITY(1, 1) PRIMARY KEY,
        id_equipo            NUMERIC(10, 0) NOT NULL,              -- sonda de caudal verificada
        codigo_equipo        VARCHAR(100)   NULL,
        nombre_equipo        NVARCHAR(200)  NULL,
        sede                 VARCHAR(10)    NULL,
        fecha_verificacion   DATE           NOT NULL,
        fecha_proxima        DATE           NULL,                  -- según el control de fechas del equipo (semestral o trimestral)
        id_equipo_referencia NUMERIC(10, 0) NULL,                  -- molinete u otro equipo de referencia
        equipo_referencia    NVARCHAR(200)  NULL,                  -- tipo y código, como se imprime
        caudal_referencia    DECIMAL(12, 4) NULL,
        unidad               VARCHAR(20)    NULL,                  -- L/s, m³/h…
        lecturas             NVARCHAR(500)  NULL,
        caudal_promedio      DECIMAL(12, 4) NULL,
        desviacion_pct       DECIMAL(8, 2)  NULL,
        indice               DECIMAL(6, 3)  NULL,
        grado                VARCHAR(20)    NULL,
        cumple               BIT            NULL,
        observacion          NVARCHAR(1000) NULL,
        estado               VARCHAR(15)    NOT NULL CONSTRAINT DF_mae_verif_caudal_estado DEFAULT 'BORRADOR',
        firma_vobo           NVARCHAR(MAX)  NULL,
        nombre_vobo          NVARCHAR(150)  NULL,
        id_usuario_vobo      NUMERIC(10, 0) NULL,
        fecha_firma          DATETIME       NULL,
        motivo_anulacion     NVARCHAR(300)  NULL,
        id_usuario_crea      NUMERIC(10, 0) NOT NULL,
        nombre_crea          NVARCHAR(150)  NULL,
        fecha_creacion       DATETIME       NOT NULL CONSTRAINT DF_mae_verif_caudal_creacion DEFAULT GETDATE(),
        fecha_modificacion   DATETIME       NULL
    );
    CREATE INDEX IX_mae_verif_caudal_equipo ON mae_verificacion_caudal (id_equipo, fecha_verificacion);
END
GO

-- El PDF firmado se guarda en el Archivo de Fichas, como los demás formularios de equipos.
IF OBJECT_ID('mae_gc_formulario', 'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM mae_gc_formulario WHERE codigo_formulario = 'OI-FoGe-30')
    INSERT INTO mae_gc_formulario (codigo_formulario, nombre, area, modulo, tipo_documento, version, fecha_vigencia, fecha_revision, descripcion)
    VALUES ('OI-FoGe-30', N'Verificación Intermedia Sonda Caudal', N'Gestión de Calidad', 'EQUIPOS', 'VERIFICACION_CAUDAL',
            N'Versión 01', '2016-06-20', '2026-01-12', N'Verificación semestral de sondas de caudal (±10 %) contra equipo de referencia.');
GO

-- Link en el menú lateral de «G. Calidad».
IF NOT EXISTS (SELECT 1 FROM mae_menu_link WHERE id_modulo = 'gestion_calidad' AND id_accion = 'gc-verificacion-caudal')
    INSERT INTO mae_menu_link (id_modulo, id_accion, label, permissions_str, sort_order, activo)
    VALUES ('gestion_calidad', 'gc-verificacion-caudal', N'Verificación Caudal', 'MA_A_GEST_EQUIPO,GC_ACCESO', 26, 1);
GO
