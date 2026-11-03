-- Migration: add_patron_antecedentes_verificacion_temperatura
-- Sección "Antecedentes del Termómetro Patrón" del formulario OI-FoGe-39
-- (C23:H28 de cada hoja del Excel): Marca, Modelo, N° Serie, Identificación
-- especial, Intervalo de indicación, Fecha de calibración, Empresa y Máxima
-- división del patrón. mae_equipo no tiene estos datos, así que se guardan en
-- cada ficha (como copia del momento) y la ficha siguiente con el mismo patrón
-- los toma de la última que los tenga.
--
-- Requiere add_verificacion_temperatura.sql. Se puede ejecutar más de una vez.

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
