-- Restaura los errores por año y los antecedentes de los termómetros patrón (TPA), que quedaron vacíos tras la
-- limpieza de datos (scripts de limpieza con @ANTECEDENTES_PATRON = 1).
--
-- Origen de los datos:
--   · Años 2023 a 2025: los de la planilla, cargados por migrations/add_errores_termometro_patron.sql (no se editaron).
--   · Año 2026: los valores corregidos en la aplicación el 17-11-2026 (pantalla «Errores de patrón»), recuperados de la
--     auditoría (App_Audit_Log). Ahí aparecen con los id antiguos del equipo: 371 = TPA.01/MA.PM, 373 = TPA.02/MA.VI,
--     375 = TPA.03/MA.AY (mismo orden de carga del inventario; TPA.01 coincide además por su calibración 17-06-2026).
--   · Antecedentes (marca, modelo, serie, calibración): los de migrations/add_antecedentes_termometro_patron.sql.
--
-- Al final copia los errores del año más reciente a cada patrón en mae_equipo (error0, error15, error30), igual que hace
-- la aplicación al guardar un año: son los que usan las fichas nuevas.
--
-- Solo agrega lo que falta: no pisa un año ni un antecedente que ya exista. Se puede ejecutar más de una vez.

-- 1) Errores por año.
INSERT INTO mae_termometro_patron_errores (id_equipo, anio, fecha_calibracion, error0, error15, error30, valido_hasta)
SELECT e.id_equipo, s.anio, s.calibracion, s.e0, s.e15, s.e30, s.valido
FROM (VALUES
        (2023, 'TPA.01/MA.PM', CAST('2023-04-17' AS DATE),  0.1,  0.0,  0.0, CAST('2024-04-16' AS DATE)),
        (2023, 'TPA.02/MA.VI', CAST('2023-08-19' AS DATE),  0.0, -0.1, -0.1, CAST('2024-08-18' AS DATE)),
        (2023, 'TPA.03/MA.AY', CAST('2023-08-19' AS DATE), -0.1, -0.2, -0.2, CAST('2024-08-18' AS DATE)),
        (2024, 'TPA.01/MA.PM', CAST('2024-07-12' AS DATE),  0.0,  0.0, -0.1, CAST('2025-07-12' AS DATE)),
        (2024, 'TPA.02/MA.VI', CAST('2024-11-27' AS DATE),  0.0, -0.1, -0.1, CAST('2025-11-27' AS DATE)),
        (2024, 'TPA.03/MA.AY', CAST('2024-11-27' AS DATE),  0.0, -0.2, -0.2, CAST('2025-11-27' AS DATE)),
        (2025, 'TPA.01/MA.PM', CAST('2025-07-11' AS DATE),  0.1,  0.0, -0.1, CAST('2026-07-11' AS DATE)),
        (2025, 'TPA.02/MA.VI', CAST('2025-10-28' AS DATE),  0.1, -0.1,  0.0, CAST('2026-10-28' AS DATE)),
        (2025, 'TPA.03/MA.AY', CAST('2025-10-28' AS DATE), -0.1, -0.2,  0.1, CAST('2026-10-28' AS DATE)),
        -- 2026: corregidos en la aplicación el 17-11-2026 (auditoría).
        (2026, 'TPA.01/MA.PM', CAST('2026-06-17' AS DATE),  0.2,  0.0,  0.0, CAST('2027-06-17' AS DATE)),
        (2026, 'TPA.02/MA.VI', CAST('2026-09-29' AS DATE),  0.1, -0.1, -0.1, CAST('2027-09-29' AS DATE)),
        (2026, 'TPA.03/MA.AY', CAST('2026-09-29' AS DATE),  0.1, -0.2, -0.3, CAST('2027-09-29' AS DATE))
     ) AS s (anio, codigo, calibracion, e0, e15, e30, valido)
JOIN mae_equipo e ON e.codigo = s.codigo AND e.tipoequipo = 'Termometro patrón'
WHERE NOT EXISTS (SELECT 1 FROM mae_termometro_patron_errores x WHERE x.id_equipo = e.id_equipo AND x.anio = s.anio);
PRINT CONCAT('Años de errores restaurados: ', @@ROWCOUNT);
GO

-- 2) Antecedentes de cada patrón.
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
PRINT CONCAT('Antecedentes restaurados: ', @@ROWCOUNT);
GO

-- 3) Errores vigentes (año más reciente) en el equipo patrón, como al guardar desde la aplicación.
UPDATE e SET e.error0 = u.error0, e.error15 = u.error15, e.error30 = u.error30
FROM mae_equipo e
CROSS APPLY (
    SELECT TOP 1 x.error0, x.error15, x.error30
    FROM mae_termometro_patron_errores x
    WHERE x.id_equipo = e.id_equipo
    ORDER BY x.anio DESC
) u
WHERE e.tipoequipo = 'Termometro patrón';
PRINT CONCAT('Patrones con sus errores vigentes: ', @@ROWCOUNT);
GO

-- Revisión.
SELECT e.codigo, x.anio, x.fecha_calibracion, x.error0, x.error15, x.error30, x.valido_hasta
FROM mae_termometro_patron_errores x JOIN mae_equipo e ON e.id_equipo = x.id_equipo
ORDER BY e.codigo, x.anio;
