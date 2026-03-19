-- ACTUALIZACIÓN DE PLANTILLAS EMAIL - FASE 26 (COMPLETA)
-- Mejoras: Diseño premium, Logo Base64 embebido, UTF-8 (N'), Asuntos dinámicos

DECLARE @NuevoHtml NVarChar(MAX) = N'<!DOCTYPE html><html><head><meta charset="UTF-8"><style type="text/css">body{margin:0;padding:0;background-color:#f0f8ff!important;font-family:''Segoe UI'',Tahoma,Geneva,Verdana,sans-serif}table{border-spacing:0;border-collapse:collapse}td{padding:0}</style></head><body style="margin:0;padding:0;background-color:#f0f8ff;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f0f8ff;width:100%;"><tr><td align="center" style="padding:40px 0;"><table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,98,168,0.15);border:1px solid #dbeafe;"><thead><tr><td style="background-color:#ffffff;padding:20px 40px;border-bottom:6px solid #0062a8;"><img src="{LOGO_BASE64}" alt="ADL ONE" width="240" style="display:block;width:240px;max-width:240px;height:auto;border:0;"></td></tr></thead><tbody><tr><td style="padding:40px;"><h2 style="margin:0 0 5px 0;color:#0062a8;font-family:Arial,sans-serif;font-size:22px;font-weight:700;">{TITULO_CORREO}</h2><p style="margin:0 0 25px 0;color:#5c8ab9;font-family:Arial,sans-serif;font-size:18px;">Ficha Nº: <strong style="color:#ff8c00;font-size:24px;">{CORRELATIVO}</strong></p><table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top:1px solid #e6f2ff;padding-top:20px;"><tr><td width="120" style="padding:4px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">{LABEL_SOLICITANTE}:</td><td style="padding:4px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{USUARIO}</td></tr><tr><td style="padding:4px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Fecha:</td><td style="padding:4px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{FECHA}</td></tr><tr><td style="padding:4px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Hora:</td><td style="padding:4px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{HORA}</td></tr></table><div style="margin-top:25px;padding:15px;background-color:#fffbf5;border-left:4px solid #ff8c00;color:#666666;font-size:14px;font-family:Arial,sans-serif;"><strong>{ETIQUETA_OBSERVACION}:</strong><br>{OBSERVACION}</div></td></tr><tr><td style="padding:25px 40px;background-color:#f8fafc;border-top:1px solid #dbeafe;"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="left" valign="top" style="padding-right:20px;"><strong style="color:#0062a8;font-size:13px;font-family:Arial,sans-serif;display:block;margin-bottom:4px;">ADL Diagnostic Chile SpA</strong><div style="color:#64748b;font-size:11px;line-height:1.4;font-family:Arial,sans-serif;">Laboratorio de Diagnóstico y Biotecnología<br>Sector La Vara s/n Camino a Alerce, Puerto Montt<br>Tel/fax: (56 65) 2250292 - 2250234 – 2250287<br><a href="http://www.adldiagnostic.cl" style="color:#0062a8;text-decoration:none;">www.adldiagnostic.cl</a></div></td><td align="right" valign="top" style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;white-space:nowrap;">Sistema de Gestión<br><strong style="color:#0062a8;">Empresarial</strong></td></tr></table></td></tr></tbody></table></td></tr></table></body></html>';

-- 1. Solicitudes URS
UPDATE mae_evento_notificacion SET asunto_template = N'Nueva Solicitud: {TIPO_SOLICITUD} #{CORRELATIVO}', cuerpo_template_html = @NuevoHtml WHERE codigo_evento = 'SOLICITUD_NUEVA';
UPDATE mae_evento_notificacion SET asunto_template = N'Actualización Solicitud {TIPO_SOLICITUD} #{CORRELATIVO}', cuerpo_template_html = @NuevoHtml WHERE codigo_evento = 'SOLICITUD_ESTADO_CAMBIO';
UPDATE mae_evento_notificacion SET asunto_template = N'Mensaje en Solicitud {TIPO_SOLICITUD} #{CORRELATIVO}', cuerpo_template_html = @NuevoHtml WHERE codigo_evento = 'SOLICITUD_COMENTARIO_NUEVO';
- [x] Phase 26: Refinamientos Finales de UX y Email
    - [x] Actualizar estado de lectura al hacer clic en solicitud (Frontend)
    - [x] Crear endpoint/método para marcar como leído todas las notificaciones de una referencia (Backend)
    - [x] Corregir lógica de supresión de emails de chat según configuración de administración
    - [x] Implementar nuevo diseño de Email con logo Base64 y espaciado ajustado
    - [x] Corregir problemas de codificación (UTF-8) en los textos de los emails
    - [x] Ajustar asunto de email para tipos específicos (ej: Deshabilitar Muestreador)

## Fase 27: Ajustes Finales y Robustez
- [ ] Alerta de éxito y redirección tras enviar solicitud (Frontend)
- [ ] Configurar carpeta y lógica de adjuntos (Backend)
- [ ] Corregir definitivamente supresión de email en chat (Backend)
- [ ] Actualización dinámica de bandeja de entrada (Frontend)
- [ ] Suprimir notificación web si el usuario ya está en el chat (Frontend)
- [ ] Evitar parpadeo/recarga de sección 2 al chatear (Frontend)
- [ ] Mostrar fecha y hora en bandeja de entrada (Frontend)
- [ ] Refinar texto de notificaciones web (quitar IDs) (Backend)
- [ ] Corregir codificación y formato de email (UTF-8, Logo, Espaciado) (Database/Backend)

-- 2. Solicitudes de Equipos (Baja)
UPDATE mae_evento_notificacion SET asunto_template = N'Nueva Solicitud Equipos: {TIPO_SOLICITUD} #{CORRELATIVO}', cuerpo_template_html = @NuevoHtml WHERE codigo_evento = 'SOL_EQUIPO_BAJA_NUEVA';
UPDATE mae_evento_notificacion SET asunto_template = N'Aprobación Solicitud Equipos: {TIPO_SOLICITUD} #{CORRELATIVO}', cuerpo_template_html = @NuevoHtml WHERE codigo_evento = 'SOL_EQUIPO_BAJA_APR';
UPDATE mae_evento_notificacion SET asunto_template = N'Rechazo Solicitud Equipos: {TIPO_SOLICITUD} #{CORRELATIVO}', cuerpo_template_html = @NuevoHtml WHERE codigo_evento = 'SOL_EQUIPO_BAJA_RECH';

GO
