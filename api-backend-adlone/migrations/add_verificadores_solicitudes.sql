-- Lista global de "verificadores" (jefatura) que se entera de TODAS las solicitudes
-- de clientes (WebClientesV2), sin importar la empresa -- a diferencia de
-- rel_usuario_empresa_asignada, que es por empresa+área. Ver
-- docs/superpowers/specs/2026-10-23-verificadores-responsables-solicitudes-design.md
-- en WebClientesV2.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rel_usuario_verificador_solicitudes')
BEGIN
    CREATE TABLE dbo.rel_usuario_verificador_solicitudes (
        id            INT IDENTITY PRIMARY KEY,
        id_usuario    NUMERIC(10,0) NOT NULL,
        asignado_por  NUMERIC(10,0) NULL,
        asignado_en   DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_verificador_usuario UNIQUE (id_usuario)
    );
    PRINT 'Tabla rel_usuario_verificador_solicitudes creada correctamente';
END
ELSE
BEGIN
    PRINT 'Tabla rel_usuario_verificador_solicitudes ya existe';
END
GO

-- Permiso para configurar la lista de verificadores, desde el panel RBAC.
IF NOT EXISTS (SELECT 1 FROM mae_permiso WHERE codigo = 'AI_SOLICITUDES_VERIFICADORES_CONFIG')
BEGIN
    INSERT INTO mae_permiso (codigo, nombre, modulo, submodulo, tipo, orden, habilitado)
    VALUES (
        'AI_SOLICITUDES_VERIFICADORES_CONFIG',
        'Configurar verificadores de Solicitudes',
        'Administración',
        'Solicitudes de Clientes',
        'Configuración',
        2101,
        1
    );
    PRINT 'Permiso AI_SOLICITUDES_VERIFICADORES_CONFIG creado correctamente';
END
ELSE
BEGIN
    PRINT 'Permiso AI_SOLICITUDES_VERIFICADORES_CONFIG ya existe';
END
GO

-- Descripción:
-- Controla quién puede administrar la lista global de verificadores (jefatura)
-- que recibe copia informativa de TODAS las solicitudes del portal de clientes,
-- sin importar la empresa. No aprueban ni bloquean nada.
