-- Migration: estado_equipo_tres_estados
-- El estado del equipo (mae_equipo.Estado, columna ESTADO del inventario
-- OI-FoGe-21) queda en tres valores: Operativo, Dado de Baja y Fuera de Servicio.
-- "En Mantención" y "En Calibración" se desactivan en el catálogo (no se borran:
-- ningún equipo los usa hoy, pero quedan por si se quieren volver a activar).
-- Se puede ejecutar más de una vez.

-- 1) Asegurar que existan los tres estados y estén activos.
INSERT INTO mae_estado_equipo (nombre, activo)
SELECT s.nombre, 1
FROM (VALUES ('Operativo'), ('Dado de Baja'), ('Fuera de Servicio')) AS s (nombre)
WHERE NOT EXISTS (SELECT 1 FROM mae_estado_equipo x WHERE x.nombre = s.nombre);

UPDATE mae_estado_equipo SET activo = 1
WHERE nombre IN ('Operativo', 'Dado de Baja', 'Fuera de Servicio');

-- 2) Desactivar el resto.
UPDATE mae_estado_equipo SET activo = 0
WHERE nombre NOT IN ('Operativo', 'Dado de Baja', 'Fuera de Servicio');

-- 3) Por si algún equipo quedó con un estado fuera de los tres (hoy: ninguno).
UPDATE mae_equipo SET Estado = 'Fuera de Servicio'
WHERE Estado IN ('En Mantención', 'En Calibración', 'En Mantencion', 'En Calibracion');
GO
