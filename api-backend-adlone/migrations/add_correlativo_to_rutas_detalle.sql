-- Add frecuencia_correlativo column to route detail table
-- This allows tracking which specific service instance (correlativo) is planned in each route
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'mae_rutas_planificadas_detalle' 
    AND COLUMN_NAME = 'frecuencia_correlativo'
)
BEGIN
    ALTER TABLE mae_rutas_planificadas_detalle 
    ADD frecuencia_correlativo VARCHAR(100) NULL;
    
    PRINT 'Column frecuencia_correlativo added to mae_rutas_planificadas_detalle';
END
ELSE
BEGIN
    PRINT 'Column frecuencia_correlativo already exists';
END
GO
