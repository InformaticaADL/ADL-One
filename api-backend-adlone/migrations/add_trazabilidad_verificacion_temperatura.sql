-- Migration: add_trazabilidad_verificacion_temperatura
-- Verificación de Temperatura (OI-FoGe-39): quién hizo cada cambio de estado,
-- y permisos separados para las acciones que cierran o deshacen una ficha.
--
-- 1. Columnas de trazabilidad en mae_verificacion_temperatura (todas NULL,
--    no afectan filas existentes):
--      id_usuario_envio_firma / fecha_envio_firma        quién la envió a firma
--      id_usuario_vuelve_borrador / fecha_vuelve_borrador quién la devolvió a borrador
--      id_usuario_registra_firma                          quién registró la firma del muestreador
--      id_usuario_anula / fecha_anulacion                 quién la anuló
--    Además cada cambio de estado queda en App_Audit_Log (lo hace el backend).
--
-- 2. Permisos nuevos:
--      GC_VERIF_TEMP_FIRMAR  firmar, devolver a borrador y anular
--      GC_VERIF_TEMP_PATRON  registrar / corregir errores de los termómetros patrón
--    Se asignan a TODOS los roles que hoy tienen GC_VERIF_TEMP, así nadie
--    pierde lo que ya podía hacer. Después se quitan del rol que no deba
--    tenerlos (Admin. Info > Roles).
--    Mientras esta migración no se ejecute, el backend acepta GC_VERIF_TEMP
--    para esas acciones (ver src/middlewares/permisoConRespaldo.js).
--
-- Se puede ejecutar más de una vez.

IF COL_LENGTH('mae_verificacion_temperatura', 'id_usuario_envio_firma') IS NULL
    ALTER TABLE mae_verificacion_temperatura ADD id_usuario_envio_firma NUMERIC(10, 0) NULL;
IF COL_LENGTH('mae_verificacion_temperatura', 'fecha_envio_firma') IS NULL
    ALTER TABLE mae_verificacion_temperatura ADD fecha_envio_firma DATETIME NULL;
IF COL_LENGTH('mae_verificacion_temperatura', 'id_usuario_vuelve_borrador') IS NULL
    ALTER TABLE mae_verificacion_temperatura ADD id_usuario_vuelve_borrador NUMERIC(10, 0) NULL;
IF COL_LENGTH('mae_verificacion_temperatura', 'fecha_vuelve_borrador') IS NULL
    ALTER TABLE mae_verificacion_temperatura ADD fecha_vuelve_borrador DATETIME NULL;
IF COL_LENGTH('mae_verificacion_temperatura', 'id_usuario_registra_firma') IS NULL
    ALTER TABLE mae_verificacion_temperatura ADD id_usuario_registra_firma NUMERIC(10, 0) NULL;
IF COL_LENGTH('mae_verificacion_temperatura', 'id_usuario_anula') IS NULL
    ALTER TABLE mae_verificacion_temperatura ADD id_usuario_anula NUMERIC(10, 0) NULL;
IF COL_LENGTH('mae_verificacion_temperatura', 'fecha_anulacion') IS NULL
    ALTER TABLE mae_verificacion_temperatura ADD fecha_anulacion DATETIME NULL;
GO

-- Permisos, con el mismo módulo/submódulo que GC_VERIF_TEMP.
IF NOT EXISTS (SELECT 1 FROM mae_permiso WHERE codigo = 'GC_VERIF_TEMP_FIRMAR')
    INSERT INTO mae_permiso (codigo, modulo, submodulo, nombre, tipo, orden, habilitado)
    SELECT 'GC_VERIF_TEMP_FIRMAR', modulo, submodulo, 'Verificación de Temperatura: firmar, devolver a borrador y anular', 'ACCION', 121, 1
    FROM mae_permiso WHERE codigo = 'GC_VERIF_TEMP';

IF NOT EXISTS (SELECT 1 FROM mae_permiso WHERE codigo = 'GC_VERIF_TEMP_PATRON')
    INSERT INTO mae_permiso (codigo, modulo, submodulo, nombre, tipo, orden, habilitado)
    SELECT 'GC_VERIF_TEMP_PATRON', modulo, submodulo, 'Verificación de Temperatura: errores de los termómetros patrón', 'ACCION', 122, 1
    FROM mae_permiso WHERE codigo = 'GC_VERIF_TEMP';
GO

-- A todos los roles que ya tienen GC_VERIF_TEMP.
INSERT INTO rel_rol_permiso (id_rol, id_permiso)
SELECT rp.id_rol, nuevo.id_permiso
FROM rel_rol_permiso rp
JOIN mae_permiso base ON base.id_permiso = rp.id_permiso AND base.codigo = 'GC_VERIF_TEMP'
CROSS JOIN mae_permiso nuevo
WHERE nuevo.codigo IN ('GC_VERIF_TEMP_FIRMAR', 'GC_VERIF_TEMP_PATRON')
  AND NOT EXISTS (SELECT 1 FROM rel_rol_permiso x WHERE x.id_rol = rp.id_rol AND x.id_permiso = nuevo.id_permiso);
GO

PRINT 'Trazabilidad y permisos de Verificación de Temperatura listos.';
