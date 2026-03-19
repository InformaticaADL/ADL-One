/*
  PATCH: Ocultar Eventos Plantilla (Mantenimiento de Interfaz Limpia)
  Objetivo: Mantener los eventos plantilla en Base de Datos para uso interno del backend (con sus HTML), 
  pero ocultarlos del Hub de Notificaciones para evitar saturación de la UI, dejando solo a los Maestros.
*/

BEGIN TRANSACTION;
BEGIN TRY

    -- 1. Añadir columna oculto_en_hub si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[mae_evento_notificacion]') AND name = 'oculto_en_hub')
    BEGIN
        ALTER TABLE [dbo].[mae_evento_notificacion] ADD [oculto_en_hub] BIT DEFAULT 0;
        PRINT 'Columna [oculto_en_hub] añadida a [mae_evento_notificacion].';
        
        -- Actualizar registros existentes a 0 por defecto
        EXEC('UPDATE [dbo].[mae_evento_notificacion] SET [oculto_en_hub] = 0 WHERE [oculto_en_hub] IS NULL;');
    END

    -- 2. Marcar plantillas específicas de Solicitudes para ocultarlas del Hub
    -- Se ocultan todas las SOL_ y SOL_EQUIPO_ excepto las 3 maestras globales.
    UPDATE [dbo].[mae_evento_notificacion]
    SET [oculto_en_hub] = 1,
        [es_transaccional] = 1
    WHERE codigo_evento LIKE 'SOL_%' 
      AND codigo_evento NOT IN ('SOLICITUD_NUEVA', 'SOLICITUD_ESTADO_CAMBIO', 'SOLICITUD_COMENTARIO_NUEVO');
    
    PRINT 'Eventos plantilla ocultados correctamente de la interfaz.';

    COMMIT TRANSACTION;
    PRINT 'Parche [Ocultar Plantillas] completado exitosamente.';

END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT 'ERROR EN PARCHE: ' + @ErrorMessage;
END CATCH
GO
