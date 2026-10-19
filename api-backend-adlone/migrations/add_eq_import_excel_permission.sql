IF NOT EXISTS (SELECT * FROM mae_permiso WHERE codigo = 'EQ_IMPORT_EXCEL')
BEGIN
    INSERT INTO mae_permiso (codigo, nombre, modulo, submodulo, tipo, orden, habilitado)
    VALUES (
        'EQ_IMPORT_EXCEL',
        'Importar y Validar Equipos desde Excel',
        'Gestión de Calidad',
        'GC - Equipos',
        'Acción',
        1050,
        1
    );
    PRINT 'Permiso EQ_IMPORT_EXCEL creado correctamente';
END
ELSE
BEGIN
    PRINT 'Permiso EQ_IMPORT_EXCEL ya existe';
END
GO

-- Descripción:
-- EQ_IMPORT_EXCEL controla el botón "Subir y Analizar Excel" en Admin >
-- Equipos (sube la plantilla, compara contra la BD y permite editar/crear
-- equipos desde ahí). Se restringe aparte del resto de Equipos (que sigue
-- gobernado por MA_A_GEST_EQUIPO) porque es una herramienta nueva que por
-- ahora solo debe quedar visible para Área Informática. Se otorga desde el
-- panel de administración de roles existente (RBAC) — no hay UI nueva para
-- asignarlo: Informática > Roles de Sistema > [rol de Área Informática] >
-- tildar "Importar y Validar Equipos desde Excel" dentro de GC - Equipos.
