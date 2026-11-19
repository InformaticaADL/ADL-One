-- Migration: add_permisos_gestion_calidad
-- Acciones de Gestión de Calidad que pasan a asignarse por permiso (Configurar rol / permisos), en vez de depender del
-- nombre del rol:
--   GC_PM_FIRMA_CALIDAD  Puesta en Marcha: firmar por Gestión de Calidad
--   GC_PM_FIRMA_TECNICA  Puesta en Marcha: firmar por el Área Técnica de Medio Ambiente
--   GC_PM_EDITAR         Puesta en Marcha: editar, documentos de una aprobada y registro interno
--   GC_CAUDAL_VOBO       Verificación de caudal: dar el V°B°
--   GC_CREAR_TIPO        Nuevo Equipo: registrar un tipo de equipo nuevo (define la sigla)
--
-- Para que nadie pierda lo que ya podía hacer, se asignan a los roles que hoy hacen cada acción:
--   · roles de Gestión de Calidad («... Gestión de Calidad ...») e Informática: firma Calidad, editar, V°B° y tipo nuevo;
--   · roles «Técnica MAM», «Coordinación MAM», «Gerencia Técnica» e Informática: firma Técnica y V°B°.
-- Después se ajustan rol por rol en Configurar rol / permisos. Mientras esta migración no se ejecute, la aplicación sigue
-- usando el nombre del rol (src/utils/permisosCalidad.js).
-- Se puede ejecutar más de una vez.

DECLARE @p TABLE (codigo VARCHAR(50), submodulo VARCHAR(100), nombre NVARCHAR(200), orden INT);
INSERT INTO @p VALUES
    ('GC_PM_FIRMA_CALIDAD', 'PUESTA EN MARCHA', N'Puesta en Marcha: firmar por Gestión de Calidad', 131),
    ('GC_PM_FIRMA_TECNICA', 'PUESTA EN MARCHA', N'Puesta en Marcha: firmar por el Área Técnica de Medio Ambiente', 132),
    ('GC_PM_EDITAR', 'PUESTA EN MARCHA', N'Puesta en Marcha: editar, documentos de una aprobada y registro interno', 133),
    ('GC_CAUDAL_VOBO', 'VERIFICACION CAUDAL', N'Verificación de caudal: dar el V°B°', 134),
    ('GC_CREAR_TIPO', 'NUEVO EQUIPO', N'Nuevo Equipo: registrar un tipo de equipo nuevo (define la sigla)', 135);

-- En el módulo «Gestión de Calidad» de Configurar rol / permisos (como los de Verificación de Temperatura).
INSERT INTO mae_permiso (codigo, modulo, submodulo, nombre, tipo, orden, habilitado)
SELECT n.codigo, 'Gestión de Calidad', n.submodulo, n.nombre, 'ACCION', n.orden, 1
FROM @p n
WHERE NOT EXISTS (SELECT 1 FROM mae_permiso x WHERE x.codigo = n.codigo);
GO

-- Roles por área (sin distinguir tildes ni mayúsculas).
DECLARE @calidad TABLE (id_rol NUMERIC(10, 0));
INSERT INTO @calidad
SELECT id_rol FROM mae_rol
WHERE nombre_rol COLLATE Latin1_General_CI_AI LIKE '%gestion de calidad%'
   OR nombre_rol COLLATE Latin1_General_CI_AI LIKE '%informatica%';

DECLARE @tecnica TABLE (id_rol NUMERIC(10, 0));
INSERT INTO @tecnica
SELECT id_rol FROM mae_rol
WHERE nombre_rol COLLATE Latin1_General_CI_AI LIKE '%tecnica mam%'
   OR nombre_rol COLLATE Latin1_General_CI_AI LIKE '%coordinacion mam%'
   OR nombre_rol COLLATE Latin1_General_CI_AI LIKE '%gerencia tecnica%'
   OR nombre_rol COLLATE Latin1_General_CI_AI LIKE '%informatica%';

INSERT INTO rel_rol_permiso (id_rol, id_permiso)
SELECT a.id_rol, p.id_permiso
FROM (
    SELECT id_rol, 'GC_PM_FIRMA_CALIDAD' AS codigo FROM @calidad
    UNION SELECT id_rol, 'GC_PM_EDITAR' FROM @calidad
    UNION SELECT id_rol, 'GC_CREAR_TIPO' FROM @calidad
    UNION SELECT id_rol, 'GC_CAUDAL_VOBO' FROM @calidad
    UNION SELECT id_rol, 'GC_PM_FIRMA_TECNICA' FROM @tecnica
    UNION SELECT id_rol, 'GC_CAUDAL_VOBO' FROM @tecnica
) a
JOIN mae_permiso p ON p.codigo = a.codigo
WHERE NOT EXISTS (SELECT 1 FROM rel_rol_permiso x WHERE x.id_rol = a.id_rol AND x.id_permiso = p.id_permiso);
GO

-- Qué roles quedaron con cada permiso (para revisar).
SELECT p.codigo, r.nombre_rol
FROM rel_rol_permiso rp
JOIN mae_permiso p ON p.id_permiso = rp.id_permiso
JOIN mae_rol r ON r.id_rol = rp.id_rol
WHERE p.codigo IN ('GC_PM_FIRMA_CALIDAD', 'GC_PM_FIRMA_TECNICA', 'GC_PM_EDITAR', 'GC_CAUDAL_VOBO', 'GC_CREAR_TIPO')
ORDER BY p.codigo, r.nombre_rol;
