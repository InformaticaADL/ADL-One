-- Migration: add_equipo_datos_inventario
-- Columnas del inventario OI-FoGe-21 (hoja EQUIPOS MUESTREO) que mae_equipo no
-- tenía: MARCA, MODELO, N° DE SERIE, INFLUENCIA SIGNIFICATIVA (Alta / Media /
-- Baja) y JUSTIFICACIÓN. Se agregan también a mae_equipo_historial para que cada
-- versión las conserve.
--
-- Los datos se cargan después con el importador de Excel de Gestión de Equipos
-- (subir el inventario y "Actualizar"), que ya lee estas columnas.
-- Se puede ejecutar más de una vez.

IF COL_LENGTH('mae_equipo', 'marca') IS NULL
BEGIN
    ALTER TABLE mae_equipo ADD
        marca                     NVARCHAR(100)  NULL,
        modelo                    NVARCHAR(100)  NULL,
        n_serie                   NVARCHAR(100)  NULL,
        influencia_significativa  NVARCHAR(20)   NULL,
        justificacion_influencia  NVARCHAR(1000) NULL;
END;
GO

IF COL_LENGTH('mae_equipo_historial', 'marca') IS NULL
BEGIN
    ALTER TABLE mae_equipo_historial ADD
        marca                     NVARCHAR(100)  NULL,
        modelo                    NVARCHAR(100)  NULL,
        n_serie                   NVARCHAR(100)  NULL,
        influencia_significativa  NVARCHAR(20)   NULL,
        justificacion_influencia  NVARCHAR(1000) NULL;
END;
GO
