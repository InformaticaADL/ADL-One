/* 
  MIGRACIÓN: Sistema Universal de Solicitudes (URS) y Notificaciones (UNS)
  Fecha: 2026-03-13
*/

-- 1. Tipos de Solicitud
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[mae_solicitud_tipo]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[mae_solicitud_tipo] (
        [id_tipo] NUMERIC(10,0) IDENTITY(1,1) PRIMARY KEY,
        [nombre] VARCHAR(100) NOT NULL,
        [area_destino] VARCHAR(50) NOT NULL,
        [cod_permiso_crear] VARCHAR(50) NULL,
        [cod_permiso_resolver] VARCHAR(50) NULL,
        [plantilla_json] NVARCHAR(MAX) NULL,
        [estado] BIT DEFAULT 1
    );
END

-- 2. Solicitudes
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[mae_solicitud]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[mae_solicitud] (
        [id_solicitud] NUMERIC(10,0) IDENTITY(1,1) PRIMARY KEY,
        [id_tipo] NUMERIC(10,0) NOT NULL,
        [id_solicitante] NUMERIC(10,0) NOT NULL,
        [estado] VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE',
        [fecha_creacion] DATETIME DEFAULT GETDATE(),
        [fecha_actualizacion] DATETIME NULL,
        [prioridad] VARCHAR(20) DEFAULT 'NORMAL',
        [datos_json] NVARCHAR(MAX) NULL,
        [area_actual] VARCHAR(50) NULL
    );
END

-- 3. Hilo de Comentarios (Chat)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[mae_solicitud_comentario]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[mae_solicitud_comentario] (
        [id_comentario] NUMERIC(10,0) IDENTITY(1,1) PRIMARY KEY,
        [id_solicitud] NUMERIC(10,0) NOT NULL,
        [id_usuario] NUMERIC(10,0) NOT NULL,
        [mensaje] NVARCHAR(MAX) NOT NULL,
        [es_privado] BIT DEFAULT 0,
        [fecha] DATETIME DEFAULT GETDATE()
    );
END

-- 4. Archivos Adjuntos
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[mae_solicitud_adjunto]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[mae_solicitud_adjunto] (
        [id_adjunto] NUMERIC(10,0) IDENTITY(1,1) PRIMARY KEY,
        [id_solicitud] NUMERIC(10,0) NOT NULL,
        [id_comentario] NUMERIC(10,0) NULL,
        [nombre_archivo] VARCHAR(255) NOT NULL,
        [ruta_archivo] VARCHAR(500) NOT NULL,
        [tipo_archivo] VARCHAR(50) NULL,
        [fecha] DATETIME DEFAULT GETDATE()
    );
END

-- 5. Historial de Derivaciones
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[mae_solicitud_derivacion]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[mae_solicitud_derivacion] (
        [id_derivacion] NUMERIC(10,0) IDENTITY(1,1) PRIMARY KEY,
        [id_solicitud] NUMERIC(10,0) NOT NULL,
        [area_origen] VARCHAR(50) NOT NULL,
        [area_destino] VARCHAR(50) NOT NULL,
        [usuario_origen] NUMERIC(10,0) NOT NULL,
        [usuario_destino] NUMERIC(10,0) NULL,
        [motivo] NVARCHAR(MAX) NULL,
        [fecha] DATETIME DEFAULT GETDATE()
    );
END

-- 6. Reglas de Notificación
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[mae_notificacion_regla]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[mae_notificacion_regla] (
        [id_regla] NUMERIC(10,0) IDENTITY(1,1) PRIMARY KEY,
        [codigo_evento] VARCHAR(50) NOT NULL,
        [id_tipo_solicitud] NUMERIC(10,0) NULL,
        [id_rol_destino] NUMERIC(10,0) NULL,
        [area_destino] VARCHAR(50) NULL,
        [id_usuario_destino] NUMERIC(10,0) NULL,
        [envia_email] BIT DEFAULT 0,
        [envia_web] BIT DEFAULT 1,
        [plantilla_web] NVARCHAR(MAX) NULL,
        [estado] BIT DEFAULT 1
    );
END

-- 7. Notificaciones Web (Bandeja de Entrada)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[mae_notificacion]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[mae_notificacion] (
        [id_notificacion] NUMERIC(10,0) IDENTITY(1,1) PRIMARY KEY,
        [id_usuario] NUMERIC(10,0) NOT NULL,
        [titulo] VARCHAR(200) NOT NULL,
        [mensaje] NVARCHAR(MAX) NOT NULL,
        [tipo] VARCHAR(20) DEFAULT 'INFO',
        [id_referencia] NUMERIC(10,0) NULL,
        [leido] BIT DEFAULT 0,
        [fecha] DATETIME DEFAULT GETDATE()
    );
END
