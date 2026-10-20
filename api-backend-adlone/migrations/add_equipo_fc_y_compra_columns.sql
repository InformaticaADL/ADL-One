-- Agrega Factor de Corrección (fc0/fc15/fc30, calculado = -error) y datos de
-- compra/baja (Proveedor, Fecha de Compra, Documento, N° Docto, Valor Unitario,
-- Fecha dado de Baja) a mae_equipo y mae_equipo_historial. Idempotente.

IF COL_LENGTH('mae_equipo', 'fc0') IS NULL
BEGIN
    ALTER TABLE mae_equipo ADD
        fc0 NUMERIC(10,1) NULL,
        fc15 NUMERIC(10,1) NULL,
        fc30 NUMERIC(10,1) NULL,
        proveedor NVARCHAR(200) NULL,
        fecha_compra DATE NULL,
        documento_compra NVARCHAR(50) NULL,
        n_documento_compra NVARCHAR(50) NULL,
        valor_unitario NUMERIC(12,2) NULL,
        fecha_baja DATE NULL;
END

IF COL_LENGTH('mae_equipo_historial', 'fc0') IS NULL
BEGIN
    ALTER TABLE mae_equipo_historial ADD
        fc0 NUMERIC(10,1) NULL,
        fc15 NUMERIC(10,1) NULL,
        fc30 NUMERIC(10,1) NULL,
        proveedor NVARCHAR(200) NULL,
        fecha_compra DATE NULL,
        documento_compra NVARCHAR(50) NULL,
        n_documento_compra NVARCHAR(50) NULL,
        valor_unitario NUMERIC(12,2) NULL,
        fecha_baja DATE NULL;
END
