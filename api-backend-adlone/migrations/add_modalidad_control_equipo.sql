-- Migration: add_modalidad_control_equipo
-- Cada equipo rige por UNA modalidad de control de fechas; Ultima_verificacion /
-- Siguiente_verificacion guardan las fechas de ESA modalidad:
--   MANTENCION_ANUAL (12 m) · CONTRASTACION_SEMESTRAL (6 m) ·
--   VERIFICACION_TRIMESTRAL (3 m) · CALIBRACION_ANUAL (12 m, patrones) ·
--   SIN_VENCIMIENTO (complementos: baterías, botellas… solo baja manual).
-- Sonda de caudal (semestral o trimestral) y molinete (contrastación o mantención)
-- son a elección y excluyentes. Las reglas por tipo viven en
-- src/utils/reglasControlEquipo.js (misma lista que este backfill).
--
-- Se agrega también al historial para que cada versión conserve la modalidad.
-- Se puede ejecutar más de una vez.

IF COL_LENGTH('mae_equipo', 'modalidad_control') IS NULL
    ALTER TABLE mae_equipo ADD modalidad_control NVARCHAR(30) NULL;
GO

IF COL_LENGTH('mae_equipo_historial', 'modalidad_control') IS NULL
    ALTER TABLE mae_equipo_historial ADD modalidad_control NVARCHAR(30) NULL;
GO

-- Backfill por nombre del equipo (sin tildes ni mayúsculas) en ambas tablas.
-- Solo rellena lo que aún no tiene modalidad.
DECLARE @reglas TABLE (nombre NVARCHAR(100) PRIMARY KEY, modalidad NVARCHAR(30));
INSERT INTO @reglas (nombre, modalidad) VALUES
 (N'MUESTREADOR AUTOMATICO', 'MANTENCION_ANUAL'),
 (N'SONDA CAUDAL', 'CONTRASTACION_SEMESTRAL'),
 (N'MOLINETE', 'CONTRASTACION_SEMESTRAL'),
 (N'MEDIDOR PH PORTATIL', 'VERIFICACION_TRIMESTRAL'),
 (N'MEDIDOR DE PH', 'VERIFICACION_TRIMESTRAL'),
 (N'SONDA PH/TEMPERATURA', 'VERIFICACION_TRIMESTRAL'),
 (N'TERMOCUPLA', 'VERIFICACION_TRIMESTRAL'),
 (N'MEDIDOR DE OXIGENO DISUELTO', 'VERIFICACION_TRIMESTRAL'),
 (N'SONDA OXIGENO DISUELTO', 'VERIFICACION_TRIMESTRAL'),
 (N'MULTIPARAMETRO', 'VERIFICACION_TRIMESTRAL'),
 (N'SONDA MULTIPARAMETRO', 'VERIFICACION_TRIMESTRAL'),
 (N'TERMOMETRO PATRON', 'CALIBRACION_ANUAL'),
 (N'SONDA TERMOMETRO PATRON', 'CALIBRACION_ANUAL'),
 (N'BATERIA', 'SIN_VENCIMIENTO'), (N'CARGADOR DE BATERIAS', 'SIN_VENCIMIENTO'), (N'POWER PACK', 'SIN_VENCIMIENTO'),
 (N'CABLE DE DESCARGA DE DATOS', 'SIN_VENCIMIENTO'), (N'PEDESTAL', 'SIN_VENCIMIENTO'), (N'REFRIGERADOR', 'SIN_VENCIMIENTO'),
 (N'FILTRO', 'SIN_VENCIMIENTO'), (N'BOTELLA OCEANOGRAFICA', 'SIN_VENCIMIENTO'), (N'DRAGA PARA SEDIMENTOS', 'SIN_VENCIMIENTO'),
 (N'DISCO SECCHI', 'SIN_VENCIMIENTO'), (N'MALLA SURBER', 'SIN_VENCIMIENTO'), (N'TAMIZ SEDIMENTO', 'SIN_VENCIMIENTO'),
 (N'TOMADOR MUESTRA DE LODO', 'SIN_VENCIMIENTO'), (N'HUINCHE MECANICO', 'SIN_VENCIMIENTO'), (N'GPS', 'SIN_VENCIMIENTO'),
 (N'TESTER', 'SIN_VENCIMIENTO'), (N'POZOMETRO', 'SIN_VENCIMIENTO'), (N'MEDIDOR DE GASES', 'SIN_VENCIMIENTO'),
 (N'MEDIDOR DE FLUJO ULTRASONICO', 'SIN_VENCIMIENTO'), (N'MEDIDOR DE CLORO', 'SIN_VENCIMIENTO'),
 (N'MEDIDOR DE CLORO RESIDUAL', 'SIN_VENCIMIENTO'), (N'MEDIDOR DE CLORO TOTAL', 'SIN_VENCIMIENTO'),
 (N'MEDIDOR DE CLORO DIGITAL PATRON', 'SIN_VENCIMIENTO');

UPDATE e SET e.modalidad_control = r.modalidad
FROM mae_equipo e
JOIN @reglas r ON r.nombre = LTRIM(RTRIM(e.nombre)) COLLATE Latin1_General_CI_AI
WHERE e.modalidad_control IS NULL;

UPDATE h SET h.modalidad_control = r.modalidad
FROM mae_equipo_historial h
JOIN @reglas r ON r.nombre = LTRIM(RTRIM(h.nombre)) COLLATE Latin1_General_CI_AI
WHERE h.modalidad_control IS NULL;
GO
