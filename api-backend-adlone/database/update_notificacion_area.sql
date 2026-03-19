/* 
  MODIFICACIÓN: Agregar columna de área a notificaciones para filtrado contextual.
*/

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[mae_notificacion]') AND name = 'area')
BEGIN
    ALTER TABLE [dbo].[mae_notificacion] ADD [area] VARCHAR(50) NULL;
END
