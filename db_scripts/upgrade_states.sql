USE [PruebasInformatica]
GO

-- 1. Actualizar Nombres para eliminar ambigüedad y reflejar el nuevo flujo
UPDATE mae_validaciontecnica SET nombre_validaciontecnica = 'APROBADA ÁREA TÉCNICA' WHERE id_validaciontecnica = 1;
UPDATE mae_validaciontecnica SET nombre_validaciontecnica = 'RECHAZADA ÁREA TÉCNICA' WHERE id_validaciontecnica = 2;
UPDATE mae_validaciontecnica SET nombre_validaciontecnica = 'PENDIENTE ÁREA TÉCNICA' WHERE id_validaciontecnica = 3;
UPDATE mae_validaciontecnica SET nombre_validaciontecnica = 'RECHAZADA ÁREA COORDINACIÓN' WHERE id_validaciontecnica = 4;
UPDATE mae_validaciontecnica SET nombre_validaciontecnica = 'EN PROCESO' WHERE id_validaciontecnica = 5;

-- 2. Insertar Nuevos Estados (6 y 7)
IF NOT EXISTS (SELECT 1 FROM mae_validaciontecnica WHERE id_validaciontecnica = 6)
BEGIN
    INSERT INTO mae_validaciontecnica (id_validaciontecnica, nombre_validaciontecnica, cargo, habilitado)
    VALUES (6, 'PENDIENTE PROGRAMACIÓN', 'CO', 'S');
END

IF NOT EXISTS (SELECT 1 FROM mae_validaciontecnica WHERE id_validaciontecnica = 7)
BEGIN
    INSERT INTO mae_validaciontecnica (id_validaciontecnica, nombre_validaciontecnica, cargo, habilitado)
    VALUES (7, 'ANULADA', 'CM', 'S');
END

-- 3. MEJORA ESTRUCTURAL (Opcional pero Recomendado): Agregar Orden y Color
-- Verifica si la columna 'orden' existe, si no, la crea
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_validaciontecnica' AND COLUMN_NAME = 'orden')
BEGIN
    ALTER TABLE mae_validaciontecnica ADD orden INT NULL;
    PRINT 'Columna orden agregada.';
END

-- Verifica si la columna 'color' existe, si no, la crea
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_validaciontecnica' AND COLUMN_NAME = 'color')
BEGIN
    ALTER TABLE mae_validaciontecnica ADD color VARCHAR(20) NULL;
    PRINT 'Columna color agregada.';
END

-- Actualizar Valores de Orden (para barras de progreso o filtros)
UPDATE mae_validaciontecnica SET orden = 10, color = 'gray'   WHERE id_validaciontecnica = 3; -- Pendiente Tech
UPDATE mae_validaciontecnica SET orden = 20, color = 'green'  WHERE id_validaciontecnica = 1; -- Aprobada Tech
UPDATE mae_validaciontecnica SET orden = 0,  color = 'red'    WHERE id_validaciontecnica = 2; -- Rechazada Tech
UPDATE mae_validaciontecnica SET orden = 30, color = 'purple' WHERE id_validaciontecnica = 6; -- Pendiente Prog
UPDATE mae_validaciontecnica SET orden = 0,  color = 'red'    WHERE id_validaciontecnica = 4; -- Rechazada Coord
UPDATE mae_validaciontecnica SET orden = 40, color = 'blue'   WHERE id_validaciontecnica = 5; -- En Proceso
UPDATE mae_validaciontecnica SET orden = 99, color = 'black'  WHERE id_validaciontecnica = 7; -- Anulada

-- Verificación Final
SELECT * FROM mae_validaciontecnica ORDER BY orden;
