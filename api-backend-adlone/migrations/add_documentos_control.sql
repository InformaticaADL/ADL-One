-- Migration: add_documentos_control
-- Encabezado de cada documento de Gestión de Calidad: Versión, Fecha Vigencia y Fecha Revisión propia. Lo administra la
-- sección Revisión documental y lo usan los PDF que genera la aplicación.
--
-- La Fecha Revisión del encabezado es la más reciente entre la revisión anual (mae_revision_documental) y la revisión
-- propia del documento (cuando se modificó a mitad de año). Si fecha_revision queda vacía, rige solo la anual.
-- Se puede ejecutar más de una vez.

IF OBJECT_ID('mae_documento_control', 'U') IS NULL
BEGIN
    CREATE TABLE mae_documento_control (
        codigo             VARCHAR(20)    NOT NULL PRIMARY KEY,     -- OI-FoGe-22, OI-FoGe-24…
        nombre             NVARCHAR(200)  NOT NULL,
        version            VARCHAR(20)    NOT NULL,                 -- "Versión 01"
        fecha_vigencia     DATE           NOT NULL,
        fecha_revision     DATE           NULL,                     -- revisión propia (modificación del documento)
        motivo             NVARCHAR(300)  NULL,
        id_usuario         NUMERIC(10, 0) NULL,
        fecha_modificacion DATETIME       NOT NULL CONSTRAINT DF_mae_documento_control_mod DEFAULT GETDATE()
    );

    INSERT INTO mae_documento_control (codigo, nombre, version, fecha_vigencia, fecha_revision) VALUES
        ('OI-FoGe-22', N'Ficha Técnica de Equipos', N'Versión 01', '2016-06-20', NULL),
        ('OI-FoGe-23', N'Por confirmar (formulario de equipos)', N'Versión 01', '2016-06-20', NULL),
        ('OI-FoGe-24', N'Historial de equipo', N'Versión 01', '2016-06-20', NULL),
        ('OI-FoGe-30', N'Verificación Intermedia Sonda Caudal', N'Versión 01', '2016-06-20', NULL),
        ('OI-FoGe-36', N'Ficha Entrega de Equipo', N'Versión 01', '2013-03-10', NULL),
        ('OI-FoGe-39', N'Verificación Intermedia de Temperatura', N'Versión 03', '2016-06-20', NULL),
        ('OI-FoGe-42', N'Recepción, Puesta en Marcha y Verificación de Equipo', N'Versión 01', '2020-12-28', NULL);
END
GO

-- Documentos asociados a equipos que Gestión de Calidad pidió administrar (OI-FoGe-22-23-24-30-36-39-42).
IF NOT EXISTS (SELECT 1 FROM mae_documento_control WHERE codigo = 'OI-FoGe-23')
    INSERT INTO mae_documento_control (codigo, nombre, version, fecha_vigencia) VALUES ('OI-FoGe-23', N'Por confirmar (formulario de equipos)', N'Versión 01', '2016-06-20');
IF NOT EXISTS (SELECT 1 FROM mae_documento_control WHERE codigo = 'OI-FoGe-30')
    INSERT INTO mae_documento_control (codigo, nombre, version, fecha_vigencia) VALUES ('OI-FoGe-30', N'Verificación Intermedia Sonda Caudal', N'Versión 01', '2016-06-20');
