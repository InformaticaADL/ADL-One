IF NOT EXISTS (SELECT * FROM mae_menu_link WHERE id_accion = 'ma-hoy-en-vivo')
BEGIN
    INSERT INTO mae_menu_link (id_modulo, id_accion, label, permissions_str, sort_order, activo)
    VALUES (
        'medio_ambiente',
        'ma-hoy-en-vivo',
        'Hoy en Vivo',
        'AI_MA_HOY_EN_VIVO',
        30,
        1
    );
    PRINT 'Link ma-hoy-en-vivo creado correctamente';
END
ELSE
BEGIN
    PRINT 'Link ma-hoy-en-vivo ya existe';
END
GO

-- Descripción:
-- Agrega "Hoy en Vivo" como link dentro del módulo Medio Ambiente en el menú
-- dinámico (mae_menu_modulo / mae_menu_link, servido por GET /api/menu). El
-- id_accion 'ma-hoy-en-vivo' es el valor que DashboardPage.tsx compara contra
-- activeSubmodule para renderizar HoyEnVivoPage. Visible solo para usuarios
-- cuyo rol tenga el permiso AI_MA_HOY_EN_VIVO (ya sembrado en fase 2).
