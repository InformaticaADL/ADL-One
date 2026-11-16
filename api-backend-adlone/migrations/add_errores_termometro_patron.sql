-- Migration: add_errores_termometro_patron
-- Historial anual de los errores de los termómetros patrón (TPA) que usa el
-- formulario OI-FoGe-39 "Verificación Intermedia de Temperatura": por año y por
-- patrón, la última calibración, el error a 0 °C, 15 °C y 30 °C y la fecha hasta
-- la que es válida (la tabla "Errores de patrón" de la planilla Excel).
--
-- El año más reciente de cada patrón es el que usan las fichas nuevas: al
-- guardarlo desde la pantalla "Errores de patrón", la aplicación copia sus
-- errores a mae_equipo (error0, error15, error30 del patrón).
--
-- Se puede ejecutar más de una vez: crea la tabla solo si falta y carga solo
-- los años que no existen (no pisa lo ya editado).

IF OBJECT_ID('mae_termometro_patron_errores', 'U') IS NULL
BEGIN
    CREATE TABLE mae_termometro_patron_errores (
        id_error            INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        id_equipo           NUMERIC(10, 0) NOT NULL,
        anio                INT            NOT NULL,
        fecha_calibracion   DATE           NULL,
        error0              DECIMAL(6, 2)  NULL,
        error15             DECIMAL(6, 2)  NULL,
        error30             DECIMAL(6, 2)  NULL,
        valido_hasta        DATE           NULL,
        id_usuario          NUMERIC(10, 0) NULL,
        fecha_creacion      DATETIME       NOT NULL DEFAULT GETDATE(),
        fecha_modificacion  DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_patron_errores_equipo_anio UNIQUE (id_equipo, anio)
    );
END;
GO

-- Datos de la planilla (años 2023 a 2026).
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
        (2026, 'TPA.01/MA.PM', CAST('2025-07-11' AS DATE),  0.1,  0.0, -0.1, CAST('2026-07-11' AS DATE)),
        (2026, 'TPA.02/MA.VI', CAST('2025-10-28' AS DATE),  0.0, -0.1, -0.1, CAST('2026-10-28' AS DATE)),
        (2026, 'TPA.03/MA.AY', CAST('2025-10-28' AS DATE), -0.1, -0.2, -0.1, CAST('2026-10-28' AS DATE))
     ) AS s (anio, codigo, calibracion, e0, e15, e30, valido)
JOIN mae_equipo e ON e.codigo = s.codigo AND e.tipoequipo = 'Termometro patrón'
WHERE NOT EXISTS (SELECT 1 FROM mae_termometro_patron_errores x WHERE x.id_equipo = e.id_equipo AND x.anio = s.anio);
GO
