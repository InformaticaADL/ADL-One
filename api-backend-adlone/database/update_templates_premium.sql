-- CONFIGURACIÓN DE PLANTILLAS PREMIUM PERSONALIZADAS (URS FINAL - VERSIÓN POR FORMULARIO)
-- Este script configura diseños únicos para cada tipo de solicitud y sus variantes específicas.

BEGIN TRANSACTION;
BEGIN TRY

    -- 1. BASE COMÚN (Header y Footer estructurados con Author Info)
    DECLARE @HEAD_HTML NVARCHAR(MAX) = N'<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style type="text/css">body{margin:0;padding:0;background-color:#f0f8ff!important;font-family:''Segoe UI'',Tahoma,Geneva,Verdana,sans-serif}table{border-spacing:0;border-collapse:collapse}td{padding:0}@media only screen and (max-width: 620px){.main-card{border-radius:0!important;border:none!important;width:100%!important;max-width:100%!important}.body-content{padding:30px 20px!important}.header{padding:20px 20px!important}.footer{padding:25px 20px!important}.footer-col-left,.footer-col-right{width:100%!important;max-width:100%!important;text-align:left!important;float:none!important;display:block!important}.footer-col-right{padding-top:16px!important}.footer-col-right td{text-align:left!important}}</style></head><body style="margin:0;padding:0;background-color:#f0f8ff;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f0f8ff;width:100%;"><tr><td align="center" style="padding:40px 0;"><!--[if mso]><table role="presentation" width="96%" align="center" style="width:96%;"><tr><td><![endif]--><table class="main-card" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;max-width:96%;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,98,168,0.15);border:1px solid #dbeafe;"><thead><tr><td style="background-color:#ffffff;padding:20px 40px;border-bottom:6px solid #0062a8;"><img src="{LOGO_BASE64}" alt="ADL ONE" width="240" style="display:block;width:240px;max-width:240px;height:auto;border:0;"></td></tr></thead><tbody><tr><td class="body-content" style="padding:40px;"><h2 style="margin:0 0 8px 0;color:#0062a8;font-family:Arial,sans-serif;font-size:22px;font-weight:700;">{TITULO_CORREO}</h2><table border="0" cellspacing="0" cellpadding="0" align="left" style="margin-bottom:25px;border-bottom:2px solid #0062a8;"><tr><td style="padding-bottom:6px;font-family:Arial,sans-serif;font-size:14px;font-weight:500;color:#64748b;">Notificación Nº: <strong style="color:#ff8c00;font-size:16px;font-family:Arial,sans-serif;font-weight:bold;">{CORRELATIVO}</strong></td></tr></table><div style="clear:both;height:1px;font-size:1px;line-height:1px;"></div><div style="color: #334155; font-size: 14px; line-height: 1.6; font-family: Arial, sans-serif;"><table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top:1px solid #e6f2ff;padding-top:20px;margin-bottom:20px;table-layout:fixed;"><tr><td width="30%" style="width:30%;padding:4px 16px 4px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;word-wrap:break-word;">{LABEL_SOLICITANTE}:</td><td style="width:70%;padding:4px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;word-wrap:break-word;">{USUARIO}</td></tr><tr><td style="padding:4px 16px 4px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Fecha:</td><td style="padding:4px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{FECHA}</td></tr><tr><td style="padding:4px 16px 4px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Hora:</td><td style="padding:4px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{HORA}</td></tr></table>';
    DECLARE @FOOT_HTML NVARCHAR(MAX) = N'</div><table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;margin-top:30px;font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px;background-color:#fffbf5;border-left:4px solid #ff8c00;border-radius:0 12px 12px 0;color:#666666;font-size:14px;line-height:1.6;"><strong>{ETIQUETA_OBSERVACION}:</strong><br>{OBSERVACION}</td></tr></table></td></tr><tr><td class="footer" style="padding:25px 40px;background-color:#f8fafc;border-top:1px solid #dbeafe;"><table width="100%" border="0" cellspacing="0" cellpadding="0" style="table-layout:fixed;width:100%;"><tr><td align="left" valign="top" style="width:70%;font-family:Arial,sans-serif;word-wrap:break-word;"><strong style="color:#0062a8;font-size:13px;font-family:Arial,sans-serif;display:block;margin-bottom:4px;letter-spacing:0.5px;text-transform:uppercase;">ADL Diagnostic Chile SpA</strong><div style="color:#64748b;font-size:11px;line-height:1.5;margin-top:4px;font-family:Arial,sans-serif;">Laboratorio de Diagnóstico y Biotecnología<br>Sector La Vara s/n, Camino a Alerce, Puerto Montt<br><a href="http://www.adldiagnostic.cl" style="color:#0062a8;text-decoration:none;font-weight:600;">www.adldiagnostic.cl</a></div></td><td align="right" valign="bottom" style="width:30%;font-family:Arial,sans-serif;color:#64748b;font-size:11px;line-height:1.5;text-align:right;word-wrap:break-word;">Sistema de Gestión<br><strong style="color:#0062a8;">Empresarial</strong></td></tr></table></td></tr></tbody></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>';

    -- 2. LISTADO DE EVENTOS CON DETALLE PERSONALIZADO
    DECLARE @Eventos TABLE (codigo VARCHAR(50), descrip VARCHAR(100), detalle_html NVARCHAR(MAX));
    
    INSERT INTO @Eventos (codigo, descrip, detalle_html) VALUES 
    -- Baja de Equipo (Dinamizado por EquipoTraspasoForm/EquipoBajaForm)
    ('SOL_EQUIPO_BAJA_NUEVA', 'Nueva Solicitud de Baja de Equipo', 
     N'<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; margin-bottom:24px; font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><h4 style="margin:0 0 12px 0; color:#dc3545; font-size:15px; font-weight:bold; font-family:Arial,sans-serif;">Información de la baja:</h4><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;"><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Equipo:</strong> <span style="color:#0062a8; font-weight:bold;">{nombre_equipo_full}</span></td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Motivo Reportado:</strong> {motivo}</td></tr></table></td></tr></table>'),
    
    -- Traspaso VARIANTES (Dinamizado por EquipoTraspasoForm)
    ('SOL_TRASPASO_SEDE_NUEVA', 'Nueva Solicitud: Traspaso de Sede', 
     N'<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; margin-bottom:24px; font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><h4 style="margin:0 0 12px 0; color:#0062a8; font-size:15px; font-weight:bold; font-family:Arial,sans-serif;">Cambio de Ubicación Física:</h4><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;"><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Equipo:</strong> <span style="color:#0062a8; font-weight:bold;">{nombre_equipo_full}</span></td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Sede actual:</strong> {sede_actual} <span style="margin:0 10px; color:#94a3b8;">&rarr;</span> <strong>Sede nueva:</strong> <span style="color:#ff8c00; font-weight:bold;">{nombre_centro_destino}</span></td></tr></table></td></tr></table>'),
    
    ('SOL_TRASPASO_MUESTREADOR_NUEVA', 'Nueva Solicitud: Traspaso de Responsable', 
     N'<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; margin-bottom:24px; font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><h4 style="margin:0 0 12px 0; color:#0062a8; font-size:15px; font-weight:bold; font-family:Arial,sans-serif;">Cambio de Custodia Legal:</h4><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;"><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Equipo:</strong> <span style="color:#0062a8; font-weight:bold;">{nombre_equipo_full}</span></td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Responsable actual:</strong> {responsable_actual} <span style="margin:0 10px; color:#94a3b8;">&rarr;</span> <strong>Responsable nuevo:</strong> <span style="color:#ff8c00; font-weight:bold;">{nombre_muestreador_destino}</span></td></tr></table></td></tr></table>'),
    
    ('SOL_TRASPASO_AMBOS_NUEVA', 'Nueva Solicitud: Traspaso de Sede y Responsable', 
     N'<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; margin-bottom:24px; font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><h4 style="margin:0 0 12px 0; color:#0062a8; font-size:15px; font-weight:bold; font-family:Arial,sans-serif;">Reasignación Integral:</h4><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;"><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Equipo:</strong> <span style="color:#0062a8; font-weight:bold;">{nombre_equipo_full}</span></td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Sede actual:</strong> {sede_actual} <span style="margin:0 10px; color:#94a3b8;">&rarr;</span> <strong>Sede nueva:</strong> <span style="color:#ff8c00; font-weight:bold;">{nombre_centro_destino}</span></td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Responsable actual:</strong> {responsable_actual} <span style="margin:0 10px; color:#94a3b8;">&rarr;</span> <strong>Responsable nuevo:</strong> <span style="color:#ff8c00; font-weight:bold;">{nombre_muestreador_destino}</span></td></tr></table></td></tr></table>'),
    
    -- Deshabilitar (Dinamizado por MuestreadorDeactivationForm)
    ('SOL_DESHABILITAR_MUESTREADOR_NUEVA', 'Nueva Solicitud: Deshabilitar Muestreador', 
     N'<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; margin-bottom:24px; font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><h4 style="margin:0 0 12px 0; color:#dc3545; font-size:15px; font-weight:bold; font-family:Arial,sans-serif;">Plan de Desactivación:</h4><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;"><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Muestreador Origen:</strong> <span style="color:#0062a8; font-weight:bold;">{muestreador_origen_nombre}</span></td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Esquema de Traspaso:</strong> {tipo_traspaso}</td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Asignación Destino:</strong> {muestreador_destino_nombre}{base_destino}</td></tr></table></td></tr></table>'),
 
     -- Activación de Equipo
     ('SOL_EQUIPO_ALTA_NUEVA', 'Nueva Solicitud: Activación de Equipo', 
      N'<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; margin-bottom:24px; font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><h4 style="margin:0 0 12px 0; color:#0062a8; font-size:15px; font-weight:bold; font-family:Arial,sans-serif;">Detalle de Activación:</h4><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;"><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Equipo:</strong> <span style="color:#0062a8; font-weight:bold;">{nombre_equipo} ({tipo_equipo})</span></td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Sede:</strong> {nombre_centro}</td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Responsable Asignado:</strong> {nombre_responsable}</td></tr></table></td></tr></table>'),
 
     -- Nuevo Equipo (Adquisición)
     ('SOL_EQUIPO_NUEVO_EQUIPO_NUEVA', 'Nueva Solicitud: Registro de Nuevo Equipo', 
      N'<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; margin-bottom:24px; font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><h4 style="margin:0 0 12px 0; color:#0062a8; font-size:15px; font-weight:bold; font-family:Arial,sans-serif;">Información de Adquisición:</h4><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;"><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Equipo Solicitado:</strong> <span style="color:#0062a8; font-weight:bold;">{nombre_equipo} ({tipo_equipo})</span></td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Marca y Modelo:</strong> {marca} {modelo}</td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Número Serie:</strong> {serie}</td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Fecha Estimada:</strong> {fecha_adquisicion}</td></tr></table></td></tr></table>'),

    --## Plantillas Restantes (Activación, Nuevo, Reporte)
    -- - [x] Configurar disparadores de eventos restantes en `UrsService.js` (Backend)
    -- - [x] Configurar `SOL_EQUIPO_ALTA_NUEVA` in SQL (DB)
    -- - [x] Configurar `SOL_EQUIPO_NUEVO_EQUIPO_NUEVA` in SQL (DB)
    -- - [x] Configurar `SOL_EQUIPO_REPORTE_PROBLEMA_NUEVA` in SQL (DB)
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
     N'<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; margin-bottom:24px; font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><h4 style="margin:0 0 12px 0; color:#e11d48; font-size:15px; font-weight:bold; font-family:Arial,sans-serif;">Incidencia Reportada:</h4><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;"><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Fallo:</strong> <span style="color:#e11d48; font-weight:bold;">{asunto}</span></td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Nivel de Gravedad:</strong> {gravedad}</td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Categoría:</strong> {categoria_problema}</td></tr><tr><td style="padding:4px 0; font-size:14px; color:#1e293b; font-family:Arial,sans-serif;"><strong>Equipo Afectado:</strong> {nombre_equipo_afectado}</td></tr></table></td></tr></table>'),

    -- Fallback Genérico
    ('SOLICITUD_NUEVA', 'Nueva Solicitud (Genérica)', 
     N'<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; margin-bottom:24px; font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><h4 style="margin:0 0 12px 0; color:#0062a8; font-size:15px; font-weight:bold; font-family:Arial,sans-serif;">Detalle de la Solicitud:</h4><div style="font-size:14px; color:#1e293b;">{EQUIPOS_DETALLE}</div></td></tr></table>'),

    -- Reprogramación: Solo Fecha
    ('FICHA_MUESTREO_REAGENDADO', 'Muestreo Reagendado (Fecha)', 
     N'<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; margin-bottom:24px; font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><h4 style="margin:0 0 12px 0; color:#ff8c00; font-size:15px; font-weight:bold; font-family:Arial,sans-serif;">Cambio de Fecha (Re-agendamiento):</h4><div style="font-size:14px; color:#1e293b;">{servicios_detalle}</div></td></tr></table>'),

    -- Reprogramación: Solo Muestreador
    ('FICHA_MUESTREO_REASIGNADO', 'Muestreo Reasignado (Muestreador)', 
     N'<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; margin-bottom:24px; font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><h4 style="margin:0 0 12px 0; color:#ff8c00; font-size:15px; font-weight:bold; font-family:Arial,sans-serif;">Cambio de Responsable (Re-asignación):</h4><div style="font-size:14px; color:#1e293b;">{servicios_detalle}</div></td></tr></table>'),

    -- Reprogramación: Fecha y Muestreador
    ('FICHA_MUESTREO_REAGENDADO_REASIGNADO', 'Muestreo Reagendado y Reasignado', 
     N'<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; margin-bottom:24px; font-family:Arial,sans-serif;"><tr><td style="padding:16px 20px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;"><h4 style="margin:0 0 12px 0; color:#ff8c00; font-size:15px; font-weight:bold; font-family:Arial,sans-serif;">Reprogramación Integral (Fecha y Responsable):</h4><div style="font-size:14px; color:#1e293b;">{servicios_detalle}</div></td></tr></table>');

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
