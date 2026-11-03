-- Migration: add_competencia_to_muestreador_documento
-- Cada competencia de un muestreador puede tener muchos respaldos (cursos,
-- certificados, evaluaciones), así que el documento se asocia a la competencia
-- en vez de quedar en una lista general. Es NULL a propósito: los documentos
-- que sube Jefe Técnico desde el formulario completo siguen siendo generales.

IF COL_LENGTH('mae_muestreador_documento', 'id_competencia') IS NULL
BEGIN
    ALTER TABLE mae_muestreador_documento ADD id_competencia INT NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mae_muestreador_documento_competencia')
BEGIN
    CREATE INDEX IX_mae_muestreador_documento_competencia
        ON mae_muestreador_documento (id_muestreador, id_competencia);
END;
GO
