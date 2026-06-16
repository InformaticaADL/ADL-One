import dotenv from 'dotenv';
dotenv.config();
import { getConnection, closeConnection } from '../config/database.js';

const MINIMAL_STANDARD = `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px; font-family: Arial, sans-serif;">
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Solicitante:</strong> <span style="color: #475569;">{SOLICITANTE}</span></td></tr>
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Fecha y Hora:</strong> <span style="color: #475569;">{FECHA} a las {HORA}</span></td></tr>
</table>

{EQUIPOS_DETALLE}

{BLOQUE_OBSERVACION|{ETIQUETA_OBSERVACION}}`;

const MINIMAL_REPROGRAMADO = `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px; font-family: Arial, sans-serif;">
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Responsable:</strong> <span style="color: #475569;">{USUARIO}</span></td></tr>
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Fecha y Hora:</strong> <span style="color: #475569;">{FECHA} a las {HORA}</span></td></tr>
</table>

{servicios_detalle}

{BLOQUE_OBSERVACION|Observaciones}`;

const MINIMAL_FOMA = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.6;">
    <p>Estimado Cliente,</p>
    <p>Adjunto a este correo encontrará el Informe de Muestreo (FoMa) correspondiente a los servicios realizados.</p>
    <p>Si tiene alguna duda o consulta, por favor contáctenos respondiendo a este correo.</p>
    
    <div style="margin: 30px 0; text-align: center;">
        {ENLACE_DESCARGA}
    </div>
</div>`;

const MINIMAL_CADENA = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.6;">
    <p>Estimado Cliente,</p>
    <p>Adjunto a este correo encontrará la Cadena de Custodia correspondiente a sus muestras.</p>
    <p>Si tiene alguna duda o consulta, por favor contáctenos respondiendo a este correo.</p>
    
    <div style="margin: 30px 0; text-align: center;">
        {ENLACE_DESCARGA}
    </div>
</div>`;

const MINIMAL_PASSWORD_REQ = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.6;">
    <p>Hola <strong>{NOMBRE_USUARIO}</strong>,</p>
    <p>Se ha solicitado un restablecimiento de contraseña para tu cuenta en ADL ONE.</p>
    <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
    
    <div style="margin: 30px 0; text-align: center;">
        <a href="{LINK_RECUPERACION}" style="background-color: #0062a8; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 15px;">Restablecer Contraseña</a>
    </div>
    
    <p style="font-size: 12px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 16px;">Si no solicitaste este cambio, puedes ignorar de forma segura este correo. El enlace expirará pronto.</p>
</div>`;

const MINIMAL_PASSWORD_DONE = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.6;">
    <p>Hola <strong>{NOMBRE_USUARIO}</strong>,</p>
    <p>Te confirmamos que la contraseña de tu cuenta en ADL ONE ha sido actualizada exitosamente.</p>
    <p>Si no realizaste este cambio, por favor contacta a soporte técnico inmediatamente.</p>
</div>`;


async function migrateAll() {
    try {
        const pool = await getConnection();
        
        const updates = [
            // URS and Avisos
            { code: 'SOLICITUD_NUEVA', body: MINIMAL_STANDARD },
            { code: 'SOLICITUD_ESTADO_CAMBIO', body: MINIMAL_STANDARD },
            { code: 'SOLICITUD_COMENTARIO_NUEVO', body: MINIMAL_STANDARD },
            { code: 'SOLICITUD_DERIVACION', body: MINIMAL_STANDARD },
            { code: 'SOL_EXTENSION_VIGENCIA_NUEVA', body: MINIMAL_STANDARD },
            { code: 'AVISO_PROBLEMA_NUEVO', body: MINIMAL_STANDARD },
            { code: 'AVISO_PERDIDO_NUEVO', body: MINIMAL_STANDARD },
            { code: 'AVISO_CANCELACION_NUEVA', body: MINIMAL_STANDARD },
            { code: 'AVISO_CONSULTA_NUEVA', body: MINIMAL_STANDARD },
            { code: 'AVISO_CONSULTA_EQUIPO_NUEVA', body: MINIMAL_STANDARD },
            { code: 'AVISO_CONSULTA_FICHA_NUEVA', body: MINIMAL_STANDARD },
            
            // Fichas
            { code: 'FICHA_MUESTREO_REPROGRAMADO', body: MINIMAL_REPROGRAMADO },
            
            // MAM
            { code: 'ENV_FOMA_MAM', body: MINIMAL_FOMA },
            { code: 'ENV_CADENA_MAM', body: MINIMAL_CADENA },
            
            // Security
            { code: 'PASSWORD_RESET_REQUESTED', body: MINIMAL_PASSWORD_REQ },
            { code: 'PASSWORD_RESET_COMPLETED', body: MINIMAL_PASSWORD_DONE },
        ];

        let count = 0;
        for (const up of updates) {
            const res = await pool.request()
                .input('code', up.code)
                .input('body', up.body)
                .query("UPDATE mae_evento_notificacion SET cuerpo_template_html = @body WHERE codigo_evento = @code");
            
            if (res.rowsAffected[0] > 0) count++;
        }
        
        console.log(`✅ Migración de ${count} plantillas restantes completada.`);

    } catch (err) {
        console.error("❌ Error", err);
    } finally {
        await closeConnection();
    }
}

migrateAll();
