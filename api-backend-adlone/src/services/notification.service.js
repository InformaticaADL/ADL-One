
import sql from '../config/database.js';
import { getConnection } from '../config/database.js';
import transporter from '../config/mailer.js';
import logger from '../utils/logger.js';

class NotificationService {

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
                from: process.env.SMTP_FROM || '"ADL One" <noreply@adlone.cl>',
                to: to,
                cc: cc,
                bcc: bcc,
                subject: subject,
                html: htmlBody
            };

            await transporter.sendMail(mailOptions);
            logger.info(`Notificación enviada exitosamente para ${eventCode}. TO: ${to}`);

        } catch (error) {
            logger.error(`Error enviando notificación para ${eventCode}:`, error);
            // No lanzamos error para no interrumpir el flujo principal (ej. la creación de la ficha)
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

    _compileTemplate(template, context) {
        if (!template) return '';
        let output = template;
        for (const [key, value] of Object.entries(context)) {
            const placeholder = `{${key}}`;
            output = output.split(placeholder).join(value || '');
        }
        return output;
    }
}

export default new NotificationService();
