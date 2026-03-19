/*
  PATCH: Corrección de nombres de tablas y lógica de usuarios (Fase 1)
  Ejecuta este script para corregir el Stored Procedure y las relaciones.
*/

-- 1. Corregir Foreign Key en cfg_notificacion_config si existe con el nombre incorrecto
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_config_evento')
BEGIN
    ALTER TABLE [dbo].[cfg_notificacion_config] DROP CONSTRAINT [FK_config_evento];
END

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_config_evento')
BEGIN
    ALTER TABLE [dbo].[cfg_notificacion_config] 
    ADD CONSTRAINT [FK_config_evento] FOREIGN KEY([id_evento]) REFERENCES [mae_evento_notificacion]([id_evento]);
    PRINT 'Relación FK_config_evento corregida.';
END
GO

-- 2. Corregir Stored Procedure manteniendo la lógica original del negocio
IF OBJECT_ID('[dbo].[sp_DespacharNotificacion]') IS NOT NULL
    DROP PROCEDURE [dbo].[sp_DespacharNotificacion];
GO

CREATE PROCEDURE [dbo].[sp_DespacharNotificacion]
    @codigo_evento VARCHAR(50),
    @id_usuario_accion NUMERIC(10,0),
    @id_usuario_propietario NUMERIC(10,0) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Obtener ID del evento (NOMBRE CORRECTO: mae_evento_notificacion)
    DECLARE @id_evento NUMERIC(10,0);
    SELECT @id_evento = id_evento FROM mae_evento_notificacion WHERE codigo_evento = @codigo_evento;

    IF @id_evento IS NULL RETURN;

    -- Tabla temporal para recolectar destinatarios únicos
    DECLARE @Destinatarios TABLE (
        id_usuario NUMERIC(10,0),
        envia_email BIT,
        envia_web BIT,
        cc_emails VARCHAR(MAX)
    );

    -- 1. Resolver por Roles (Pasando por rel_usuario_rol)
    INSERT INTO @Destinatarios (id_usuario, envia_email, envia_web, cc_emails)
    SELECT ur.id_usuario, c.envia_email, c.envia_web, c.cc_emails
    FROM cfg_notificacion_config c
    JOIN rel_usuario_rol ur ON c.id_rol = ur.id_rol
    JOIN mae_usuario u ON u.id_usuario = ur.id_usuario
    WHERE c.id_evento = @id_evento 
      AND (u.habilitado = '1' OR u.habilitado = 'S' OR u.habilitado IS NULL)
      AND u.id_usuario <> @id_usuario_accion;

    -- 2. Resolver por Usuarios Específicos
    INSERT INTO @Destinatarios (id_usuario, envia_email, envia_web, cc_emails)
    SELECT c.id_usuario, c.envia_email, c.envia_web, c.cc_emails
    FROM cfg_notificacion_config c
    JOIN mae_usuario u ON u.id_usuario = c.id_usuario
    WHERE c.id_evento = @id_evento 
      AND c.id_usuario IS NOT NULL 
      AND (u.habilitado = '1' OR u.habilitado = 'S' OR u.habilitado IS NULL)
      AND c.id_usuario <> @id_usuario_accion;

    -- 3. Resolver Propietario
    IF @id_usuario_propietario IS NOT NULL AND @id_usuario_propietario <> @id_usuario_accion
    BEGIN
        INSERT INTO @Destinatarios (id_usuario, envia_email, envia_web, cc_emails)
        SELECT @id_usuario_propietario, c.envia_email, c.envia_web, c.cc_emails
        FROM cfg_notificacion_config c
        WHERE c.id_evento = @id_evento AND c.es_propietario = 1;
    END

    -- Retornar resultado final consolidado
    SELECT 
        d.id_usuario,
        MAX(CAST(d.envia_email AS INT)) as email,
        MAX(CAST(d.envia_web AS INT)) as web,
        STUFF((SELECT DISTINCT ',' + cc_emails 
               FROM @Destinatarios 
               WHERE cc_emails IS NOT NULL FOR XML PATH('')), 1, 1, '') as global_cc
    FROM @Destinatarios d
    GROUP BY d.id_usuario;
END
GO

PRINT 'Stored Procedure [sp_DespacharNotificacion] corregido exitosamente.';
