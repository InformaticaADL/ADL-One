-- ====================================================
-- ADL One - Migración de Chat General Fase 8
-- ====================================================

USE [PruebasInformatica]
GO

-- 1. Agregar descripción a conversaciones para grupos
IF COL_LENGTH('mae_chat_conversacion', 'descripcion') IS NULL
BEGIN
    ALTER TABLE mae_chat_conversacion ADD descripcion NVARCHAR(500) NULL;
END
GO
