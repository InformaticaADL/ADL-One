
const { getConnection } = require('./src/config/database');
const sql = require('mssql');

const updateTemplatesV3 = async () => {
    try {
        const pool = await getConnection();
        console.log('✅ Conectado a SQL Server');

        const baseHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style type="text/css">body{margin:0;padding:0;background-color:#f0f8ff!important;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif}table{border-spacing:0;border-collapse:collapse}td{padding:0}</style></head><body style="margin:0;padding:0;background-color:#f0f8ff;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f0f8ff;width:100%;"><tr><td align="center" style="padding:40px 0;"><table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,98,168,0.15);border:1px solid #dbeafe;"><thead><tr><td style="background-color:#ffffff;padding:20px 40px;border-bottom:6px solid #0062a8;"><img src="{LOGO_BASE64}" alt="ADL ONE" width="240" style="display:block;width:240px;max-width:240px;height:auto;border:0;"></td></tr></thead><tbody><tr><td style="padding:40px;"><h2 style="margin:0 0 5px 0;color:#0062a8;font-family:Arial,sans-serif;font-size:22px;font-weight:700;">{TITULO}</h2><p style="margin:0 0 10px 0;color:#5c8ab9;font-family:Arial,sans-serif;font-size:18px;">Solicitud Nº: <strong style="color:#ff8c00;font-size:24px;">{CORRELATIVO}</strong></p><p style="margin:0 0 25px 0;color:#333;font-family:Arial,sans-serif;font-size:14px;">Tipo: <strong style="color:#0062a8;">{TIPO_SOLICITUD}</strong></p><div style="margin:20px 0;padding:15px;background:#f8fafc;border-radius:8px;">{EQUIPOS_DETALLE}</div><div style="margin-bottom: 20px; padding: 15px; background-color: #fff7ed; border-left: 4px solid #f97316; border-radius: 4px;"><strong style="color: #c2410c; font-size: 13px; display: block; margin-bottom: 4px;">OBSERVACIÓN / MOTIVO:</strong><span style="color: #431407; font-size: 14px; line-height: 1.5;">{OBSERVACION}</span></div><hr style="border:none;border-top:2px solid #dbeafe;margin:25px 0;"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td width="140" style="padding:8px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Generada por:</td><td style="padding:8px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{USUARIO}</td></tr><tr><td style="padding:8px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Fecha:</td><td style="padding:8px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{FECHA}</td></tr><tr><td style="padding:8px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Hora:</td><td style="padding:8px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{HORA}</td></tr></table></td></tr><tr><td style="padding:25px 40px;background-color:#f8fafc;border-top:1px solid #dbeafe;"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="left" valign="top" style="padding-right:20px;"><strong style="color:#0062a8;font-size:13px;font-family:Arial,sans-serif;display:block;margin-bottom:4px;">ADL Diagnostic Chile SpA</strong><div style="color:#64748b;font-size:11px;line-height:1.4;font-family:Arial,sans-serif;">Laboratorio de Diagnóstico y Biotecnología<br>Sector La Vara s/n Camino a Alerce, Puerto Montt<br>Tel/fax: (56 65) 2250292 - 2250234 – 2250287<br><a href="http://www.adldiagnostic.cl" style="color:#0062a8;text-decoration:none;">www.adldiagnostic.cl</a></div></td><td align="right" valign="top" style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;white-space:nowrap;">Sistema de Gestión<br><strong style="color:#0062a8;">Empresarial</strong></td></tr></table></td></tr></tbody></table></td></tr></table></body></html>`;

        const events = [
            // 1. Nueva Solicitud (Generic Title because type is dynamic in TIPO_SOLICITUD)
            { code: 'SOL_EQUIPO_NUEVA', title: 'Nueva Solicitud de Equipo', subject: 'Nueva Solicitud: {TIPO_SOLICITUD} - {USUARIO}' },

            // 2. Resultados Alta
            // Note: Use generic "Solicitud Aprobada/Rechazada" title, let TIPO_SOLICITUD specify "Registro..." vs "Activación..."
            { code: 'SOL_EQUIPO_ALTA_APR', title: 'Solicitud Aprobada', subject: 'Aprobado: {TIPO_SOLICITUD} - Solicitud #{CORRELATIVO}' },
            { code: 'SOL_EQUIPO_ALTA_RECH', title: 'Solicitud Rechazada', subject: 'Rechazado: {TIPO_SOLICITUD} - Solicitud #{CORRELATIVO}' },

            // 3. Resultados Baja
            { code: 'SOL_EQUIPO_BAJA_APR', title: 'Baja de Equipo Aprobada', subject: 'Aprobado: Baja de Equipo - Solicitud #{CORRELATIVO}' },
            { code: 'SOL_EQUIPO_BAJA_RECH', title: 'Baja de Equipo Rechazada', subject: 'Rechazado: Baja de Equipo - Solicitud #{CORRELATIVO}' },

            // 4. Resultados Traspaso
            { code: 'SOL_EQUIPO_TRASPASO_APR', title: 'Traspaso de Equipo Aprobado', subject: 'Aprobado: Traspaso de Equipo - Solicitud #{CORRELATIVO}' },
            { code: 'SOL_EQUIPO_TRASPASO_RECH', title: 'Traspaso de Equipo Rechazado', subject: 'Rechazado: Traspaso de Equipo - Solicitud #{CORRELATIVO}' },
            // 5. Old/Legacy codes just in case
            { code: 'EQUIPO_SOLICITUD_NUEVA', title: 'Nueva Solicitud de Equipo', subject: 'Nueva Solicitud: {TIPO_SOLICITUD}' },
            { code: 'EQUIPO_SOLICITUD_APROBADA', title: 'Solicitud Aprobada', subject: 'Solicitud Aprobada #{CORRELATIVO}' },
            { code: 'EQUIPO_SOLICITUD_RECHAZADA', title: 'Solicitud Rechazada', subject: 'Solicitud Rechazada #{CORRELATIVO}' }
        ];

        for (const event of events) {
            // Replace {TITULO} placeholder inside the HTML for this specific event
            // Note: We are embedding the specific title into the HTML template itself before saving
            // Wait, {TITULO} is dynamic if we leave it as placeholder, but here we want to set a default title structure?
            // Actually, the HTML template provided by user has {TITULO}, so we rely on backend passing 'TITULO' or we hardcode it here?
            // The notification service usually replaces placeholders based on context. 
            // BUT, the context passed from SolicitudService usually doesn't have 'TITULO'.
            // So we should probably bake the title into the HTML here, OR update SolicitudService to pass TITULO.
            // Let's look at `final_equipment_templates_fix.js` from previous turn. It used `REPLACE(..., '{TITULO}', ...)` in SQL.

            // Better approach: Replace {TITULO} with the actual title text for this event type right now.
            let specificHtml = baseHtml.replace('{TITULO}', event.title);

            await pool.request()
                .input('code', sql.VarChar(50), event.code)
                .input('subject', sql.VarChar(200), event.subject)
                .input('body', sql.NVarChar(sql.MAX), specificHtml)
                .query(`
                    UPDATE mae_evento_notificacion
                    SET asunto_template = @subject,
                        cuerpo_template_html = @body,
                        titulo_template = '${event.title}'
                    WHERE codigo_evento = @code
                `);

            console.log(`Updated ${event.code}`);
        }

        console.log('✅ All templates updated successfully with new design');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

updateTemplatesV3();
