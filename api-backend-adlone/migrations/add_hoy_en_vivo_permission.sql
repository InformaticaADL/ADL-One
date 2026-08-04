IF NOT EXISTS (SELECT * FROM mae_permiso WHERE codigo = 'AI_MA_HOY_EN_VIVO')
BEGIN
    INSERT INTO mae_permiso (codigo, nombre, modulo, submodulo, tipo, orden, habilitado)
    VALUES (
        'AI_MA_HOY_EN_VIVO',
        'Hoy en Vivo',
        'Medio Ambiente',
        '4. Operaciones Terreno',
        'Vista',
        1002,
        1
    );
    PRINT 'Permiso AI_MA_HOY_EN_VIVO creado correctamente';
END
ELSE
BEGIN
    PRINT 'Permiso AI_MA_HOY_EN_VIVO ya existe';
END
GO

-- Descripción:
-- AI_MA_HOY_EN_VIVO controla el acceso al mapa de seguimiento en tiempo real
-- de muestreadores en terreno (submódulo "Hoy en Vivo" dentro de Medio
-- Ambiente → 4. Operaciones Terreno). Se otorga a supervisores/jefatura desde
-- el panel de administración de roles existente (RBAC), no hay UI nueva para
-- asignarlo — reutiliza el flujo estándar de gestión de roles/permisos.
