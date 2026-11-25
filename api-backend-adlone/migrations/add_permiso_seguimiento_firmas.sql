-- Migration: add_permiso_seguimiento_firmas
-- Permiso para el «Seguimiento de firmas» de Solicitudes: ver todas las fichas enviadas a firmar (de cualquiera que
-- las haya enviado), cuántas están firmadas, cuántas pendientes y quién debe firmar. Solo lectura: firmar sigue siendo
-- de cada firmante y cancelar, de quien la envió.
--   GC_SEGUIMIENTO_FIRMAS  Solicitudes: seguimiento de las fichas enviadas a firmar
--
-- Se asigna a los roles de Gestión de Calidad e Informática (los que lo veían hasta ahora por el nombre del rol).
-- Después se ajusta rol por rol en Configurar rol / permisos. Mientras esta migración no se ejecute, la aplicación
-- usa el nombre del rol (src/utils/permisosCalidad.js).
-- Se puede ejecutar más de una vez.

INSERT INTO mae_permiso (codigo, modulo, submodulo, nombre, tipo, orden, habilitado)
SELECT 'GC_SEGUIMIENTO_FIRMAS', 'Gestión de Calidad', 'FIRMAS', N'Solicitudes: seguimiento de las fichas enviadas a firmar (todas, firmadas y pendientes)', 'VISTA', 136, 1
WHERE NOT EXISTS (SELECT 1 FROM mae_permiso WHERE codigo = 'GC_SEGUIMIENTO_FIRMAS');
GO

INSERT INTO rel_rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM mae_rol r
JOIN mae_permiso p ON p.codigo = 'GC_SEGUIMIENTO_FIRMAS'
WHERE (r.nombre_rol COLLATE Latin1_General_CI_AI LIKE '%gestion de calidad%'
    OR r.nombre_rol COLLATE Latin1_General_CI_AI LIKE '%informatica%')
  AND NOT EXISTS (SELECT 1 FROM rel_rol_permiso x WHERE x.id_rol = r.id_rol AND x.id_permiso = p.id_permiso);
GO

-- Qué roles quedaron con el permiso (para revisar).
SELECT p.codigo, r.nombre_rol
FROM rel_rol_permiso rp
JOIN mae_permiso p ON p.id_permiso = rp.id_permiso
JOIN mae_rol r ON r.id_rol = rp.id_rol
WHERE p.codigo = 'GC_SEGUIMIENTO_FIRMAS'
ORDER BY r.nombre_rol;
