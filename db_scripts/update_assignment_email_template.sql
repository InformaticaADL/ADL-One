-- =============================================
-- Script: Update FICHA_ASIGNADA Email Template
-- Description: Enhanced template with detailed service information
-- Date: 2026-02-06
-- =============================================

USE PruebasInformatica;
GO

-- Update the FICHA_ASIGNADA template with enhanced design
UPDATE mae_evento_notificacion
SET 
    asunto_template = 'Ficha Asignada - Nº {CORRELATIVO}',
    cuerpo_template_html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style type="text/css">body{margin:0;padding:0;background-color:#f0f8ff!important;font-family:''Segoe UI'',Tahoma,Geneva,Verdana,sans-serif}table{border-spacing:0;border-collapse:collapse}td{padding:0}</style></head><body style="margin:0;padding:0;background-color:#f0f8ff;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f0f8ff;width:100%;"><tr><td align="center" style="padding:40px 0;"><table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,98,168,0.15);border:1px solid #dbeafe;"><thead><tr><td style="background-color:#ffffff;padding:20px 40px;border-bottom:6px solid #0062a8;"><img src="{LOGO_BASE64}" alt="ADL ONE" width="240" style="display:block;width:240px;max-width:240px;height:auto;border:0;"></td></tr></thead><tbody><tr><td style="padding:40px;"><h2 style="margin:0 0 5px 0;color:#0062a8;font-family:Arial,sans-serif;font-size:22px;font-weight:700;">Ficha Asignada por el Área Coordinación</h2><p style="margin:0 0 10px 0;color:#5c8ab9;font-family:Arial,sans-serif;font-size:18px;">Ficha Nº: <strong style="color:#ff8c00;font-size:24px;">{CORRELATIVO}</strong></p><p style="margin:0 0 25px 0;color:#333;font-family:Arial,sans-serif;font-size:14px;">Tipo de ficha: <strong style="color:#0062a8;">{TIPO_FRECUENCIA}, {TOTAL_SERVICIOS} servicios</strong></p><div style="margin:20px 0;padding:15px;background:#f8fafc;border-radius:8px;">{SERVICIOS_DETALLE}</div><hr style="border:none;border-top:2px solid #dbeafe;margin:25px 0;"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td width="140" style="padding:8px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Asignada por:</td><td style="padding:8px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{ASIGNADO_POR}</td></tr><tr><td style="padding:8px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Fecha Asignación:</td><td style="padding:8px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{FECHA}</td></tr><tr><td style="padding:8px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Hora Asignación:</td><td style="padding:8px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{HORA_ASIGNACION}</td></tr></table></td></tr><tr><td style="padding:25px 40px;background-color:#f8fafc;border-top:1px solid #dbeafe;"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="left" valign="top" style="padding-right:20px;"><strong style="color:#0062a8;font-size:13px;font-family:Arial,sans-serif;display:block;margin-bottom:4px;">ADL Diagnostic Chile SpA</strong><div style="color:#64748b;font-size:11px;line-height:1.4;font-family:Arial,sans-serif;">Laboratorio de Diagnóstico y Biotecnología<br>Sector La Vara s/n Camino a Alerce, Puerto Montt<br>Tel/fax: (56 65) 2250292 - 2250234 – 2250287<br><a href="http://www.adldiagnostic.cl" style="color:#0062a8;text-decoration:none;">www.adldiagnostic.cl</a></div></td><td align="right" valign="top" style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;white-space:nowrap;">Sistema de Gestión<br><strong style="color:#0062a8;">Empresarial</strong></td></tr></table></td></tr></tbody></table></td></tr></table></body></html>'
WHERE id_evento = 6 AND codigo_evento = 'FICHA_ASIGNADA';
GO

-- Verify the update
SELECT 
    id_evento,
    codigo_evento,
    asunto_template,
    LEFT(cuerpo_template_html, 200) as template_preview
FROM mae_evento_notificacion
WHERE codigo_evento = 'FICHA_ASIGNADA';
GO

PRINT 'Template FICHA_ASIGNADA actualizado exitosamente.';
GO
