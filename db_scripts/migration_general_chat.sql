-- ====================================================
-- MIGRACIÓN: Sistema de Chat General - ADL One
-- Fecha: 2026-03-23
-- Descripción: Modifica mae_chat_mensaje y crea tablas
--              de soporte para chat tipo WhatsApp
-- ====================================================

USE [PruebasInformatica]
GO

-- ====================================================
-- PASO 1: MODIFICAR mae_chat_mensaje (tabla existente vacía)
-- ====================================================

-- Agregar columna para vincular a conversaciones (grupos + directos)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('mae_chat_mensaje') AND name = 'id_conversacion')
BEGIN
    ALTER TABLE mae_chat_mensaje ADD id_conversacion NUMERIC(10,0) NULL;
    PRINT '✅ Columna id_conversacion agregada a mae_chat_mensaje';
END
GO

-- Cambiar id_receptor a nullable (en grupos no hay un receptor único)
-- Primero eliminar el constraint FK y default si existen
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_chat_receptor')
BEGIN
    ALTER TABLE mae_chat_mensaje DROP CONSTRAINT FK_chat_receptor;
END
GO

ALTER TABLE mae_chat_mensaje ALTER COLUMN id_receptor NUMERIC(10,0) NULL;
PRINT '✅ id_receptor cambiado a nullable';
GO

-- Re-agregar FK en id_receptor (ahora nullable)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_chat_receptor')
BEGIN
    ALTER TABLE mae_chat_mensaje WITH CHECK ADD CONSTRAINT FK_chat_receptor 
        FOREIGN KEY (id_receptor) REFERENCES mae_usuario(id_usuario);
    PRINT '✅ FK_chat_receptor re-creada';
END
GO

-- Agregar tipo de mensaje
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('mae_chat_mensaje') AND name = 'tipo_mensaje')
BEGIN
    ALTER TABLE mae_chat_mensaje ADD tipo_mensaje VARCHAR(20) NOT NULL DEFAULT 'TEXTO';
    PRINT '✅ Columna tipo_mensaje agregada';
END
GO

-- Agregar flags de edición y eliminación
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('mae_chat_mensaje') AND name = 'editado')
BEGIN
    ALTER TABLE mae_chat_mensaje ADD editado BIT NOT NULL DEFAULT 0;
    PRINT '✅ Columna editado agregada';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('mae_chat_mensaje') AND name = 'eliminado')
BEGIN
    ALTER TABLE mae_chat_mensaje ADD eliminado BIT NOT NULL DEFAULT 0;
    PRINT '✅ Columna eliminado agregada';
END
GO

-- Cambiar mensaje a nullable (mensajes solo con archivo)
ALTER TABLE mae_chat_mensaje ALTER COLUMN mensaje NVARCHAR(MAX) NULL;
PRINT '✅ mensaje cambiado a nullable';
GO

-- ====================================================
-- PASO 2: TABLAS NUEVAS
-- ====================================================

-- 1. Conversaciones (1-a-1 y grupos)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'mae_chat_conversacion')
BEGIN
    CREATE TABLE mae_chat_conversacion (
        id_conversacion       NUMERIC(10,0) IDENTITY(1,1) PRIMARY KEY,
        tipo                  VARCHAR(10) NOT NULL DEFAULT 'DIRECTA', -- 'DIRECTA' | 'GRUPO'
        nombre_grupo          NVARCHAR(100) NULL,
        foto_grupo            VARCHAR(500) NULL,
        creado_por            NUMERIC(10,0) NOT NULL,
        fecha_creacion        DATETIME NOT NULL DEFAULT GETDATE(),
        ultimo_mensaje_id     NUMERIC(18,0) NULL,
        ultimo_mensaje_fecha  DATETIME NULL,
        activo                BIT NOT NULL DEFAULT 1,
        CONSTRAINT FK_conv_creador FOREIGN KEY (creado_por) REFERENCES mae_usuario(id_usuario)
    );
    PRINT '✅ Tabla mae_chat_conversacion creada';
