-- Aplicar Plantilla Premium ADL ONE Fase 27 (Diseño "Perfecto" solicitado por el usuario)
-- Características: UTF-8, Logo Base64, Diseño Limpio, Sin bloques innecesarios.

BEGIN TRANSACTION;

DECLARE @HTML_TEMPLATE NVARCHAR(MAX) = N'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style type="text/css">
        body { margin: 0; padding: 0; background-color: #f0f8ff !important; font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; }
        table { border-spacing: 0; border-collapse: collapse; }
        td { padding: 0; }
        .main-container { background-color: #ffffff; max-width: 600px; width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,98,168,0.15); border: 1px solid #dbeafe; }
        .header { background-color: #ffffff; padding: 25px 0; text-align: center; border-bottom: 2px solid #f0f4f8; }
        .logo { max-height: 45px; vertical-align: middle; }
        .banner { background-color: #0062a8; padding: 20px; text-align: center; color: #ffffff; }
        .banner h1 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
        .content { padding: 35px 30px; line-height: 1.6; color: #334155; }
        .request-id { color: #f97316; font-size: 24px; font-weight: 800; margin: 10px 0; display: block; }
        .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0; }
        .info-line { margin-bottom: 8px; font-size: 14px; }
        .info-label { color: #64748b; font-weight: 600; width: 120px; display: inline-block; }
        .info-value { color: #0f172a; font-weight: 500; }
        .footer { background-color: #f8fafc; color: #64748b; padding: 25px; text-align: center; font-size: 12px; border-top: 1px solid #e2e8f0; }
        .button { background-color: #0062a8; color: #ffffff !important; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,98,168,0.2); }
        .highlight { color: #0062a8; font-weight: 700; }
    </style>
</head>
<body style="margin:0; padding:0; background-color:#f0f8ff;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f0f8ff;">
        <tr>
            <td align="center" style="padding: 40px 10px;">
                <table role="presentation" class="main-container" border="0" cellspacing="0" cellpadding="0">
                    <!-- Header -->
                    <tr>
                        <td class="header">
                            <img src="{LOGO_URL}" alt="ADL ONE" class="logo">
                        </td>
                    </tr>
                    <!-- Banner -->
                    <tr>
                        <td class="banner">
                            <h1>{TITULO_CORREO}</h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td class="content">
                            <p style="margin: 0;">Estimado(a),</p>
                            <p>Se ha registrado una actividad en el sistema referente a la siguiente solicitud:</p>
                            
                            <span class="request-id">#{CORRELATIVO}</span>
                            <div style="font-size: 16px; margin-bottom: 20px;">
                                <span class="highlight">{TIPO_SOLICITUD}</span>
                            </div>

                            {BLOQUE_OBSERVACION|{ETIQUETA_OBSERVACION}}

                            <div class="info-card">
                                <div class="info-line">
                                    <span class="info-label">{LABEL_SOLICITANTE}:</span>
                                    <span class="info-value">{USUARIO}</span>
                                </div>
                                <div class="info-line">
                                    <span class="info-label">Fecha:</span>
                                    <span class="info-value">{FECHA}</span>
                                </div>
                                <div class="info-line">
                                    <span class="info-label">Hora:</span>
                                    <span class="info-value">{HORA}</span>
                                </div>
                            </div>

                            <p style="margin-top: 25px;">Para más detalles o gestionar esta solicitud, haga clic en el siguiente botón:</p>
                            
                            <div style="text-align: center; margin-top: 25px;">
                                <a href="{APP_URL}" class="button">IR A LA PLATAFORMA</a>
                            </div>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td class="footer">
                            <div style="margin-bottom: 5px; font-weight: bold; color: #0062a8;">ADL Diagnostic Chile SpA</div>
                            <div style="margin-bottom: 5px;">Este es un mensaje automático, por favor no responda a este correo.</div>
                            <div>© 2026 ADL ONE - Sistema de Gestión Empresarial</div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>';

-- Actualizar los eventos principales de URS
UPDATE mae_evento_notificacion 
SET asunto_template = N'ADL ONE - Notificación: {CORRELATIVO} - {TIPO_SOLICITUD}', 
    cuerpo_template_html = @HTML_TEMPLATE 
WHERE codigo_evento IN (N'SOLICITUD_NUEVA', N'SOLICITUD_ESTADO_CAMBIO', N'SOLICITUD_COMENTARIO_NUEVO', N'SOLICITUD_DERIVACION');

-- También para Equipos (Baja)
UPDATE mae_evento_notificacion 
SET asunto_template = N'ADL ONE - Solicitud Equipos: {CORRELATIVO}', 
    cuerpo_template_html = @HTML_TEMPLATE 
WHERE codigo_evento IN (N'SOL_EQUIPO_BAJA_NUEVA', N'SOL_EQUIPO_BAJA_APR', N'SOL_EQUIPO_BAJA_RECH');

COMMIT TRANSACTION;
PRINT 'Plantillas Fase 27 aplicadas con éxito.';
