/* 
  SEED: Datos iniciales para mae_solicitud_tipo
  Basado en los tipos actuales de gestión de equipos.
*/

INSERT INTO [dbo].[mae_solicitud_tipo] 
(nombre, area_destino, cod_permiso_crear, cod_permiso_resolver, plantilla_json, estado)
VALUES
('Activación de Equipo', 'AREA_TECNICA', 'AI_MA_CREAR_SOLICITUD', 'AI_MA_SOLICITUDES', '{"campos": ["nombre", "tipo", "ubicacion", "responsable"]}', 1),
('Baja de Equipo', 'AREA_TECNICA', 'AI_MA_CREAR_SOLICITUD', 'AI_MA_SOLICITUDES', '{"campos": ["id_equipo", "motivo"]}', 1),
('Traspaso de Equipo', 'AREA_TECNICA', 'AI_MA_CREAR_SOLICITUD', 'AI_MA_SOLICITUDES', '{"campos": ["id_equipo", "nueva_ubicacion", "nuevo_responsable"]}', 1),
('Nuevo Equipo', 'CALIDAD', 'AI_MA_CREAR_SOLICITUD', 'GC_EQUIPOS', '{"campos": ["nombre", "tipo", "ubicacion", "vigencia"]}', 1),
('Reporte de Problema', 'AREA_TECNICA', 'AI_MA_CREAR_SOLICITUD', 'AI_MA_SOLICITUDES', '{"campos": ["id_equipo", "descripcion_falla"]}', 1);

-- Nota: Los códigos de permiso se asocian a los existentes en mae_permiso para bootstraping.
