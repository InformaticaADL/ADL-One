-- ====================================================
-- MIGRACIÓN: Favoritos para Grupos y Orden de Prioridad
-- Fecha: 2026-03-23
-- ====================================================

USE [PruebasInformatica]
GO

-- 1. Modificar rel_contacto_favorito para soportar tipos de entidad
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rel_contacto_favorito') AND name = 'tipo_contacto')
BEGIN
    ALTER TABLE rel_contacto_favorito ADD tipo_contacto VARCHAR(10) NOT NULL DEFAULT 'USER';
    PRINT '✅ Columna tipo_contacto agregada a rel_contacto_favorito';
END
GO

-- 2. Eliminar constraint FK de id_contacto ya que ahora puede ser usuario o grupo
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_fav_contacto')
BEGIN
    ALTER TABLE rel_contacto_favorito DROP CONSTRAINT FK_fav_contacto;
    PRINT '✅ FK_fav_contacto eliminada';
END
GO

-- 3. Actualizar constraint Unique para incluir el tipo
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UQ_favorito' AND type = 'UQ')
BEGIN
    ALTER TABLE rel_contacto_favorito DROP CONSTRAINT UQ_favorito;
    PRINT '✅ UQ_favorito anterior eliminada';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UQ_favorito' AND type = 'UQ')
BEGIN
    ALTER TABLE rel_contacto_favorito 
    ADD CONSTRAINT UQ_favorito UNIQUE (id_usuario, id_contacto, tipo_contacto);
    PRINT '✅ UQ_favorito actualizada';
END
GO
