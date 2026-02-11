import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';
import sql from 'mssql';

const createEventNotifs = async () => {
    try {
        const pool = await getConnection();

        // 1. EVENTO: EQUIPO_SOLICITUD_APROBADA
        const checkApproved = await pool.request()
            .input('code', 'EQUIPO_SOLICITUD_APROBADA')
            .query('SELECT 1 FROM mae_evento_notificacion WHERE codigo_evento = @code');

        if (checkApproved.recordset.length === 0) {
            await pool.request().query(`
                INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, cuerpo_template_html, modulo)
                VALUES (
                    'EQUIPO_SOLICITUD_APROBADA', 
                    'Solicitud de Equipo Aprobada', 
                    'Resultado Solicitud: {TIPO_SOLICITUD} APROBADA', 
                    '<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; color: #333;"><div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;"><div style="text-align: center; margin-bottom: 20px;"><img src="{LOGO_BASE64}" alt="ADL ONE" style="max-width: 150px;"></div><h2 style="color: #2e7d32; text-align: center;">¡Solicitud Aprobada!</h2><p>Estimado/a <strong>{NOMBRE_SOLICITANTE}</strong>,</p><p>Le informamos que su solicitud de <strong>{TIPO_SOLICITUD}</strong> ha sido <strong>APROBADA</strong> por el equipo de revisión.</p><div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; border-left: 4px solid #2e7d32; margin: 20px 0;"><strong>Comentarios del Revisor:</strong><br>{FEEDBACK_ADMIN}</div><p style="font-size: 12px; color: #666; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">Este es un mensaje automático del sistema ADL One. Por favor, no responda a este correo.</p></div></body></html>', 
                    'MA'
                )
            `);
            console.log('Evento EQUIPO_SOLICITUD_APROBADA creado.');
        }

        // 2. EVENTO: EQUIPO_SOLICITUD_RECHAZADA
        const checkRejected = await pool.request()
            .input('code', 'EQUIPO_SOLICITUD_RECHAZADA')
            .query('SELECT 1 FROM mae_evento_notificacion WHERE codigo_evento = @code');

        if (checkRejected.recordset.length === 0) {
            await pool.request().query(`
                INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, cuerpo_template_html, modulo)
                VALUES (
                    'EQUIPO_SOLICITUD_RECHAZADA', 
                    'Solicitud de Equipo Rechazada', 
                    'Resultado Solicitud: {TIPO_SOLICITUD} RECHAZADA', 
                    '<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; color: #333;"><div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;"><div style="text-align: center; margin-bottom: 20px;"><img src="{LOGO_BASE64}" alt="ADL ONE" style="max-width: 150px;"></div><h2 style="color: #d32f2f; text-align: center;">Solicitud Rechazada</h2><p>Estimado/a <strong>{NOMBRE_SOLICITANTE}</strong>,</p><p>Le informamos que su solicitud de <strong>{TIPO_SOLICITUD}</strong> ha sido <strong>RECHAZADA</strong> después de la revisión técnica.</p><div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; border-left: 4px solid #d32f2f; margin: 20px 0;"><strong>Motivo del Rechazo:</strong><br>{FEEDBACK_ADMIN}</div><p>Le invitamos a revisar los comentarios anteriores y realizar las correcciones necesarias para una nueva solicitud.</p><p style="font-size: 12px; color: #666; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">Este es un mensaje automático del sistema ADL One. Por favor, no responda a este correo.</p></div></body></html>', 
                    'MA'
                )
            `);
            console.log('Evento EQUIPO_SOLICITUD_RECHAZADA creado.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

createEventNotifs();
