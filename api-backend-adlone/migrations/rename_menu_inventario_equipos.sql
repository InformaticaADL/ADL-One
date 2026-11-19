-- Migration: rename_menu_inventario_equipos
-- El link «Equipos» del menú lateral de G. Calidad pasa a llamarse «Inventario de Equipos».
-- Se puede ejecutar más de una vez.
UPDATE mae_menu_link SET label = 'Inventario de Equipos'
WHERE id_modulo = 'gestion_calidad' AND id_accion = 'admin-equipos-gestion' AND label <> 'Inventario de Equipos';
