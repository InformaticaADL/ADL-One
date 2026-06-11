-- ============================================================
-- Registra el evento FICHA_MUESTREO_COMPLETADO en el catálogo de
-- notificaciones (mae_evento_notificacion), reutilizando el mismo
-- id_funcionalidad que FICHA_ASIGNADA para que aparezca en la misma
-- sección del Hub de Notificaciones.
-- ============================================================

IF NOT EXISTS (
    SELECT * FROM mae_evento_notificacion WHERE codigo_evento = 'FICHA_MUESTREO_COMPLETADO'
)
BEGIN
    INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, id_funcionalidad)
    SELECT 'FICHA_MUESTREO_COMPLETADO', 'Muestreo Completado', 'Muestreo Completado - Ficha #{CORRELATIVO}', id_funcionalidad
    FROM mae_evento_notificacion
    WHERE codigo_evento = 'FICHA_ASIGNADA';
END

-- Verificar resultado
SELECT id_evento, codigo_evento, descripcion, id_funcionalidad
FROM mae_evento_notificacion
WHERE codigo_evento IN ('FICHA_ASIGNADA', 'FICHA_MUESTREO_COMPLETADO');
