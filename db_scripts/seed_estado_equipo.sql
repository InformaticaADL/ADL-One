USE [PruebasInformatica]
GO

-- Insertar estados de equipo por defecto si no existen
IF NOT EXISTS (SELECT 1 FROM mae_estado_equipo WHERE nombre = 'Operativo')
    INSERT INTO mae_estado_equipo (nombre, activo, fecha_creacion) VALUES ('Operativo', 1, GETDATE());

IF NOT EXISTS (SELECT 1 FROM mae_estado_equipo WHERE nombre = 'Dado de Baja')
    INSERT INTO mae_estado_equipo (nombre, activo, fecha_creacion) VALUES ('Dado de Baja', 1, GETDATE());

IF NOT EXISTS (SELECT 1 FROM mae_estado_equipo WHERE nombre = 'En Mantención')
    INSERT INTO mae_estado_equipo (nombre, activo, fecha_creacion) VALUES ('En Mantención', 1, GETDATE());

IF NOT EXISTS (SELECT 1 FROM mae_estado_equipo WHERE nombre = 'En Calibración')
    INSERT INTO mae_estado_equipo (nombre, activo, fecha_creacion) VALUES ('En Calibración', 1, GETDATE());

IF NOT EXISTS (SELECT 1 FROM mae_estado_equipo WHERE nombre = 'Fuera de Servicio')
    INSERT INTO mae_estado_equipo (nombre, activo, fecha_creacion) VALUES ('Fuera de Servicio', 1, GETDATE());
GO
