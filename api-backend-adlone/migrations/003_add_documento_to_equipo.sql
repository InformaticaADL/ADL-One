-- Migration: 003_add_documento_to_equipo
-- Documento de la revisión/mantención del equipo (informe, foto o certificado).
--
-- No es una tabla nueva: el equipo ya está versionado. mae_equipo guarda SIEMPRE
-- la versión vigente y mae_equipo_historial las anteriores (updateEquipo archiva
-- el estado actual y recién ahí sobrescribe mae_equipo con la versión nueva).
-- El documento es un atributo más de esa versión, así que viaja con ella:
--   * mae_equipo.documento_*           → el de la última revisión/mantención.
--   * mae_equipo_historial.documento_* → el que tenía esa versión archivada.
--
-- El archivo físico vive en <UPLOAD_PATH>/equipos/; acá solo va la ruta relativa
-- que sirve /uploads, igual que hace Facturación con sus adjuntos.

IF COL_LENGTH('mae_equipo', 'documento_ruta') IS NULL
BEGIN
    ALTER TABLE mae_equipo ADD
        -- Nombre visible del documento. Si el usuario no escribe uno, queda el
        -- nombre original del archivo subido.
        documento_nombre  NVARCHAR(200)  NULL,
        -- Ruta relativa tipo /uploads/equipos/doc-<timestamp>-<rand>.pdf
        documento_ruta    NVARCHAR(500)  NULL,
        documento_fecha   DATETIME       NULL;
END;

IF COL_LENGTH('mae_equipo_historial', 'documento_ruta') IS NULL
BEGIN
    ALTER TABLE mae_equipo_historial ADD
        documento_nombre  NVARCHAR(200)  NULL,
        documento_ruta    NVARCHAR(500)  NULL,
        documento_fecha   DATETIME       NULL;
END;
