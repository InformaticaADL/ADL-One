-- ============================================================
-- Agrega columna de control para notificación "Muestreo Completado"
-- ============================================================

IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('App_Ma_Agenda_MUESTREOS') AND name = 'notificado_completado'
)
BEGIN
    ALTER TABLE App_Ma_Agenda_MUESTREOS
    ADD notificado_completado BIT NOT NULL CONSTRAINT DF_AMAM_notif_completado DEFAULT 0;
END
GO

-- Baseline: marcar como ya notificados todos los muestreos que YA estaban
-- Ejecutados antes de esta migración, para no enviar notificaciones
-- retroactivas masivas.
UPDATE App_Ma_Agenda_MUESTREOS
SET notificado_completado = 1
WHERE id_estadomuestreo = 3 -- 3 = Ejecutado (muestreo completado)
  AND notificado_completado = 0;

-- Verificar resultado
SELECT
    SUM(CASE WHEN id_estadomuestreo = 3 AND notificado_completado = 0 THEN 1 ELSE 0 END) AS pendientes_notificar,
    SUM(CASE WHEN id_estadomuestreo = 3 AND notificado_completado = 1 THEN 1 ELSE 0 END) AS ya_notificados
FROM App_Ma_Agenda_MUESTREOS;
