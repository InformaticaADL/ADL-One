-- Migration: alter_puesta_marcha_adjunto_obs
-- Observación de cada documento que se adjunta a una puesta en marcha (por ejemplo, un informe de diagnóstico,
-- reparación o mantención que llega después). Si la puesta en marcha ya está aprobada, esa observación complementa su
-- línea en el historial del equipo. Sin esta columna los documentos se adjuntan igual, sin observación guardada.
-- Se puede ejecutar más de una vez.

IF COL_LENGTH('mae_puesta_marcha_adjunto', 'observacion') IS NULL
    ALTER TABLE mae_puesta_marcha_adjunto ADD observacion NVARCHAR(500) NULL;
GO
