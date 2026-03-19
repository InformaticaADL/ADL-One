-- CONFIGURACIÓN DE PLANTILLAS PREMIUM PERSONALIZADAS (URS FINAL - VERSIÓN POR FORMULARIO)
-- Este script configura diseños únicos para cada tipo de solicitud y sus variantes específicas.

BEGIN TRANSACTION;
BEGIN TRY

    -- 1. BASE COMÚN (Header y Footer estructurados con Author Info arriba)
    DECLARE @HEAD_HTML NVARCHAR(MAX) = N'<!DOCTYPE html><html><head><meta charset="UTF-8"><style type="text/css">body{margin:0;padding:0;background-color:#f0f8ff!important;font-family:''Segoe UI'',Tahoma,Geneva,Verdana,sans-serif}table{border-spacing:0;border-collapse:collapse}td{padding:0}</style></head><body style="margin:0;padding:0;background-color:#f0f8ff;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f0f8ff;width:100%;"><tr><td align="center" style="padding:40px 0;"><table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,98,168,0.15);border:1px solid #dbeafe;"><thead><tr><td style="background-color:#ffffff;padding:20px 40px;border-bottom:6px solid #0062a8;"><img src="{LOGO_BASE64}" alt="ADL ONE" width="240" style="display:block;width:240px;max-width:240px;height:auto;border:0;"></td></tr></thead><tbody><tr><td style="padding:40px;"><h2 style="margin:0 0 5px 0;color:#0062a8;font-family:Arial,sans-serif;font-size:22px;font-weight:700;">{TITULO_CORREO}</h2><p style="margin:0 0 25px 0;color:#5c8ab9;font-family:Arial,sans-serif;font-size:18px;">Notificación Nº: <strong style="color:#ff8c00;font-size:24px;">{CORRELATIVO}</strong></p><table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top:1px solid #e6f2ff;padding-top:20px;margin-bottom:20px;"><tr><td width="140" style="padding:2px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">{LABEL_SOLICITANTE}:</td><td style="padding:2px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{USUARIO}</td></tr><tr><td style="padding:2px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Fecha:</td><td style="padding:2px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{FECHA}</td></tr><tr><td style="padding:2px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Hora:</td><td style="padding:2px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{HORA}</td></tr></table>';
    DECLARE @FOOT_HTML NVARCHAR(MAX) = N'<div style="margin-top:30px;padding:15px;background-color:#fffbf5;border-left:4px solid #ff8c00;color:#666666;font-size:14px;font-family:Arial,sans-serif;"><strong>{ETIQUETA_OBSERVACION}:</strong><br>{OBSERVACION}</div></td></tr><tr><td style="padding:25px 40px;background-color:#f8fafc;border-top:1px solid #dbeafe;"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="left" valign="top" style="padding-right:20px;"><strong style="color:#0062a8;font-size:13px;font-family:Arial,sans-serif;display:block;margin-bottom:4px;">ADL Diagnostic Chile SpA</strong><div style="color:#64748b;font-size:11px;line-height:1.4;font-family:Arial,sans-serif;">Laboratorio de Diagnóstico y Biotecnología<br>Sector La Vara s/n, Camino a Alerce, Puerto Montt<br><a href="http://www.adldiagnostic.cl" style="color:#0062a8;text-decoration:none;">www.adldiagnostic.cl</a></div></td><td align="right" valign="top" style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;white-space:nowrap;">Sistema de Gestión<br><strong style="color:#0062a8;">Empresarial</strong></td></tr></table></td></tr></tbody></table></td></tr></table></body></html>';

    -- 2. LISTADO DE EVENTOS CON DETALLE PERSONALIZADO
    DECLARE @Eventos TABLE (codigo VARCHAR(50), descrip VARCHAR(100), detalle_html NVARCHAR(MAX));
    
    INSERT INTO @Eventos (codigo, descrip, detalle_html) VALUES 
    -- Baja de Equipo (Dinamizado por EquipoTraspasoForm/EquipoBajaForm)
    ('SOL_EQUIPO_BAJA_NUEVA', 'Nueva Solicitud de Baja de Equipo', 
     N'<div style="padding:15px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><h4 style="margin:0 0 10px 0;color:#dc3545;font-size:15px;">Información de la baja:</h4><div style="font-size:14px;color:#1e293b;"><strong>Equipo:</strong> <span style="color:#0062a8;font-weight:bold;">{nombre_equipo_full}</span><br><strong>Motivo Reportado:</strong> {motivo}</div></div>'),
    
    -- Traspaso VARIANTES (Dinamizado por EquipoTraspasoForm)
    ('SOL_TRASPASO_SEDE_NUEVA', 'Nueva Solicitud: Traspaso de Sede', 
     N'<div style="padding:15px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><h4 style="margin:0 0 10px 0;color:#0062a8;font-size:15px;">Cambio de Ubicación Física:</h4><div style="font-size:14px;color:#1e293b;margin-bottom:10px;"><strong>Equipo:</strong> <span style="color:#0062a8;font-weight:bold;">{nombre_equipo_full}</span></div><div style="font-size:14px;color:#1e293b;"><strong>Sede actual:</strong> {sede_actual} <span style="margin:0 10px;color:#94a3b8;">&rarr;</span> <strong>Sede nueva:</strong> <span style="color:#ff8c00;font-weight:bold;">{nombre_centro_destino}</span></div></div>'),
    
    ('SOL_TRASPASO_MUESTREADOR_NUEVA', 'Nueva Solicitud: Traspaso de Responsable', 
     N'<div style="padding:15px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><h4 style="margin:0 0 10px 0;color:#0062a8;font-size:15px;">Cambio de Custodia Legal:</h4><div style="font-size:14px;color:#1e293b;margin-bottom:10px;"><strong>Equipo:</strong> <span style="color:#0062a8;font-weight:bold;">{nombre_equipo_full}</span></div><div style="font-size:14px;color:#1e293b;"><strong>Responsable actual:</strong> {responsable_actual} <span style="margin:0 10px;color:#94a3b8;">&rarr;</span> <strong>Responsable nuevo:</strong> <span style="color:#ff8c00;font-weight:bold;">{nombre_muestreador_destino}</span></div></div>'),
    
    ('SOL_TRASPASO_AMBOS_NUEVA', 'Nueva Solicitud: Traspaso de Sede y Responsable', 
     N'<div style="padding:15px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><h4 style="margin:0 0 10px 0;color:#0062a8;font-size:15px;">Reasignación Integral:</h4><div style="font-size:14px;color:#1e293b;margin-bottom:10px;"><strong>Equipo:</strong> <span style="color:#0062a8;font-weight:bold;">{nombre_equipo_full}</span></div><div style="font-size:14px;color:#1e293b;margin-bottom:8px;"><strong>Sede actual:</strong> {sede_actual} <span style="margin:0 10px;color:#94a3b8;">&rarr;</span> <strong>Sede nueva:</strong> <span style="color:#ff8c00;font-weight:bold;">{nombre_centro_destino}</span></div><div style="font-size:14px;color:#1e293b;"><strong>Responsable actual:</strong> {responsable_actual} <span style="margin:0 10px;color:#94a3b8;">&rarr;</span> <strong>Responsable nuevo:</strong> <span style="color:#ff8c00;font-weight:bold;">{nombre_muestreador_destino}</span></div></div>'),
    
    -- Deshabilitar (Dinamizado por MuestreadorDeactivationForm)
    ('SOL_DESHABILITAR_MUESTREADOR_NUEVA', 'Nueva Solicitud: Deshabilitar Muestreador', 
     N'<div style="padding:15px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><h4 style="margin:0 0 10px 0;color:#dc3545;font-size:15px;">Plan de Desactivación:</h4><div style="font-size:14px;color:#1e293b;"><strong>Muestreador Origen:</strong> <span style="color:#0062a8;font-weight:bold;">{muestreador_origen_nombre}</span><br><strong>Esquema de Traspaso:</strong> {tipo_traspaso}<br><strong>Asignación Destino:</strong> {muestreador_destino_nombre}{base_destino}</div></div>'),

    -- Activación de Equipo
    ('SOL_EQUIPO_ALTA_NUEVA', 'Nueva Solicitud: Activación de Equipo', 
     N'<div style="padding:15px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><h4 style="margin:0 0 10px 0;color:#0062a8;font-size:15px;">Detalle de Activación:</h4><div style="font-size:14px;color:#1e293b;"><strong>Equipo:</strong> <span style="color:#0062a8;font-weight:bold;">{nombre_equipo} ({tipo_equipo})</span><br><strong>Sede:</strong> {nombre_centro}<br><strong>Responsable Asignado:</strong> {nombre_responsable}</div></div>'),

    -- Nuevo Equipo (Adquisición)
    ('SOL_EQUIPO_NUEVO_EQUIPO_NUEVA', 'Nueva Solicitud: Registro de Nuevo Equipo', 
     N'<div style="padding:15px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><h4 style="margin:0 0 10px 0;color:#0062a8;font-size:15px;">Información de Adquisición:</h4><div style="font-size:14px;color:#1e293b;"><strong>Equipo Solicitado:</strong> <span style="color:#0062a8;font-weight:bold;">{nombre_equipo} ({tipo_equipo})</span><br><strong>Marca y Modelo:</strong> {marca} {modelo}<br><strong>Número Serie:</strong> {serie}<br><strong>Fecha Estimada:</strong> {fecha_adquisicion}</div></div>'),

    --## Plantillas Restantes (Activación, Nuevo, Reporte)
    -- - [x] Configurar disparadores de eventos restantes en `UrsService.js` (Backend)
    -- - [x] Configurar `SOL_EQUIPO_ALTA_NUEVA` en SQL (DB)
    -- - [x] Configurar `SOL_EQUIPO_NUEVO_EQUIPO_NUEVA` en SQL (DB)
    -- - [x] Configurar `SOL_EQUIPO_REPORTE_PROBLEMA_NUEVA` en SQL (DB)
    --
    -- **Estado Final: 100% Personalizado y Verificado (19/03/2026)**
    --
    -- # Rediseño de Navegación (Mantine UI)
    -- - [/] Planificar unificación de Header y Sidebar
    -- - [ ] Crear componente `Sidebar.tsx` con Mantine
    -- - [ ] Actualizar `MainLayout.tsx` con `AppShell`
    -- - [ ] Implementar módulos fijos (Perfil, Solicitudes, Notificaciones, Chat)
    -- - [ ] Implementar módulos dinámicos por permisos
    -- - [ ] Añadir sección de usuario inferior con Logout
    -- - [ ] Verificar responsividad y animaciones
    -- Reporte de Problema
    ('SOL_EQUIPO_REPORTE_PROBLEMA_NUEVA', 'Nueva Solicitud: Reporte de Problema Técnico', 
     N'<div style="padding:15px;background-color:#fff1f2;border:1px solid #fda4af;border-radius:8px;"><h4 style="margin:0 0 10px 0;color:#e11d48;font-size:15px;">Incidencia Reportada:</h4><div style="font-size:14px;color:#1e293b;"><strong>Fallo:</strong> <span style="color:#e11d48;font-weight:bold;">{asunto}</span><br><strong>Nivel de Gravedad:</strong> {gravedad}<br><strong>Categoría:</strong> {categoria_problema}<br><strong>Equipo Afectado:</strong> {nombre_equipo_afectado}</div></div>'),

    -- Fallback Genérico
    ('SOLICITUD_NUEVA', 'Nueva Solicitud (Genérica)', 
     N'<div style="padding:15px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><h4 style="margin:0 0 10px 0;color:#0062a8;font-size:15px;">Detalle de la Solicitud:</h4><div style="font-size:14px;color:#1e293b;">{EQUIPOS_DETALLE}</div></div>');

    -- 3. PROCESO DE ACTUALIZACIÓN / INSERCIÓN
    DECLARE @curCodigo VARCHAR(50), @curDesc VARCHAR(100), @curDetalle NVARCHAR(MAX);
    DECLARE cur CURSOR FOR SELECT codigo, descrip, detalle_html FROM @Eventos;
    OPEN cur;
    FETCH NEXT FROM cur INTO @curCodigo, @curDesc, @curDetalle;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM mae_evento_notificacion WHERE codigo_evento = @curCodigo)
        BEGIN
            INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, cuerpo_template_html, modulo, es_transaccional)
            VALUES (@curCodigo, @curDesc, N'ADL ONE: {TITULO_CORREO} {CORRELATIVO}', @HEAD_HTML + @curDetalle + @FOOT_HTML, 'URS', 1);
        END
        ELSE
        BEGIN
            UPDATE mae_evento_notificacion 
            SET cuerpo_template_html = @HEAD_HTML + @curDetalle + @FOOT_HTML,
                asunto_template = N'ADL ONE: {TITULO_CORREO} {CORRELATIVO}'
            WHERE codigo_evento = @curCodigo;
        END
        FETCH NEXT FROM cur INTO @curCodigo, @curDesc, @curDetalle;
    END
    CLOSE cur;
    DEALLOCATE cur;

    COMMIT TRANSACTION;
    PRINT 'Unificación Global y Personalización de Plantillas (v3.0) finalizada con éxito.';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @ErrorMsg NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT 'Error en configuración de plantillas: ' + @ErrorMsg;
END CATCH
GO