END
GO

-- FK de mae_chat_mensaje -> mae_chat_conversacion
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_chat_conversacion')
BEGIN
    ALTER TABLE mae_chat_mensaje ADD CONSTRAINT FK_chat_conversacion 
        FOREIGN KEY (id_conversacion) REFERENCES mae_chat_conversacion(id_conversacion);
    PRINT '✅ FK_chat_conversacion creada';
END
GO

-- 2. Participantes de conversación
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rel_chat_participante')
BEGIN
    CREATE TABLE rel_chat_participante (
        id_participante       NUMERIC(10,0) IDENTITY(1,1) PRIMARY KEY,
        id_conversacion       NUMERIC(10,0) NOT NULL,
        id_usuario            NUMERIC(10,0) NOT NULL,
        rol                   VARCHAR(20) NOT NULL DEFAULT 'MIEMBRO', -- 'ADMIN' | 'MIEMBRO'
        fecha_union           DATETIME NOT NULL DEFAULT GETDATE(),
        fecha_salida          DATETIME NULL,
        activo                BIT NOT NULL DEFAULT 1,
        mensajes_ocultos_hasta DATETIME NULL, -- Para "limpiar mensajes"
        CONSTRAINT FK_part_conversacion FOREIGN KEY (id_conversacion) REFERENCES mae_chat_conversacion(id_conversacion),
        CONSTRAINT FK_part_usuario FOREIGN KEY (id_usuario) REFERENCES mae_usuario(id_usuario),
        CONSTRAINT UQ_participante UNIQUE (id_conversacion, id_usuario)
    );
    PRINT '✅ Tabla rel_chat_participante creada';
END
GO

-- 3. Lecturas por mensaje (para "doble check" en grupos)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rel_chat_lectura')
BEGIN
    CREATE TABLE rel_chat_lectura (
        id_lectura            NUMERIC(10,0) IDENTITY(1,1) PRIMARY KEY,
        id_mensaje            NUMERIC(18,0) NOT NULL,
        id_usuario            NUMERIC(10,0) NOT NULL,
        fecha_lectura         DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_lectura_mensaje FOREIGN KEY (id_mensaje) REFERENCES mae_chat_mensaje(id_mensaje),
        CONSTRAINT FK_lectura_usuario FOREIGN KEY (id_usuario) REFERENCES mae_usuario(id_usuario),
        CONSTRAINT UQ_lectura UNIQUE (id_mensaje, id_usuario)
    );
    PRINT '✅ Tabla rel_chat_lectura creada';
END
GO

-- 4. Contactos favoritos
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rel_contacto_favorito')
BEGIN
    CREATE TABLE rel_contacto_favorito (
        id_favorito           NUMERIC(10,0) IDENTITY(1,1) PRIMARY KEY,
        id_usuario            NUMERIC(10,0) NOT NULL,
        id_contacto           NUMERIC(10,0) NOT NULL,
        fecha_agregado        DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_fav_usuario FOREIGN KEY (id_usuario) REFERENCES mae_usuario(id_usuario),
        CONSTRAINT FK_fav_contacto FOREIGN KEY (id_contacto) REFERENCES mae_usuario(id_usuario),
        CONSTRAINT UQ_favorito UNIQUE (id_usuario, id_contacto)
    );
    PRINT '✅ Tabla rel_contacto_favorito creada';
END
GO

-- ====================================================
-- PASO 3: ÍNDICES PARA RENDIMIENTO
-- ====================================================

-- Índice en mensajes por conversación y fecha
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_chat_mensaje_conversacion')
BEGIN
    CREATE NONCLUSTERED INDEX IX_chat_mensaje_conversacion 
        ON mae_chat_mensaje(id_conversacion, fecha DESC);
    PRINT '✅ Índice IX_chat_mensaje_conversacion creado';
