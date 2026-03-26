import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT, 10),
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const HTML_CONTENT = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style type="text/css">body{margin:0;padding:0;background-color:#f0f8ff!important;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif}table{border-spacing:0;border-collapse:collapse}td{padding:0}</style></head><body style="margin:0;padding:0;background-color:#f0f8ff;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f0f8ff;width:100%;"><tr><td align="center" style="padding:40px 0;"><table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,98,168,0.15);border:1px solid #dbeafe;"><thead><tr><td style="background-color:#ffffff;padding:20px 40px;border-bottom:6px solid #eab308;"><img src="{LOGO_BASE64}" alt="ADL ONE" width="240" style="display:block;width:240px;max-width:240px;height:auto;border:0;"></td></tr></thead><tbody><tr><td style="padding:40px;"><h2 style="margin:0 0 5px 0;color:#eab308;font-family:Arial,sans-serif;font-size:22px;font-weight:700;">{TITULO_CORREO}</h2><p style="margin:0 0 25px 0;color:#5c8ab9;font-family:Arial,sans-serif;font-size:18px;">Notificación Nº: <strong style="color:#ff8c00;font-size:24px;">{CORRELATIVO}</strong></p><table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top:1px solid #e6f2ff;padding-top:20px;margin-bottom:20px;"><tr><td width="140" style="padding:2px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Acción por:</td><td style="padding:2px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{USUARIO}</td></tr><tr><td style="padding:2px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Fecha:</td><td style="padding:2px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{FECHA}</td></tr><tr><td style="padding:2px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Hora:</td><td style="padding:2px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{HORA}</td></tr></table>
<div style="padding:15px;background-color:#fffbf0;border:1px solid #fef3c7;border-radius:8px;">
    <h4 style="margin:0 0 10px 0;color:#92400e;font-size:15px;">Plan de Desvinculación de Equipo:</h4>
    <div style="font-size:14px;color:#1e293b;">
        <strong>Equipo:</strong> <span style="color:#0062a8;font-weight:bold;">{nombre_equipo_full}</span><br>
        <strong>Motivo:</strong> {motivo}<br>
        <strong>Fecha Efectiva:</strong> {fecha_baja}
    </div>
</div><div style="margin-top:30px;padding:15px;background-color:#fffbf5;border-left:4px solid #ff8c00;color:#666666;font-size:14px;font-family:Arial,sans-serif;"><strong>{ETIQUETA_OBSERVACION}:</strong><br>{OBSERVACION}</div></td></tr><tr><td style="padding:25px 40px;background-color:#f8fafc;border-top:1px solid #dbeafe;"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="left" valign="top" style="padding-right:20px;"><strong style="color:#0062a8;font-size:13px;font-family:Arial,sans-serif;display:block;margin-bottom:4px;">ADL Diagnostic Chile SpA</strong><div style="color:#64748b;font-size:11px;line-height:1.4;font-family:Arial,sans-serif;">Laboratorio de Diagnóstico y Biotecnología<br>Sector La Vara s/n, Camino a Alerce, Puerto Montt<br><a href="http://www.adldiagnostic.cl" style="color:#0062a8;text-decoration:none;">www.adldiagnostic.cl</a></div></td><td align="right" valign="top" style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;white-space:nowrap;">Sistema de Gestión<br><strong style="color:#0062a8;">Empresarial</strong></td></tr></table></td></tr></tbody></table></td></tr></table></body></html>`;

async function run() {
    try {
        let pool = await sql.connect(config);
        
        // Check if exists
        const check = await pool.request()
            .input('code', sql.VarChar(50), 'SOL_EQUIPO_BAJA_REV')
            .query("SELECT id_evento FROM mae_evento_notificacion WHERE codigo_evento = @code");
        
        if (check.recordset.length > 0) {
            console.log('Updating existing template SOL_EQUIPO_BAJA_REV...');
            await pool.request()
                .input('code', sql.VarChar(50), 'SOL_EQUIPO_BAJA_REV')
                .input('asunto', sql.VarChar(200), 'ADL ONE: Solicitud en Revisión {CORRELATIVO}')
                .input('html', sql.NVarChar(sql.MAX), HTML_CONTENT)
                .input('desc', sql.VarChar(200), 'Solicitud de Baja de Equipo marcada En Revisión')
                .query(`UPDATE mae_evento_notificacion SET asunto_template = @asunto, cuerpo_template_html = @html, descripcion = @desc WHERE codigo_evento = @code`);
        } else {
            console.log('Inserting new template SOL_EQUIPO_BAJA_REV...');
            await pool.request()
                .input('code', sql.VarChar(50), 'SOL_EQUIPO_BAJA_REV')
                .input('asunto', sql.VarChar(200), 'ADL ONE: Solicitud en Revisión {CORRELATIVO}')
                .input('html', sql.NVarChar(sql.MAX), HTML_CONTENT)
                .input('desc', sql.VarChar(200), 'Solicitud de Baja de Equipo marcada En Revisión')
                .query(`INSERT INTO mae_evento_notificacion (codigo_evento, asunto_template, cuerpo_template_html, modulo, es_transaccional, descripcion) 
                        VALUES (@code, @asunto, @html, 'URS', 1, @desc)`);
        }
        
        console.log('DONE!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
