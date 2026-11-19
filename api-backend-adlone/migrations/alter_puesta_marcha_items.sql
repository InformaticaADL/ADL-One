-- Migration: alter_puesta_marcha_items
-- Ítems del formulario OI-FoGe-42 en cada puesta en marcha: condición de caja y embalaje, contenido de la caja (manual,
-- cable de alimentación, accesorios), interruptor, comandos y encendido (JSON con la opción elegida de cada uno) y
-- «Otros» del contenido. Sin estas columnas la puesta en marcha se registra igual, sin esos ítems.
-- Se puede ejecutar más de una vez.

IF COL_LENGTH('mae_puesta_marcha', 'items') IS NULL
    ALTER TABLE mae_puesta_marcha ADD items NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('mae_puesta_marcha', 'otros') IS NULL
    ALTER TABLE mae_puesta_marcha ADD otros NVARCHAR(300) NULL;
GO