END
GO

-- Índice en participantes por usuario
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_chat_participante_usuario')
BEGIN
    CREATE NONCLUSTERED INDEX IX_chat_participante_usuario 
        ON rel_chat_participante(id_usuario, activo);
    PRINT '✅ Índice IX_chat_participante_usuario creado';
END
GO

-- ====================================================
-- PASO 4: EVENTOS DE NOTIFICACIÓN PARA CHAT
-- ====================================================

-- Módulo de notificación
IF NOT EXISTS (SELECT 1 FROM mae_notificacion_modulo WHERE nombre = 'Chat')
BEGIN
    INSERT INTO mae_notificacion_modulo (nombre, icono) VALUES ('Chat', 'IconMessageCircle');
    PRINT '✅ Módulo de notificación Chat creado';
END
GO

-- Funcionalidad
IF NOT EXISTS (SELECT 1 FROM mae_notificacion_funcionalidad WHERE nombre = 'Mensajería General')
BEGIN
    INSERT INTO mae_notificacion_funcionalidad (id_modulo, nombre) 
    VALUES (
        (SELECT id_modulo FROM mae_notificacion_modulo WHERE nombre = 'Chat'), 
        'Mensajería General'
    );
    PRINT '✅ Funcionalidad Mensajería General creada';
END
GO

-- Eventos de notificación
DECLARE @id_func NUMERIC(10,0) = (SELECT id_funcionalidad FROM mae_notificacion_funcionalidad WHERE nombre = 'Mensajería General');

IF NOT EXISTS (SELECT 1 FROM mae_evento_notificacion WHERE codigo_evento = 'GCHAT_NUEVO_MENSAJE')
BEGIN
    INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, modulo, es_transaccional, id_funcionalidad)
    VALUES ('GCHAT_NUEVO_MENSAJE', 'Nuevo mensaje de chat', 'Nuevo mensaje de {EMISOR}', 'Chat', 1, @id_func);
    PRINT '✅ Evento GCHAT_NUEVO_MENSAJE creado';
END

IF NOT EXISTS (SELECT 1 FROM mae_evento_notificacion WHERE codigo_evento = 'GCHAT_GRUPO_CREADO')
BEGIN
    INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, modulo, es_transaccional, id_funcionalidad)
    VALUES ('GCHAT_GRUPO_CREADO', 'Agregado a un grupo de chat', 'Has sido agregado al grupo {NOMBRE_GRUPO}', 'Chat', 1, @id_func);
    PRINT '✅ Evento GCHAT_GRUPO_CREADO creado';
END

IF NOT EXISTS (SELECT 1 FROM mae_evento_notificacion WHERE codigo_evento = 'GCHAT_GRUPO_EXPULSADO')
BEGIN
    INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, modulo, es_transaccional, id_funcionalidad)
    VALUES ('GCHAT_GRUPO_EXPULSADO', 'Expulsado de un grupo', 'Has sido removido del grupo {NOMBRE_GRUPO}', 'Chat', 1, @id_func);
    PRINT '✅ Evento GCHAT_GRUPO_EXPULSADO creado';
END

IF NOT EXISTS (SELECT 1 FROM mae_evento_notificacion WHERE codigo_evento = 'GCHAT_GRUPO_MIEMBRO_NUEVO')
BEGIN
    INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, modulo, es_transaccional, id_funcionalidad)
    VALUES ('GCHAT_GRUPO_MIEMBRO_NUEVO', 'Nuevo miembro en grupo', 'Se ha agregado un nuevo miembro al grupo {NOMBRE_GRUPO}', 'Chat', 1, @id_func);
    PRINT '✅ Evento GCHAT_GRUPO_MIEMBRO_NUEVO creado';
END
GO

PRINT '';
PRINT '====================================================';
PRINT '✅ MIGRACIÓN COMPLETADA EXITOSAMENTE';
PRINT '====================================================';
GO
