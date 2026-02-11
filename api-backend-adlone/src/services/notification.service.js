
import sql from '../config/database.js';
import { getConnection } from '../config/database.js';
import transporter from '../config/mailer.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

class NotificationService {
    constructor() {
        this.logoBuffer = null;
        this._loadLogo();
    }

    _loadLogo() {
        try {
            // Hardcoded path based on known project structure
            // Backend: api-backend-adlone
            // Logo: frontend-adlone/src/assets/images/logo-adlone.png
            const logoPath = path.resolve(process.cwd(), '../frontend-adlone/src/assets/images/logo-adlone.png');
            if (fs.existsSync(logoPath)) {
                this.logoBuffer = fs.readFileSync(logoPath);
                logger.info('Logo ADL ONE loaded successfully (Buffer) for Email Templates.');
            } else {
                logger.warn(`Logo not found at path: ${logoPath}`);
            }
        } catch (error) {
            logger.error('Error loading logo:', error);
        }
    }

    /**
     * Envía una notificación basada en un evento del sistema.
     * @param {string} eventCode - Código del evento (ej: 'FICHA_NUEVA').
     * @param {object} context - Datos para reemplazar en el template (ej: { correlativo: '123' }).
     */
    async send(eventCode, context = {}) {
        try {
            logger.info(`Iniciando proceso de notificación para evento: ${eventCode}`);
            const pool = await getConnection();

            // 1. Obtener configuración del evento
            const eventResult = await pool.request()
                .input('code', sql.VarChar(50), eventCode)
                .query('SELECT * FROM mae_evento_notificacion WHERE codigo_evento = @code');

            if (eventResult.recordset.length === 0) {
                logger.warn(`Evento de notificación no encontrado: ${eventCode}`);
                return;
            }

            const event = eventResult.recordset[0];
            const eventId = event.id_evento;

            // 2. Obtener destinatarios configurados
            const recipientsResult = await pool.request()
                .input('eventId', sql.Numeric(10, 0), eventId)
                .query(`
                    SELECT r.id_usuario, r.id_rol, r.tipo_envio,
                           u.correo_electronico as user_email, u.nombre_usuario,
                           rol.nombre_rol
                    FROM rel_evento_destinatario r
                    LEFT JOIN mae_usuario u ON r.id_usuario = u.id_usuario AND u.habilitado = 'S'
                    LEFT JOIN mae_rol rol ON r.id_rol = rol.id_rol
                    WHERE r.id_evento = @eventId
                `);

            const recipients = recipientsResult.recordset;
            if (recipients.length === 0) {
                logger.info(`No hay destinatarios configurados para el evento: ${eventCode}`);
                return;
            }

            // 3. Resolver lista final de correos
            const emailList = {
                to: new Set(),
                cc: new Set(),
                bcc: new Set()
            };

            for (const recipient of recipients) {
                if (recipient.id_usuario && recipient.user_email) {
                    // Destinatario específico
                    this._addEmail(emailList, recipient.tipo_envio, recipient.user_email);
                } else if (recipient.id_rol) {
                    // Rol completo: Buscar todos los usuarios con ese rol
                    const roleUsers = await this._getUsersByRole(pool, recipient.id_rol);
                    roleUsers.forEach(email => this._addEmail(emailList, recipient.tipo_envio, email));
                }
            }

            // 3.1. Destinatarios Directos (Nuevos: por email pasado por parámetro)
            if (context.directEmails) {
                const emails = Array.isArray(context.directEmails) ? context.directEmails : [context.directEmails];
                emails.forEach(email => this._addEmail(emailList, 'TO', email));
            }

            // 3.1. Destinatarios por Permiso (Nuevo requerimiento dinámico)
            if (context.permissionRecibir) {
                const permissionUsers = await this._getUsersByPermission(pool, context.permissionRecibir);
                permissionUsers.forEach(email => this._addEmail(emailList, 'TO', email));
            }

            // 4. Compilar Asunto y Cuerpo (Simple Replace por ahora)
            const subject = this._compileTemplate(event.asunto_template, context);
            const htmlBody = this._compileTemplate(event.cuerpo_template_html || '<p>Notificación del Sistema ADL One</p>', context);

            // 5. Enviar Correo
            const to = Array.from(emailList.to).join(', ');
            const cc = Array.from(emailList.cc).join(', ');
            const bcc = Array.from(emailList.bcc).join(', ');

            if (!to) {
                logger.warn(`Evento ${eventCode} tiene destinatarios pero ningún email válido resulto.`);
                return;
            }

            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.SMTP_FROM || '"ADL One" <notificaciones@adldiagnostic.cl>',
                to: to,
                cc: cc,
                bcc: bcc,
                subject: subject,
                html: htmlBody,
                attachments: [] // Initialize attachments array
            };

            // Attach Logo if available
            if (this.logoBuffer) {
                mailOptions.attachments.push({
                    filename: 'logo-adlone.png',
                    content: this.logoBuffer,
                    cid: 'logo@adlone.com' // Referenced in HTML as <img src="cid:logo@adlone.com">
                });
            }

            // Non-blocking email send
            transporter().sendMail(mailOptions)
                .then(() => logger.info(`Notificación enviada exitosamente para ${eventCode}. TO: ${to}`))
                .catch((error) => logger.error(`Error enviando notificación para ${eventCode}:`, error));

        } catch (error) {
            logger.error(`Error preparando notificación para ${eventCode}:`, error);
        }
    }

    _addEmail(list, type, email) {
        if (!email) return;
        const normalized = email.toLowerCase().trim();
        if (type === 'CC') list.cc.add(normalized);
        else if (type === 'BCC') list.bcc.add(normalized);
        else list.to.add(normalized);
    }

    async _getUsersByRole(pool, roleId) {
        const result = await pool.request()
            .input('roleId', sql.Numeric(10, 0), roleId)
            .query(`
                SELECT u.correo_electronico as email 
                FROM rel_usuario_rol rel
                JOIN mae_usuario u ON rel.id_usuario = u.id_usuario
                WHERE rel.id_rol = @roleId AND u.habilitado = 'S' AND u.correo_electronico IS NOT NULL AND u.correo_electronico <> ''
            `);
        return result.recordset.map(row => row.email);
    }

    /**
     * Obtiene los correos de todos los usuarios que tienen un permiso específico a través de sus roles.
     * @param {object} pool - Pool de conexión.
     * @param {string} permissionCode - Código del permiso (ej: 'AI_MA_NOTIF_REC').
     */
    async _getUsersByPermission(pool, permissionCode) {
        try {
            const result = await pool.request()
                .input('permCode', sql.VarChar(50), permissionCode)
                .query(`
                    SELECT DISTINCT u.correo_electronico
                    FROM mae_usuario u
                    JOIN rel_usuario_rol ur ON u.id_usuario = ur.id_usuario
                    JOIN rel_rol_permiso rp ON ur.id_rol = rp.id_rol
                    JOIN mae_permiso p ON rp.id_permiso = p.id_permiso
                    WHERE p.codigo = @permCode AND u.habilitado = 'S' AND u.correo_electronico IS NOT NULL AND u.correo_electronico <> ''
                `);
            return result.recordset.map(r => r.correo_electronico);
        } catch (error) {
            logger.error(`Error fetching users with permission ${permissionCode}:`, error);
            return [];
        }
    }

    _compileTemplate(template, context) {
        if (!template) return '';
        let output = template;

        // 0. Inject Global Defaults (Logo) if not present
        if (!context.LOGO_BASE64 && this.logoBuffer) {
            context.LOGO_BASE64 = 'cid:logo@adlone.com';
        }

        // 1. Force replace LOGO_BASE64 in template first (Global Replace)
        if (context.LOGO_BASE64) {
            output = output.split('{LOGO_BASE64}').join(context.LOGO_BASE64);
        }

        // 2. Handle SERVICIOS_DETALLE (dynamic array processing)
        if (context.servicios && Array.isArray(context.servicios)) {
            const serviciosHtml = context.servicios.map((servicio, index) => `
                <div style="margin-bottom: 15px; padding: 12px; background: white; border-left: 4px solid #0062a8; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <strong style="color: #0062a8; font-size: 14px; font-family: Arial, sans-serif;">Servicio ${servicio.numero}:</strong><br>
                    <div style="margin-top: 8px; color: #333; font-size: 13px; line-height: 1.6; font-family: Arial, sans-serif;">
                        <div style="margin-bottom: 4px;">📥 <strong>Instalación:</strong> ${servicio.muestreador_instalacion}</div>
                        <div style="margin-bottom: 4px;">📤 <strong>Retiro:</strong> ${servicio.muestreador_retiro}</div>
                        <div>📅 <strong>Fecha muestreo:</strong> ${servicio.fecha_muestreo}</div>
                    </div>
                </div>
            `).join('');

            output = output.split('{SERVICIOS_DETALLE}').join(serviciosHtml);
        }

        // 3. Replace all other placeholders
        for (const [key, value] of Object.entries(context)) {
            // Skip servicios array (already processed)
            if (key === 'servicios') continue;

            const val = value || '';

            // 1. Try exact match {key}
            output = output.split(`{${key}}`).join(val);

            // 2. Try Uppercase match {KEY} (Standard SQL Template format)
            output = output.split(`{${key.toUpperCase()}}`).join(val);
        }
        return output;
    }
}

export default new NotificationService();
