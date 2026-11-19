-- Migration: alter_equipo_habilitado_verif_temp
-- Habilitación para la verificación de temperatura (OI-FoGe-39), definida por Gestión de Calidad:
-- un equipo Fuera de Servicio o Dado de Baja aparece en Verificación de Temperatura solo si se habilitó desde el
-- Inventario de Equipos. Los Operativos aparecen siempre. Ningún equipo queda habilitado al crear la columna.
-- Se puede ejecutar más de una vez.

IF COL_LENGTH('mae_equipo', 'habilitado_verif_temp') IS NULL
    ALTER TABLE mae_equipo ADD habilitado_verif_temp BIT NOT NULL
        CONSTRAINT DF_mae_equipo_habilitado_verif_temp DEFAULT 0;
GO
