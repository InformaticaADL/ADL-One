-- ==========================================================
-- Nombre: migration_rutas_planificadas.sql
-- Descripción: Tablas para el modo "Rutas Base" (Guardar rutas sin asignar)
-- ==========================================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='mae_rutas_planificadas' AND xtype='U')
BEGIN
    CREATE TABLE mae_rutas_planificadas (
        id_ruta_planificada INT IDENTITY(1,1) PRIMARY KEY,
        nombre_ruta VARCHAR(250) NOT NULL,
        fecha_creacion DATETIME DEFAULT GETDATE(),
        id_usuario_creador INT,
        estado VARCHAR(50) DEFAULT 'PENDIENTE' -- PENDIENTE, ASIGNADA, ANULADA
    );
END
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='mae_rutas_planificadas_detalle' AND xtype='U')
BEGIN
    CREATE TABLE mae_rutas_planificadas_detalle (
        id_ruta_detalle INT IDENTITY(1,1) PRIMARY KEY,
        id_ruta_planificada INT NOT NULL,
        id_fichaingresoservicio NUMERIC(10,0) NOT NULL,
        orden INT DEFAULT 0,
        CONSTRAINT FK_RutaPlanificada FOREIGN KEY (id_ruta_planificada) REFERENCES mae_rutas_planificadas(id_ruta_planificada) ON DELETE CASCADE
    );
END
GO
