-- Migration: add_antecedentes_termometro_patron
-- Antecedentes de cada termómetro patrón (TPA) para el formulario OI-FoGe-39
-- "Verificación Intermedia de Temperatura": marca, modelo, N° serie,
-- identificación, intervalo, fecha de calibración, empresa y máxima división.
-- mae_equipo no tiene estos datos. Con esta tabla, al crear o abrir una ficha
-- la sección "Antecedentes del Termómetro Patrón" se llena sola; cada vez que
-- se guarda una ficha con datos del patrón, la tabla se actualiza (ej. nueva
-- fecha de calibración) y las fichas siguientes la toman.
--
-- Requiere add_verificacion_temperatura.sql. Incluye también las columnas de
-- add_patron_antecedentes_verificacion_temperatura.sql (la ficha guarda una
-- copia de los antecedentes del momento). Se puede ejecutar más de una vez.

-- 1) Columnas de antecedentes en cada ficha (copia del momento).
IF COL_LENGTH('mae_verificacion_temperatura', 'patron_marca') IS NULL
BEGIN
    ALTER TABLE mae_verificacion_temperatura ADD
        patron_marca              NVARCHAR(100) NULL,
        patron_modelo             NVARCHAR(100) NULL,
        patron_serie              NVARCHAR(100) NULL,
        patron_identificacion     NVARCHAR(150) NULL,
        patron_intervalo          NVARCHAR(100) NULL,
        patron_fecha_calibracion  DATE          NULL,
        patron_empresa            NVARCHAR(150) NULL,
        patron_maxima_division    NVARCHAR(50)  NULL;
END;
GO

-- 2) Antecedentes vigentes de cada patrón.
IF OBJECT_ID('mae_termometro_patron_antecedentes', 'U') IS NULL
BEGIN
    CREATE TABLE mae_termometro_patron_antecedentes (
        id_equipo                 NUMERIC(10, 0) NOT NULL PRIMARY KEY,
        patron_marca              NVARCHAR(100) NULL,
        patron_modelo             NVARCHAR(100) NULL,
        patron_serie              NVARCHAR(100) NULL,
        patron_identificacion     NVARCHAR(150) NULL,
        patron_intervalo          NVARCHAR(100) NULL,
        patron_fecha_calibracion  DATE          NULL,
        patron_empresa            NVARCHAR(150) NULL,
        patron_maxima_division    NVARCHAR(50)  NULL,
        fecha_modificacion        DATETIME      NOT NULL DEFAULT GETDATE()
    );
END;
GO

-- 3) Datos iniciales, tomados del inventario OI-FoGe-21 (hoja EQUIPOS MUESTREO):
--    marca, modelo, N° serie y última calibración (CESMEC). Máxima división: 5.
--    El intervalo de indicación no está en el inventario: se completa en la
--    primera ficha y queda guardado para las siguientes.
--    Solo inserta los patrones que aún no tienen fila (no pisa lo ya editado).
INSERT INTO mae_termometro_patron_antecedentes
    (id_equipo, patron_marca, patron_modelo, patron_serie, patron_identificacion, patron_fecha_calibracion, patron_empresa, patron_maxima_division)
SELECT e.id_equipo, s.marca, s.modelo, s.serie, e.codigo, s.calibracion, 'CESMEC', '5'
FROM (VALUES
        ('TPA.01/MA.PM', 'HANNA INSTRUMENTS', 'HI935003', 'TA02360040', CAST('2026-06-17' AS DATE)),
        ('TPA.02/MA.VI', 'HANNA INSTRUMENTS', 'HI935005', '7400002101', CAST('2026-09-29' AS DATE)),
        ('TPA.03/MA.AY', 'HANNA INSTRUMENTS', 'HI935005', '7400048101', CAST('2026-09-29' AS DATE))
     ) AS s (codigo, marca, modelo, serie, calibracion)
JOIN mae_equipo e ON e.codigo = s.codigo AND e.tipoequipo = 'Termometro patrón'
WHERE NOT EXISTS (SELECT 1 FROM mae_termometro_patron_antecedentes a WHERE a.id_equipo = e.id_equipo);
GO

-- 4) Máxima división del termómetro verificado y del patrón: siempre 5 (no se
--    modifica). Solo fichas abiertas; las firmadas o anuladas quedan como se emitieron.
UPDATE mae_verificacion_temperatura SET maxima_division = '5', patron_maxima_division = '5'
WHERE estado IN ('BORRADOR', 'PENDIENTE_FIRMA');
UPDATE mae_termometro_patron_antecedentes SET patron_maxima_division = '5';
GO
