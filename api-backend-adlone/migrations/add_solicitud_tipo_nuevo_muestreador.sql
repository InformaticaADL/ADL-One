-- Registra "Nuevo Muestreador" como un tipo de solicitud del sistema URS
-- (mae_solicitud_tipo), destinado a Gestión de Calidad, para que las
-- solicitudes creadas por el botón "Solicitar" de los analizadores de Excel
-- aparezcan en la bandeja de Solicitudes (UniversalInbox) del rol
-- "Área Gestión de Calidad" (id_rol = 5), igual que el resto de solicitudes
-- de equipos. Idempotente.

IF NOT EXISTS (SELECT 1 FROM mae_solicitud_tipo WHERE nombre = 'Nuevo Muestreador')
BEGIN
    INSERT INTO mae_solicitud_tipo (nombre, area_destino, estado)
    VALUES ('Nuevo Muestreador', 'Gestión de Calidad', 1);
END

DECLARE @idTipo NUMERIC(10,0) = (SELECT id_tipo FROM mae_solicitud_tipo WHERE nombre = 'Nuevo Muestreador');
DECLARE @idRolCalidad NUMERIC(10,0) = (SELECT id_rol FROM mae_rol WHERE nombre_rol = 'Área Gestión de Calidad');

IF @idTipo IS NOT NULL AND @idRolCalidad IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM rel_solicitud_tipo_permiso WHERE id_tipo = @idTipo AND id_rol = @idRolCalidad AND tipo_acceso = 'GESTION')
        INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (@idTipo, @idRolCalidad, 'GESTION');

    IF NOT EXISTS (SELECT 1 FROM rel_solicitud_tipo_permiso WHERE id_tipo = @idTipo AND id_rol = @idRolCalidad AND tipo_acceso = 'DERIVACION')
        INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (@idTipo, @idRolCalidad, 'DERIVACION');
END
