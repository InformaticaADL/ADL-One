-- =============================================================================
-- ADL ONE — Limpieza de datos de prueba PRE-PRODUCCIÓN
-- Base de datos: ADL_ONE_DB
-- =============================================================================
--
--  ⚠️ LEER ANTES DE EJECUTAR:
--
--  Este script BORRA datos transaccionales (fichas, asignaciones, rutas,
--  solicitudes, chats, notificaciones, auditoría, intentos de login y tokens
--  de reset). NO toca maestros (usuarios, roles, permisos, empresas, centros,
--  catálogos de normativas, técnicas, laboratorios, etc.).
--
--  PASOS RECOMENDADOS:
--    1. Hacer BACKUP COMPLETO de ADL_ONE_DB ANTES de correr esto.
--    2. Ejecutar fuera de horario.
--    3. Apagar el backend (`api-backend-adlone`) para evitar inserts mientras corre.
--    4. Verificar contadores al final.
--
--  El script está en TRANSACCIONES por bloque para poder hacer ROLLBACK si algo
--  no luce bien. Cambiá COMMIT por ROLLBACK al final del bloque para abortar.
-- =============================================================================

USE ADL_ONE_DB;
GO

PRINT '═══════════════════════════════════════════════════════════════════════';
PRINT 'INICIO LIMPIEZA PRE-PRODUCCIÓN  — ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '═══════════════════════════════════════════════════════════════════════';
GO

