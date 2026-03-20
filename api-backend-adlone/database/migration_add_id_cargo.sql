/* 
  MIGRACIÓN: Agregar id_cargo a mae_usuario
  Fecha: 2026-03-20
*/

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'mae_usuario' AND COLUMN_NAME = 'id_cargo'
)
BEGIN
    ALTER TABLE [dbo].[mae_usuario] 
    ADD [id_cargo] [numeric](10, 0) NULL;

    PRINT 'Columna id_cargo agregada a mae_usuario';
END
GO

-- 1. Asegurar cargos existen en mae_cargo
IF NOT EXISTS (SELECT * FROM mae_cargo WHERE nombre_cargo = 'Coordinador')
BEGIN
    INSERT INTO mae_cargo (id_cargo, nombre_cargo) VALUES ((SELECT ISNULL(MAX(id_cargo), 0) + 1 FROM mae_cargo), 'Coordinador');
END

IF NOT EXISTS (SELECT * FROM mae_cargo WHERE nombre_cargo = 'Gerente Comercial')
BEGIN
    INSERT INTO mae_cargo (id_cargo, nombre_cargo) VALUES ((SELECT ISNULL(MAX(id_cargo), 0) + 1 FROM mae_cargo), 'Gerente Comercial');
END

IF NOT EXISTS (SELECT * FROM mae_cargo WHERE nombre_cargo = 'Jefe Tecnico')
BEGIN
    INSERT INTO mae_cargo (id_cargo, nombre_cargo) VALUES ((SELECT ISNULL(MAX(id_cargo), 0) + 1 FROM mae_cargo), 'Jefe Tecnico');
END

IF NOT EXISTS (SELECT * FROM mae_cargo WHERE nombre_cargo = 'Asistente de Informatica')
BEGIN
    INSERT INTO mae_cargo (id_cargo, nombre_cargo, lab, mam, obsterreno, cliente) 
    VALUES ((SELECT ISNULL(MAX(id_cargo), 0) + 1 FROM mae_cargo), 'Asistente de Informatica', 's', 'n', 'n', 'n');
END
GO

-- 2. Asignar cargos a usuarios específicos
UPDATE mae_usuario 
SET id_cargo = (SELECT TOP 1 id_cargo FROM mae_cargo WHERE nombre_cargo = 'Coordinador')
WHERE nombre_usuario = 'GTENEB';

UPDATE mae_usuario 
SET id_cargo = (SELECT TOP 1 id_cargo FROM mae_cargo WHERE nombre_cargo = 'Gerente Comercial')
WHERE nombre_usuario = 'MFERNANDEZ';

UPDATE mae_usuario 
SET id_cargo = (SELECT TOP 1 id_cargo FROM mae_cargo WHERE nombre_cargo = 'Jefe Tecnico')
WHERE nombre_usuario = 'PFLORES';
GO
