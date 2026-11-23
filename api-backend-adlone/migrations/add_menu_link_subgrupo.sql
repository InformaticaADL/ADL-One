-- Migration: add_menu_link_subgrupo
-- Subcategorías dentro de un módulo del menú (hoy: G. Calidad se divide en Medio Ambiente y Laboratorio).
-- subgrupo es NULL para todo módulo que no use subcategorías (sigue mostrándose como antes, en una sola lista).
IF COL_LENGTH('mae_menu_link', 'subgrupo') IS NULL
BEGIN
    ALTER TABLE mae_menu_link ADD subgrupo NVARCHAR(50) NULL;
END
GO

-- Los enlaces de G. Calidad existentes son de Medio Ambiente (Laboratorio todavía no tiene submódulos
-- propios), salvo Muestreadores, que va directo bajo G. Calidad. Solo donde subgrupo sigue sin asignar,
-- para no pisar una asignación posterior.
UPDATE mae_menu_link SET subgrupo = 'Medio Ambiente'
WHERE id_modulo = 'gestion_calidad' AND subgrupo IS NULL AND id_accion <> 'admin-muestreadores';
GO

-- Muestreadores directo bajo G. Calidad (fuera de Medio Ambiente).
UPDATE mae_menu_link SET subgrupo = NULL
WHERE id_modulo = 'gestion_calidad' AND id_accion = 'admin-muestreadores';
GO

