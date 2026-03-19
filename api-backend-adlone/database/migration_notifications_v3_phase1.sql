/*
  MIGRACIÓN: Arquitectura de Notificaciones Universal 3.0 - FASE 1
  Objetivo: Implementar jerarquía de 3 niveles y omnicanalidad sin pérdida de datos.
  Autor: Antigravity (IA)
*/

BEGIN TRANSACTION;
BEGIN TRY

    -- 1. Crear Tablas de Jerarquía si no existen
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[mae_notificacion_modulo]') AND type in (N'U'))
    BEGIN
        CREATE TABLE [dbo].[mae_notificacion_modulo](
            [id_modulo] [numeric](10, 0) IDENTITY(1,1) PRIMARY KEY,
            [nombre] [varchar](100) NOT NULL,
            [icono] [varchar](50) NULL DEFAULT 'notifications'
        );
        PRINT 'Tabla [mae_notificacion_modulo] creada.';
    END

    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[mae_notificacion_funcionalidad]') AND type in (N'U'))
    BEGIN
        CREATE TABLE [dbo].[mae_notificacion_funcionalidad](
            [id_funcionalidad] [numeric](10, 0) IDENTITY(1,1) PRIMARY KEY,
            [id_modulo] [numeric](10, 0) NOT NULL,
            [nombre] [varchar](100) NOT NULL,
            CONSTRAINT [FK_func_modulo] FOREIGN KEY([id_modulo]) REFERENCES [mae_notificacion_modulo]([id_modulo])
        );
        PRINT 'Tabla [mae_notificacion_funcionalidad] creada.';
    END

    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[cfg_notificacion_config]') AND type in (N'U'))
    BEGIN
        CREATE TABLE [dbo].[cfg_notificacion_config](
            [id_config] [numeric](10, 0) IDENTITY(1,1) PRIMARY KEY,
            [id_evento] [numeric](10, 0) NOT NULL,
            [envia_email] [bit] DEFAULT 1,
            [envia_web] [bit] DEFAULT 1,
            [id_rol] [numeric](10, 0) NULL,
            [id_usuario] [numeric](10, 0) NULL,
            [es_propietario] [bit] DEFAULT 0,
            [cc_emails] [varchar](max) NULL,
            CONSTRAINT [FK_config_evento] FOREIGN KEY([id_evento]) REFERENCES [mae_evento_notificacion]([id_evento])
        );
        PRINT 'Tabla [cfg_notificacion_config] creada.';
    END

    -- 2. Migración Segura de Datos
    
    -- Insertar Módulos desde la data actual (evitando duplicados)
    INSERT INTO [mae_notificacion_modulo] (nombre)
    SELECT DISTINCT ISNULL(modulo, 'General')
    FROM [mae_evento_notificacion]
    WHERE ISNULL(modulo, 'General') NOT IN (SELECT nombre FROM [mae_notificacion_modulo]);

    -- Crear Funcionalidad "General" por defecto para cada módulo
    INSERT INTO [mae_notificacion_funcionalidad] (id_modulo, nombre)
    SELECT id_modulo, 'General'
    FROM [mae_notificacion_modulo] m
    WHERE NOT EXISTS (SELECT 1 FROM [mae_notificacion_funcionalidad] f WHERE f.id_modulo = m.id_modulo AND f.nombre = 'General');

    -- Agregar id_funcionalidad a mae_evento_notificacion si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[mae_evento_notificacion]') AND name = 'id_funcionalidad')
    BEGIN
        ALTER TABLE [mae_evento_notificacion] ADD [id_funcionalidad] NUMERIC(10,0) NULL;
        PRINT 'Columna [id_funcionalidad] añadida a [mae_evento_notificacion].';
    END

    -- Vincular eventos a su funcionalidad "General" basada en el módulo
    UPDATE e
    SET e.id_funcionalidad = f.id_funcionalidad
    FROM [mae_evento_notificacion] e
    JOIN [mae_notificacion_modulo] m ON ISNULL(e.modulo, 'General') = m.nombre
    JOIN [mae_notificacion_funcionalidad] f ON m.id_modulo = f.id_modulo
    WHERE f.nombre = 'General' AND e.id_funcionalidad IS NULL;

    -- 3. CEREBRO: Stored Procedure Dispatcher
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

        -- Obtener ID del evento
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

    COMMIT TRANSACTION;
    PRINT 'Migración Fase 1 completada exitosamente.';

END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT 'ERROR EN MIGRACIÓN: ' + @ErrorMessage;
END CATCH
