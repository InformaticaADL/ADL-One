
import { getConnection } from './src/config/database.js';
import sql from 'mssql';

const baseTemplate = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style type="text/css">body{margin:0;padding:0;background-color:#f0f8ff!important;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif}table{border-spacing:0;border-collapse:collapse}td{padding:0}</style></head><body style="margin:0;padding:0;background-color:#f0f8ff;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f0f8ff;width:100%;"><tr><td align="center" style="padding:40px 0;"><table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,98,168,0.15);border:1px solid #dbeafe;"><thead><tr><td style="background-color:#ffffff;padding:20px 40px;border-bottom:6px solid #0062a8;"><img src="{LOGO_BASE64}" alt="ADL ONE" width="240" style="display:block;width:240px;max-width:240px;height:auto;border:0;"></td></tr></thead><tbody><tr><td style="padding:40px;"><h2 style="margin:0 0 5px 0;color:#0062a8;font-family:Arial,sans-serif;font-size:22px;font-weight:700;">{TITULO}</h2><p style="margin:0 0 25px 0;color:#5c8ab9;font-family:Arial,sans-serif;font-size:18px;">{SUBTITULO}: <strong style="color:#ff8c00;font-size:24px;">{CORRELATIVO}</strong></p>
<div style="margin-top:20px; border-top: 1px solid #e6f2ff; padding-top: 20px;">
    {EQUIPOS_DETALLE}
</div>
<div style="margin-top:30px;padding:15px;background-color:#fffbf5;border-left:4px solid #0062a8;color:#666666;font-size:14px;font-family:Arial,sans-serif;"><strong>{ETIQUETA_OBS}:</strong><br>{OBSERVACION}</div>
<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top:20px;border-top:1px solid #e6f2ff;padding-top:20px;"><tr><td style="padding:4px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">{ETIQUETA_USUARIO}: <span style="color:#333333;font-weight:normal;">{USUARIO}</span></td></tr><tr><td style="padding:4px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Fecha de solicitud: <span style="color:#333333;font-weight:normal;">{FECHA}</span></td></tr><tr><td style="padding:4px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Hora de solicitud: <span style="color:#333333;font-weight:normal;">{HORA}</span></td></tr></table></td></tr><tr><td style="padding:25px 40px;background-color:#f8fafc;border-top:1px solid #dbeafe;"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="left" valign="top" style="padding-right:20px;"><strong style="color:#0062a8;font-size:13px;font-family:Arial,sans-serif;display:block;margin-bottom:4px;">ADL Diagnostic Chile SpA</strong><div style="color:#64748b;font-size:11px;line-height:1.4;font-family:Arial,sans-serif;">Laboratorio de Diagnóstico y Biotecnología<br>Sector La Vara s/n Camino a Alerce, Puerto Montt<br>Tel/fax: (56 65) 2250292 - 2250234 – 2250287<br><a href="http://www.adldiagnostic.cl" style="color:#0062a8;text-decoration:none;">www.adldiagnostic.cl</a></div></td><td align="right" valign="top" style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;white-space:nowrap;">Sistema de Gestión<br><strong style="color:#0062a8;">Empresarial</strong></td></tr></table></td></tr></tbody></table></td></tr></table></body></html>`;

const events = [
    {
        code: 'SOL_EQUIPO_NUEVA',
        description: 'Nueva Solicitud de Equipo (Admin)',
        subject: 'Nueva Solicitud de Equipo: {TIPO_SOLICITUD} - {CORRELATIVO}',
        titulo: 'Nueva Solicitud de {TIPO_SOLICITUD}',
        subtitulo: 'Solicitud Nº',
        etiqueta_usuario: 'Solicitado por',
        etiqueta_obs: 'Motivo de la Solicitud'
    },
    // ALTA
    {
        code: 'SOL_EQUIPO_ALTA_APR',
        description: 'Solicitud de Alta Aprobada',
        subject: 'Solicitud Aprobada: {TIPO_SOLICITUD} ACEPTADA',
        titulo: '¡Solicitud de {TIPO_SOLICITUD} Aprobada!',
        subtitulo: 'Equipo Nº',
        etiqueta_usuario: 'Aprobado por',
        etiqueta_obs: 'Comentarios del Revisor'
    },
    {
        code: 'SOL_EQUIPO_ALTA_RECH',
        description: 'Solicitud de Alta Rechazada',
        subject: 'Solicitud Rechazada: {TIPO_SOLICITUD} RECHAZADA',
        titulo: 'Solicitud de {TIPO_SOLICITUD} Rechazada',
        subtitulo: 'Solicitud Nº',
        etiqueta_usuario: 'Rechazado por',
        etiqueta_obs: 'Motivo del Rechazo'
    },
    // BAJA
    {
        code: 'SOL_EQUIPO_BAJA_APR',
        description: 'Solicitud de Baja Aprobada',
        subject: 'Solicitud Aprobada: {TIPO_SOLICITUD} ACEPTADA',
        titulo: '¡Solicitud de {TIPO_SOLICITUD} Aprobada!',
        subtitulo: 'Equipo Nº',
        etiqueta_usuario: 'Aprobado por',
        etiqueta_obs: 'Comentarios del Revisor'
    },
    {
        code: 'SOL_EQUIPO_BAJA_RECH',
        description: 'Solicitud de Baja Rechazada',
        subject: 'Solicitud Rechazada: {TIPO_SOLICITUD} RECHAZADA',
        titulo: 'Solicitud de {TIPO_SOLICITUD} Rechazada',
        subtitulo: 'Solicitud Nº',
        etiqueta_usuario: 'Rechazado por',
        etiqueta_obs: 'Motivo del Rechazo'
    },
    // TRASPASO
    {
        code: 'SOL_EQUIPO_TRASPASO_APR',
        description: 'Solicitud de Traspaso Aprobada',
        subject: 'Solicitud Aprobada: {TIPO_SOLICITUD} ACEPTADA',
        titulo: '¡Solicitud de {TIPO_SOLICITUD} Aprobada!',
        subtitulo: 'Equipo Nº',
        etiqueta_usuario: 'Aprobado por',
        etiqueta_obs: 'Comentarios del Revisor'
    },
    {
        code: 'SOL_EQUIPO_TRASPASO_RECH',
        description: 'Solicitud de Traspaso Rechazada',
        subject: 'Solicitud Rechazada: {TIPO_SOLICITUD} RECHAZADA',
        titulo: 'Solicitud de {TIPO_SOLICITUD} Rechazada',
        subtitulo: 'Solicitud Nº',
        etiqueta_usuario: 'Rechazado por',
        etiqueta_obs: 'Motivo del Rechazo'
    },
    // REACTIVACION
    {
        code: 'SOL_EQUIPO_REAC_APR',
        description: 'Solicitud de Reactivación Aprobada',
        subject: 'Solicitud Aprobada: {TIPO_SOLICITUD} ACEPTADA',
        titulo: '¡Solicitud de {TIPO_SOLICITUD} Aprobada!',
        subtitulo: 'Equipo Nº',
        etiqueta_usuario: 'Aprobado por',
        etiqueta_obs: 'Comentarios del Revisor'
    },
    {
        code: 'SOL_EQUIPO_REAC_RECH',
        description: 'Solicitud de Reactivación Rechazada',
        subject: 'Solicitud Rechazada: {TIPO_SOLICITUD} RECHAZADA',
        titulo: 'Solicitud de {TIPO_SOLICITUD} Rechazada',
        subtitulo: 'Solicitud Nº',
        etiqueta_usuario: 'Rechazado por',
        etiqueta_obs: 'Motivo del Rechazo'
    }
];

async function run() {
    try {
        const pool = await getConnection();
        console.log('Connected to database.');

        for (const ev of events) {
            let body = baseTemplate
                .replace('{TITULO}', ev.titulo)
                .replace('{SUBTITULO}', ev.subtitulo)
                .replace('{ETIQUETA_USUARIO}', ev.etiqueta_usuario)
                .replace('{ETIQUETA_OBS}', ev.etiqueta_obs);

            await pool.request()
                .input('code', sql.VarChar(50), ev.code)
                .input('desc', sql.VarChar(200), ev.description)
                .input('subject', sql.VarChar(200), ev.subject)
                .input('body', sql.NVarChar(sql.MAX), body)
                .query(`
                    UPDATE mae_evento_notificacion SET 
                        descripcion = @desc, 
                        asunto_template = @subject, 
                        cuerpo_template_html = @body,
                        modulo = 'AI_MA'
                    WHERE codigo_evento = @code
                `);
            console.log(`Event ${ev.code} updated in mae_evento_notificacion with dynamic title.`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
