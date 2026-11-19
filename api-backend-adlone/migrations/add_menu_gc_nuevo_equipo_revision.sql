-- Migration: add_menu_gc_nuevo_equipo_revision
-- Links del menú lateral "G. Calidad" para las pantallas Nuevo Equipo y Revisión documental. El id_accion es el
-- activeSubmodule que DashboardPage.tsx usa para mostrar la pantalla; permissions_str, los permisos (cualquiera de ellos).
-- Se puede ejecutar más de una vez.

IF NOT EXISTS (SELECT 1 FROM mae_menu_link WHERE id_modulo = 'gestion_calidad' AND id_accion = 'gc-nuevo-equipo')
    INSERT INTO mae_menu_link (id_modulo, id_accion, label, permissions_str, sort_order, activo)
    VALUES ('gestion_calidad', 'gc-nuevo-equipo', 'Nuevo Equipo', 'AI_MA_CREAR_EQUIPO', 22, 1);

IF NOT EXISTS (SELECT 1 FROM mae_menu_link WHERE id_modulo = 'gestion_calidad' AND id_accion = 'gc-revision-documental')
    INSERT INTO mae_menu_link (id_modulo, id_accion, label, permissions_str, sort_order, activo)
    VALUES ('gestion_calidad', 'gc-revision-documental', 'Revisión documental', 'MA_A_GEST_EQUIPO,GC_ACCESO', 27, 1);
