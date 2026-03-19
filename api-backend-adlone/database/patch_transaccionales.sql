/*
  PATCH: Eventos Transaccionales (Dinámicos)
  Objetivo: Identificar eventos donde los destinatarios se calculan en tiempo real (ej. Solicitudes URS).
*/

BEGIN TRANSACTION;
BEGIN TRY

    -- 1. Añadir columna es_transaccional si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[mae_evento_notificacion]') AND name = 'es_transaccional')
    BEGIN
        ALTER TABLE [dbo].[mae_evento_notificacion] ADD [es_transaccional] BIT DEFAULT 0;
        PRINT 'Columna [es_transaccional] añadida a [mae_evento_notificacion].';
        
        -- Actualizar registros existentes a 0 por defecto
        EXEC('UPDATE [dbo].[mae_evento_notificacion] SET [es_transaccional] = 0 WHERE [es_transaccional] IS NULL;');
    END

    -- 2. Marcar eventos conocidos de URS como transaccionales
    UPDATE [dbo].[mae_evento_notificacion]
    SET [es_transaccional] = 1
    WHERE codigo_evento IN ('SOLICITUD_NUEVA', 'SOLICITUD_ESTADO_CAMBIO', 'SOLICITUD_COMENTARIO_NUEVO');
    
    PRINT 'Eventos de URS actualizados a transaccionales.';

    COMMIT TRANSACTION;
    PRINT 'Parche [Eventos Transaccionales] completado exitosamente.';

END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT 'ERROR EN PARCHE: ' + @ErrorMessage;
END CATCH
GO
