-- Migration: add_revision_documental
-- Fechas de revisión documental de los formularios de Gestión de Calidad ("Fecha Revisión" del encabezado de cada
-- ficha). Una fila por año: la fecha en que inicia esa revisión; rige hasta el día anterior a la del año siguiente.
-- El cambio es anual (obligatorio) o cuando se modifica un documento.
-- Se puede ejecutar más de una vez.

IF OBJECT_ID('mae_revision_documental', 'U') IS NULL
BEGIN
    CREATE TABLE mae_revision_documental (
        anio               INT            NOT NULL PRIMARY KEY,
        fecha_inicio       DATE           NOT NULL,
        motivo             NVARCHAR(300)  NULL,
        id_usuario         NUMERIC(10, 0) NULL,
        fecha_modificacion DATETIME       NOT NULL CONSTRAINT DF_mae_revision_documental_mod DEFAULT GETDATE()
    );

    INSERT INTO mae_revision_documental (anio, fecha_inicio, motivo) VALUES
        (2024, '2023-12-26', 'Revisión anual'),
        (2025, '2025-01-06', 'Revisión anual'),
        (2026, '2026-01-12', 'Revisión anual');
END
