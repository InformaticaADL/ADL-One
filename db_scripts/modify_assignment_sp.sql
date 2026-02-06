-- Actualizar o Crear el Procedimiento Almacenado
CREATE OR ALTER PROCEDURE [dbo].[MAM_FichaComercial_ConsultaCoordinador]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        f.fichaingresoservicio,
        f.id_fichaingresoservicio AS id,
        -- Use MAX/MIN for simplified distinct view per Ficha
        MAX(me.nombre_estadomuestreo) AS nombre_estadomuestreo,
        f.tipo_fichaingresoservicio,
        MAX(es.nombre_empresaservicios) AS empresa_facturar,
        MAX(e.nombre_empresa) AS empresa_servicio,
        MAX(c.nombre_centro) AS centro,
        MAX(om.nombre_objetivomuestreo_ma) AS nombre_objetivomuestreo_ma,
        MAX(sa.nombre_subarea) AS nombre_subarea,
        f.sincronizado,
        
        -- Aggregate frequency (take usage logic: likely first non-null)
        -- Using subquery or just MAX of the text for display simplicity
        MAX(ISNULL(fr.nombre_frecuencia, CAST(a.frecuencia AS VARCHAR))) AS nombre_frecuencia,
        
        MAX(a.id_estadomuestreo) AS id_estadomuestreo,
        
        -- Since we Group By Ficha, this is redundant but kept for structure parity
        f.id_fichaingresoservicio AS id_fichaingresoservicio,
        
        f.estado_ficha

    FROM dbo.App_Ma_FichaIngresoServicio_ENC f
    INNER JOIN dbo.App_Ma_Agenda_MUESTREOS a ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
    -- Filter out ANULADAS in the base join so they don't affect distinct logic or frequency display
    AND (a.estado_caso IS NULL OR a.estado_caso != 'ANULADA')
    INNER JOIN dbo.mae_empresaservicios es ON f.id_empresaservicio = es.id_empresaservicio
    INNER JOIN dbo.mae_empresa e ON f.id_empresa = e.id_empresa
    INNER JOIN dbo.mae_centro c ON f.id_centro = c.id_centro
    INNER JOIN dbo.mae_objetivomuestreo_ma om ON f.id_objetivomuestreo_ma = om.id_objetivomuestreo_ma
    INNER JOIN dbo.mae_subarea sa ON f.id_subarea = sa.id_subarea
    LEFT JOIN dbo.mae_estadomuestreo me ON a.id_estadomuestreo = me.id_estadomuestreo
    LEFT JOIN dbo.mae_frecuencia fr ON a.id_frecuencia = fr.id_frecuencia

    WHERE f.id_validaciontecnica IN (1, 5, 6) -- 1: Aprobada, 5: En Proceso, 6: Pendiente Prog
    
    GROUP BY 
        f.fichaingresoservicio,
        f.id_fichaingresoservicio,
        f.tipo_fichaingresoservicio,
        f.sincronizado,
        f.estado_ficha

    ORDER BY f.id_fichaingresoservicio DESC
END