-- =============================================================================
-- BLOQUE 1 — FICHAS, AGENDA, EQUIPOS DE MUESTREO Y RESULTADOS
-- (orden: hijos primero, padres después; respeta FKs)
-- =============================================================================
BEGIN TRANSACTION;
BEGIN TRY

    PRINT '── Bloque 1: Fichas y muestreos ────────────────────────────────────';

    -- Hijos de App_Ma_Agenda_MUESTREOS
    IF OBJECT_ID('App_Ma_Equipos_MUESTREOS', 'U') IS NOT NULL
        DELETE FROM App_Ma_Equipos_MUESTREOS;
    PRINT '   App_Ma_Equipos_MUESTREOS:        ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('App_Ma_Resultados', 'U') IS NOT NULL
        DELETE FROM App_Ma_Resultados;
    PRINT '   App_Ma_Resultados:               ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    -- Hijos de App_Ma_FichaIngresoServicio_ENC
    IF OBJECT_ID('App_Ma_Agenda_MUESTREOS', 'U') IS NOT NULL
        DELETE FROM App_Ma_Agenda_MUESTREOS;
    PRINT '   App_Ma_Agenda_MUESTREOS:         ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('App_Ma_FichaIngresoServicio_DET', 'U') IS NOT NULL
        DELETE FROM App_Ma_FichaIngresoServicio_DET;
    PRINT '   App_Ma_FichaIngresoServicio_DET: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('mae_ficha_historial', 'U') IS NOT NULL
        DELETE FROM mae_ficha_historial;
    PRINT '   mae_ficha_historial:             ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    -- Padre
    IF OBJECT_ID('App_Ma_FichaIngresoServicio_ENC', 'U') IS NOT NULL
        DELETE FROM App_Ma_FichaIngresoServicio_ENC;
    PRINT '   App_Ma_FichaIngresoServicio_ENC: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    -- Reset de identidades (los IDs vuelven a empezar en 1)
    -- NOTA: DBCC CHECKIDENT solo reinicia el CONTADOR de identidad; NO altera la
    --       estructura de la tabla ni sus columnas. El contenido ya fue borrado arriba.
    IF OBJECT_ID('App_Ma_FichaIngresoServicio_ENC', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('App_Ma_FichaIngresoServicio_ENC'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('App_Ma_FichaIngresoServicio_ENC', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('App_Ma_FichaIngresoServicio_DET', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('App_Ma_FichaIngresoServicio_DET'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('App_Ma_FichaIngresoServicio_DET', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('App_Ma_Agenda_MUESTREOS', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('App_Ma_Agenda_MUESTREOS'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('App_Ma_Agenda_MUESTREOS', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('App_Ma_Equipos_MUESTREOS', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('App_Ma_Equipos_MUESTREOS'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('App_Ma_Equipos_MUESTREOS', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('App_Ma_Resultados', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('App_Ma_Resultados'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('App_Ma_Resultados', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('mae_ficha_historial', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_ficha_historial'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_ficha_historial', RESEED, 0) WITH NO_INFOMSGS;

    COMMIT;
    PRINT '✅ Bloque 1 OK';
END TRY
BEGIN CATCH
    ROLLBACK;
    PRINT '❌ ERROR Bloque 1: ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO

-- =============================================================================
-- BLOQUE 2 — RUTAS PLANIFICADAS Y EJECUCIONES
-- (NO se borra mae_grupos_rutas — son configuración / agrupadores)
-- =============================================================================
BEGIN TRANSACTION;
BEGIN TRY

    PRINT '── Bloque 2: Rutas y ejecuciones ───────────────────────────────────';

    IF OBJECT_ID('mae_rutas_ejecuciones_detalle', 'U') IS NOT NULL
        DELETE FROM mae_rutas_ejecuciones_detalle;
    PRINT '   mae_rutas_ejecuciones_detalle:   ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('mae_rutas_ejecuciones', 'U') IS NOT NULL
        DELETE FROM mae_rutas_ejecuciones;
    PRINT '   mae_rutas_ejecuciones:           ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('mae_rutas_planificadas_detalle', 'U') IS NOT NULL
        DELETE FROM mae_rutas_planificadas_detalle;
    PRINT '   mae_rutas_planificadas_detalle:  ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('mae_rutas_planificadas', 'U') IS NOT NULL
        DELETE FROM mae_rutas_planificadas;
    PRINT '   mae_rutas_planificadas:          ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    -- Si quieres también borrar los GRUPOS de rutas que se crearon en pruebas, descomenta:
    -- IF OBJECT_ID('mae_grupos_rutas', 'U') IS NOT NULL
    --     DELETE FROM mae_grupos_rutas;
    -- PRINT '   mae_grupos_rutas:                ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    -- Reset identidades (solo el contador; la estructura de las tablas no se toca)
    IF OBJECT_ID('mae_rutas_planificadas', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_rutas_planificadas'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_rutas_planificadas', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('mae_rutas_planificadas_detalle', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_rutas_planificadas_detalle'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_rutas_planificadas_detalle', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('mae_rutas_ejecuciones', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_rutas_ejecuciones'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_rutas_ejecuciones', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('mae_rutas_ejecuciones_detalle', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_rutas_ejecuciones_detalle'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_rutas_ejecuciones_detalle', RESEED, 0) WITH NO_INFOMSGS;

    COMMIT;
    PRINT '✅ Bloque 2 OK';
END TRY
BEGIN CATCH
    ROLLBACK;
    PRINT '❌ ERROR Bloque 2: ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO

-- =============================================================================
-- BLOQUE 3 — SOLICITUDES URS (Universal Request System)
-- (NO se borra mae_solicitud_tipo — son tipos maestros)
-- =============================================================================
BEGIN TRANSACTION;
BEGIN TRY

    PRINT '── Bloque 3: Solicitudes URS ───────────────────────────────────────';

    IF OBJECT_ID('mae_solicitud_adjunto', 'U') IS NOT NULL
        DELETE FROM mae_solicitud_adjunto;
    PRINT '   mae_solicitud_adjunto:           ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('mae_solicitud_comentario', 'U') IS NOT NULL
        DELETE FROM mae_solicitud_comentario;
    PRINT '   mae_solicitud_comentario:        ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('mae_solicitud_derivacion', 'U') IS NOT NULL
        DELETE FROM mae_solicitud_derivacion;
    PRINT '   mae_solicitud_derivacion:        ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('mae_solicitud_equipo', 'U') IS NOT NULL
        DELETE FROM mae_solicitud_equipo;
    PRINT '   mae_solicitud_equipo:            ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('mae_solicitud_historial', 'U') IS NOT NULL
        DELETE FROM mae_solicitud_historial;
    PRINT '   mae_solicitud_historial:         ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('mae_solicitud', 'U') IS NOT NULL
        DELETE FROM mae_solicitud;
    PRINT '   mae_solicitud:                   ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    -- Reset identidades de solicitud y sus tablas hijas (solo el contador, no la estructura)
    IF OBJECT_ID('mae_solicitud', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_solicitud'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_solicitud', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('mae_solicitud_adjunto', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_solicitud_adjunto'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_solicitud_adjunto', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('mae_solicitud_comentario', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_solicitud_comentario'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_solicitud_comentario', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('mae_solicitud_derivacion', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_solicitud_derivacion'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_solicitud_derivacion', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('mae_solicitud_equipo', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_solicitud_equipo'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_solicitud_equipo', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('mae_solicitud_historial', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_solicitud_historial'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_solicitud_historial', RESEED, 0) WITH NO_INFOMSGS;

    COMMIT;
    PRINT '✅ Bloque 3 OK';
END TRY
BEGIN CATCH
    ROLLBACK;
    PRINT '❌ ERROR Bloque 3: ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO

-- =============================================================================
-- BLOQUE 4 — CHATS (1:1 y grupales)
-- =============================================================================
BEGIN TRANSACTION;
BEGIN TRY

    PRINT '── Bloque 4: Chats ─────────────────────────────────────────────────';

    -- Lecturas y reacciones primero (FK a mensajes)
    IF OBJECT_ID('rel_chat_lectura', 'U') IS NOT NULL
        DELETE FROM rel_chat_lectura;
    PRINT '   rel_chat_lectura:                ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('rel_chat_reaccion', 'U') IS NOT NULL
        DELETE FROM rel_chat_reaccion;
    PRINT '   rel_chat_reaccion:               ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    -- Mensajes (FK a conversación)
    IF OBJECT_ID('mae_chat_mensaje', 'U') IS NOT NULL
        DELETE FROM mae_chat_mensaje;
    PRINT '   mae_chat_mensaje:                ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    -- Participantes
    IF OBJECT_ID('rel_chat_participante', 'U') IS NOT NULL
        DELETE FROM rel_chat_participante;
    PRINT '   rel_chat_participante:           ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    -- Conversaciones
    IF OBJECT_ID('mae_chat_conversacion', 'U') IS NOT NULL
        DELETE FROM mae_chat_conversacion;
    PRINT '   mae_chat_conversacion:           ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    -- Favoritos de contacto (limpian la barra lateral)
    IF OBJECT_ID('rel_contacto_favorito', 'U') IS NOT NULL
        DELETE FROM rel_contacto_favorito;
    PRINT '   rel_contacto_favorito:           ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    -- Reset identidades de chat y sus tablas de relación (solo el contador, no la estructura)
    IF OBJECT_ID('mae_chat_conversacion', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_chat_conversacion'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_chat_conversacion', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('mae_chat_mensaje', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_chat_mensaje'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_chat_mensaje', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('rel_chat_participante', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('rel_chat_participante'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('rel_chat_participante', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('rel_chat_lectura', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('rel_chat_lectura'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('rel_chat_lectura', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('rel_chat_reaccion', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('rel_chat_reaccion'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('rel_chat_reaccion', RESEED, 0) WITH NO_INFOMSGS;

    COMMIT;
    PRINT '✅ Bloque 4 OK';
END TRY
BEGIN CATCH
    ROLLBACK;
    PRINT '❌ ERROR Bloque 4: ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO

-- =============================================================================
-- BLOQUE 5 — NOTIFICACIONES OPERATIVAS
-- (NO se borra mae_notificacion_modulo / _funcionalidad / _regla — son config)
-- (NO se borra mae_evento_notificacion / rel_evento_destinatario — config)
-- =============================================================================
BEGIN TRANSACTION;
BEGIN TRY

    PRINT '── Bloque 5: Notificaciones operativas ─────────────────────────────';

    IF OBJECT_ID('mae_notificacion', 'U') IS NOT NULL
        DELETE FROM mae_notificacion;
    PRINT '   mae_notificacion:                ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('mae_notificacion', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_notificacion'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_notificacion', RESEED, 0) WITH NO_INFOMSGS;

    COMMIT;
    PRINT '✅ Bloque 5 OK';
END TRY
BEGIN CATCH
    ROLLBACK;
    PRINT '❌ ERROR Bloque 5: ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO

-- =============================================================================
-- BLOQUE 6 — SEGURIDAD (auth)
-- Tokens de reset de password e intentos fallidos de login → siempre limpiar.
-- =============================================================================
BEGIN TRANSACTION;
BEGIN TRY

    PRINT '── Bloque 6: Seguridad (login attempts y reset tokens) ─────────────';

    IF OBJECT_ID('mae_login_attempts', 'U') IS NOT NULL
        DELETE FROM mae_login_attempts;
    PRINT '   mae_login_attempts:              ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('mae_password_reset_tokens', 'U') IS NOT NULL
        DELETE FROM mae_password_reset_tokens;
    PRINT '   mae_password_reset_tokens:       ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    IF OBJECT_ID('mae_login_attempts', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_login_attempts'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_login_attempts', RESEED, 0) WITH NO_INFOMSGS;
    IF OBJECT_ID('mae_password_reset_tokens', 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('mae_password_reset_tokens'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('mae_password_reset_tokens', RESEED, 0) WITH NO_INFOMSGS;

    -- Resetear el contador permisos_version de TODOS los usuarios para JWT limpios
    -- (cualquier sesión activa quedará fuera al volver a entrar)
    IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = 'permisos_version' AND Object_ID = Object_ID('mae_usuario'))
    BEGIN
        UPDATE mae_usuario SET permisos_version = 0;
        PRINT '   mae_usuario.permisos_version:    ' + CAST(@@ROWCOUNT AS VARCHAR) + ' usuarios reseteados';
    END

    COMMIT;
    PRINT '✅ Bloque 6 OK';
END TRY
BEGIN CATCH
    ROLLBACK;
    PRINT '❌ ERROR Bloque 6: ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO

-- =============================================================================
-- BLOQUE 7 — AUDITORÍA HISTÓRICA
-- ✅ ACTIVO: este bloque BORRA el contenido de App_Audit_Log (logs de QA/pruebas)
--    para entrar a producción 100% limpio. Solo se elimina el CONTENIDO; la
--    tabla y sus columnas permanecen intactas.
--    Si en el futuro quisieras CONSERVAR los logs, comentá el bloque DELETE de abajo.
-- =============================================================================
BEGIN TRANSACTION;
BEGIN TRY

    PRINT '── Bloque 7: Logs de auditoría ─────────────────────────────────────';

    IF OBJECT_ID('App_Audit_Log', 'U') IS NOT NULL
    BEGIN
        DELETE FROM App_Audit_Log;
        PRINT '   App_Audit_Log:                   ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

        IF OBJECTPROPERTY(OBJECT_ID('App_Audit_Log'), 'TableHasIdentity') = 1
            DBCC CHECKIDENT ('App_Audit_Log', RESEED, 0) WITH NO_INFOMSGS;
    END

    -- Historial de versiones de equipos (versionado interno, no es transaccional)
    -- ⚠️ Si quieres conservar el versionado de equipos del catálogo, NO descomentes:
    -- IF OBJECT_ID('mae_equipo_historial', 'U') IS NOT NULL
    --     DELETE FROM mae_equipo_historial;
    -- PRINT '   mae_equipo_historial:            ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas eliminadas';

    COMMIT;
    PRINT '✅ Bloque 7 OK';
END TRY
BEGIN CATCH
    ROLLBACK;
    PRINT '❌ ERROR Bloque 7: ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO

-- =============================================================================
-- VERIFICACIÓN FINAL — contadores
-- =============================================================================
PRINT '';
PRINT '═══════════════════════════════════════════════════════════════════════';
PRINT 'VERIFICACIÓN — todas estas deben quedar en 0:';
PRINT '═══════════════════════════════════════════════════════════════════════';

SELECT 'App_Ma_FichaIngresoServicio_ENC'  AS tabla, COUNT(*) AS filas FROM App_Ma_FichaIngresoServicio_ENC
UNION ALL SELECT 'App_Ma_FichaIngresoServicio_DET', COUNT(*) FROM App_Ma_FichaIngresoServicio_DET
UNION ALL SELECT 'App_Ma_Agenda_MUESTREOS',         COUNT(*) FROM App_Ma_Agenda_MUESTREOS
UNION ALL SELECT 'App_Ma_Equipos_MUESTREOS',        COUNT(*) FROM App_Ma_Equipos_MUESTREOS
UNION ALL SELECT 'mae_ficha_historial',             COUNT(*) FROM mae_ficha_historial
UNION ALL SELECT 'mae_rutas_planificadas',          COUNT(*) FROM mae_rutas_planificadas
UNION ALL SELECT 'mae_rutas_planificadas_detalle',  COUNT(*) FROM mae_rutas_planificadas_detalle
UNION ALL SELECT 'mae_rutas_ejecuciones',           COUNT(*) FROM mae_rutas_ejecuciones
UNION ALL SELECT 'mae_rutas_ejecuciones_detalle',   COUNT(*) FROM mae_rutas_ejecuciones_detalle
UNION ALL SELECT 'mae_solicitud',                   COUNT(*) FROM mae_solicitud
UNION ALL SELECT 'mae_solicitud_adjunto',           COUNT(*) FROM mae_solicitud_adjunto
UNION ALL SELECT 'mae_solicitud_comentario',        COUNT(*) FROM mae_solicitud_comentario
UNION ALL SELECT 'mae_solicitud_derivacion',        COUNT(*) FROM mae_solicitud_derivacion
UNION ALL SELECT 'mae_solicitud_historial',         COUNT(*) FROM mae_solicitud_historial
UNION ALL SELECT 'mae_chat_conversacion',           COUNT(*) FROM mae_chat_conversacion
UNION ALL SELECT 'mae_chat_mensaje',                COUNT(*) FROM mae_chat_mensaje
UNION ALL SELECT 'rel_chat_participante',           COUNT(*) FROM rel_chat_participante
UNION ALL SELECT 'mae_notificacion',                COUNT(*) FROM mae_notificacion
UNION ALL SELECT 'mae_login_attempts',              COUNT(*) FROM mae_login_attempts
UNION ALL SELECT 'mae_password_reset_tokens',       COUNT(*) FROM mae_password_reset_tokens
UNION ALL SELECT 'App_Audit_Log',                   COUNT(*) FROM App_Audit_Log
ORDER BY tabla;
GO

PRINT '';
PRINT '═══════════════════════════════════════════════════════════════════════';
PRINT 'MAESTROS PRESERVADOS — estos NO se tocaron:';
PRINT '═══════════════════════════════════════════════════════════════════════';

SELECT 'mae_usuario'                AS maestro, COUNT(*) AS filas FROM mae_usuario
UNION ALL SELECT 'mae_rol',                     COUNT(*) FROM mae_rol
UNION ALL SELECT 'mae_permiso',                 COUNT(*) FROM mae_permiso
UNION ALL SELECT 'rel_usuario_rol',             COUNT(*) FROM rel_usuario_rol
UNION ALL SELECT 'rel_rol_permiso',             COUNT(*) FROM rel_rol_permiso
UNION ALL SELECT 'mae_empresa',                 COUNT(*) FROM mae_empresa
UNION ALL SELECT 'mae_empresaservicios',        COUNT(*) FROM mae_empresaservicios
UNION ALL SELECT 'mae_centro',                  COUNT(*) FROM mae_centro
UNION ALL SELECT 'mae_contacto',                COUNT(*) FROM mae_contacto
UNION ALL SELECT 'mae_cargo',                   COUNT(*) FROM mae_cargo
UNION ALL SELECT 'mae_muestreador',             COUNT(*) FROM mae_muestreador
UNION ALL SELECT 'mae_equipo',                  COUNT(*) FROM mae_equipo
UNION ALL SELECT 'mae_normativa',               COUNT(*) FROM mae_normativa
UNION ALL SELECT 'mae_referenciaanalisis',      COUNT(*) FROM mae_referenciaanalisis
UNION ALL SELECT 'mae_laboratorioensayo',       COUNT(*) FROM mae_laboratorioensayo
UNION ALL SELECT 'mae_grupos_rutas',            COUNT(*) FROM mae_grupos_rutas
ORDER BY maestro;
GO

PRINT '';
PRINT '═══════════════════════════════════════════════════════════════════════';
PRINT 'LIMPIEZA COMPLETADA — ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '═══════════════════════════════════════════════════════════════════════';
PRINT '';
PRINT 'PRÓXIMOS PASOS:';
PRINT '  1. Verificar contadores arriba — los transaccionales deben quedar en 0';
PRINT '  2. Limpiar archivos físicos huérfanos en disco (ver sección al pie de este script)';
PRINT '  3. Reiniciar el backend';
PRINT '  4. Todos los usuarios deben volver a hacer login (sus JWTs viejos quedaron inválidos)';
PRINT '  5. Listo para producción.';
GO

-- =============================================================================
-- ANEXO A — LIMPIEZA DE ARCHIVOS FÍSICOS EN DISCO (no es SQL)
-- -----------------------------------------------------------------------------
-- El borrado de filas de adjuntos (chat, solicitudes, fichas) NO elimina los
-- archivos del disco. Quedan huérfanos y hay que limpiarlos aparte.
--
-- ⚠️ BORRAR el CONTENIDO de estas carpetas, NO las carpetas en sí.
-- ✅ NO tocar: uploads/avatars  (avatares del sistema, viven en el repo)
--
-- PowerShell (ajustar las rutas a las del .env del equipo):
--
--   # Adjuntos de usuarios (UPLOAD_PATH)
--   Get-ChildItem 'C:\Users\vremolcoy\Documents\uploads\chat'         -File -Recurse | Remove-Item -Force
--   Get-ChildItem 'C:\Users\vremolcoy\Documents\uploads\solicitudes'  -File -Recurse | Remove-Item -Force
--   Get-ChildItem 'C:\Users\vremolcoy\Documents\uploads\muestreadores'-File -Recurse | Remove-Item -Force
--
--   # Fotos de terreno (RUTA_FOTOS) — borra subcarpetas por frecuencia, deja la raíz
--   Get-ChildItem 'C:\Users\vremolcoy\Documents\FOTOS APP' -Directory | Remove-Item -Recurse -Force
--
--   # Archivos de prueba sueltos dentro del repo (NO borrar la subcarpeta avatars/)
--   Get-ChildItem 'api-backend-adlone\uploads' -File | Where-Object { $_.Name -like 'archivo-*' } | Remove-Item -Force
--
-- =============================================================================
-- ANEXO B — CARPETAS EXTERNAS A RECREAR AL MIGRAR A OTRO EQUIPO
-- -----------------------------------------------------------------------------
-- Estas carpetas viven FUERA del repo y se configuran por .env. En el equipo
-- nuevo hay que crearlas y apuntar el .env del backend a ellas. El backend crea
-- solo las subcarpetas (chat, solicitudes, muestreadores) la primera vez.
--
--   UPLOAD_PATH         → archivos subidos por usuarios   (URL /uploads)
--                         subcarpetas: chat/ , solicitudes/ , muestreadores/
--   RUTA_FOTOS          → fotos de terreno por frecuencia  (URL /fotos)
--   PROFILE_PICS_PATH   → fotos de perfil (recomendado setearla; URL /uploads/profile_pics)
--
-- Los AVATARES del sistema (uploads/avatars/avatar1-6.png) viajan con el repo
-- en git y se sirven desde ahí → NO requieren copia manual ni configuración.
-- =============================================================================
