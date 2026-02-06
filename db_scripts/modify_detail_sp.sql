-- Fix Detail SP to use LEFT JOINs and Filter ANULADA
CREATE OR ALTER PROCEDURE [dbo].[MAM_FichaComercial_ConsultaCoordinadorDetalle]
@xid_fichaingresoservicio Numeric(10),
@xid_estadomuestreo Numeric(10)
AS
BEGIN
	SET NOCOUNT ON;

SELECT TOP (100) PERCENT 
    dbo.App_Ma_FichaIngresoServicio_ENC.fichaingresoservicio, 
    dbo.App_Ma_Agenda_MUESTREOS.frecuencia_correlativo, 
    dbo.mae_estadomuestreo.nombre_estadomuestreo, 
    CONVERT(Varchar(10), dbo.App_Ma_Agenda_MUESTREOS.fecha_muestreo, 103) AS fecha_muestreo, 
    dbo.App_Ma_FichaIngresoServicio_ENC.tipo_fichaingresoservicio, 
    dbo.mae_empresa.nombre_empresa AS empresa_servicio, 
    dbo.mae_centro.nombre_centro AS centro, 
    dbo.mae_objetivomuestreo_ma.nombre_objetivomuestreo_ma, 
    dbo.mae_subarea.nombre_subarea, 
    dbo.mae_coordinador.nombre_coordinador, 
    dbo.mae_muestreador.nombre_muestreador, 
    dbo.App_Ma_Agenda_MUESTREOS.sincronizado, 
    dbo.App_Ma_Agenda_MUESTREOS.marca, 
    dbo.App_Ma_Agenda_MUESTREOS.dia, 
    dbo.App_Ma_Agenda_MUESTREOS.mes, 
    dbo.App_Ma_Agenda_MUESTREOS.ano, 
    dbo.App_Ma_Agenda_MUESTREOS.id_fichaingresoservicio, 
    dbo.App_Ma_Agenda_MUESTREOS.id_coordinador, 
    dbo.App_Ma_Agenda_MUESTREOS.id_muestreador,
    dbo.App_Ma_Agenda_MUESTREOS.id_muestreador2,
    m2.nombre_muestreador AS nombre_muestreador2,
    dbo.App_Ma_Agenda_MUESTREOS.frecuencia, 
    dbo.App_Ma_Agenda_MUESTREOS.id_frecuencia, 
    dbo.App_Ma_Agenda_MUESTREOS.id_estadomuestreo, 
    dbo.App_Ma_Agenda_MUESTREOS.id_agendamam, 
    dbo.mae_frecuencia.nombre_frecuencia, 
    dbo.mae_frecuencia.dias
FROM dbo.App_Ma_Agenda_MUESTREOS 
INNER JOIN dbo.App_Ma_FichaIngresoServicio_ENC 
    ON dbo.App_Ma_Agenda_MUESTREOS.id_fichaingresoservicio = dbo.App_Ma_FichaIngresoServicio_ENC.id_fichaingresoservicio 
INNER JOIN dbo.mae_empresa 
    ON dbo.App_Ma_FichaIngresoServicio_ENC.id_empresa = dbo.mae_empresa.id_empresa 
INNER JOIN dbo.mae_centro 
    ON dbo.App_Ma_FichaIngresoServicio_ENC.id_centro = dbo.mae_centro.id_centro 
INNER JOIN dbo.mae_objetivomuestreo_ma 
    ON dbo.App_Ma_FichaIngresoServicio_ENC.id_objetivomuestreo_ma = dbo.mae_objetivomuestreo_ma.id_objetivomuestreo_ma 
INNER JOIN dbo.mae_subarea 
    ON dbo.App_Ma_FichaIngresoServicio_ENC.id_subarea = dbo.mae_subarea.id_subarea 
LEFT JOIN dbo.mae_coordinador 
    ON dbo.App_Ma_Agenda_MUESTREOS.id_coordinador = dbo.mae_coordinador.id_coordinador 
LEFT JOIN dbo.mae_muestreador 
    ON dbo.App_Ma_Agenda_MUESTREOS.id_muestreador = dbo.mae_muestreador.id_muestreador 
LEFT JOIN dbo.mae_muestreador m2
    ON dbo.App_Ma_Agenda_MUESTREOS.id_muestreador2 = m2.id_muestreador
LEFT JOIN dbo.mae_estadomuestreo 
    ON dbo.App_Ma_Agenda_MUESTREOS.id_estadomuestreo = dbo.mae_estadomuestreo.id_estadomuestreo 
LEFT JOIN dbo.mae_frecuencia 
    ON dbo.App_Ma_Agenda_MUESTREOS.id_frecuencia = dbo.mae_frecuencia.id_frecuencia
WHERE (dbo.App_Ma_Agenda_MUESTREOS.id_fichaingresoservicio = @xid_fichaingresoservicio) 
  -- Relax state filter: If 1 is passed, allow 1 OR 0 (new) OR remove it if we want all. 
  -- But critically: EXCLUDE ANULADA (99)
  AND (dbo.App_Ma_Agenda_MUESTREOS.estado_caso IS NULL OR dbo.App_Ma_Agenda_MUESTREOS.estado_caso != 'ANULADA')
  -- Optional: If strict state filtering is desired by frontend, keep it. 
  -- But for "Asignación View" we usually want to see what's pending assignment OR assigned.
  -- The controller passes '1' (Pendiente). New items can be '0' or '1'.
  -- Let's just exclude ANULADA and check if we should keep the @xid_estadomuestreo check.
  -- If I remove it, I show everything. That aligns with "Gestionar Ficha".
  
ORDER BY dbo.App_Ma_Agenda_MUESTREOS.id_fichaingresoservicio DESC, 
         dbo.App_Ma_Agenda_MUESTREOS.id_agendamam
END
