-- ============================================================
-- Setup: Grupos de Rutas Planificadas
-- Crea tabla de grupos y extiende mae_rutas_planificadas
-- ============================================================

-- 1. Tabla de grupos
IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='mae_grupos_rutas' AND xtype='U')
    CREATE TABLE mae_grupos_rutas (
        id_grupo       INT IDENTITY(1,1) PRIMARY KEY,
        nombre_grupo   NVARCHAR(250) NOT NULL,
        descripcion    NVARCHAR(1000) NULL,
        activo         BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME NOT NULL DEFAULT GETDATE()
    );

-- 2. Columna id_grupo en rutas planificadas
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('mae_rutas_planificadas') AND name = 'id_grupo')
    ALTER TABLE mae_rutas_planificadas ADD id_grupo INT NULL;

-- 3. FK (solo si no existe)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_rutas_planificadas_grupo')
    ALTER TABLE mae_rutas_planificadas
        ADD CONSTRAINT FK_rutas_planificadas_grupo
        FOREIGN KEY (id_grupo) REFERENCES mae_grupos_rutas(id_grupo);

-- 4. Columna descripcion en rutas planificadas
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('mae_rutas_planificadas') AND name = 'descripcion')
    ALTER TABLE mae_rutas_planificadas ADD descripcion NVARCHAR(1000) NULL;

-- Verificar resultado
SELECT 'mae_grupos_rutas' as tabla, COUNT(*) as registros FROM mae_grupos_rutas
UNION ALL
SELECT 'mae_rutas_planificadas', COUNT(*) FROM mae_rutas_planificadas;
