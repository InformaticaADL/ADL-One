USE [PruebasInformatica]
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Actualizar o Crear el Procedimiento Almacenado
CREATE OR ALTER PROCEDURE [dbo].[MAM_FichaComercial_ConsultaCoordinador]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DISTINCT
        f.id_fichaingresoservicio as id,
        f.fichaingresoservicio as correlativo,
        e.nombre_empresa as cliente,
        c.nombre_centro as centro,
        f.fecha_fichacomercial as fecha,
        f.estado_ficha as estado,
        sa.nombre_subarea as subarea,
        fr.nombre_frecuencia as nombre_frecuencia
    FROM App_Ma_FichaIngresoServicio_ENC f
    -- Usamos INNER JOIN con Agenda porque buscamos items por asignar
    INNER JOIN App_Ma_Agenda_MUESTREOS a ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
    LEFT JOIN mae_empresa e ON f.id_empresa = e.id_empresa
    LEFT JOIN mae_centro c ON f.id_centro = c.id_centro
    LEFT JOIN mae_subarea sa ON f.id_subarea = sa.id_subarea
    LEFT JOIN mae_frecuencia fr ON a.id_frecuencia = fr.id_frecuencia
    WHERE f.id_validaciontecnica = 6 -- Solo Fichas "Pendiente Programación"
      AND a.id_estadomuestreo = 1 -- Solo items "Pendiente" (no asignados)
    ORDER BY f.id_fichaingresoservicio DESC;
END
GO
