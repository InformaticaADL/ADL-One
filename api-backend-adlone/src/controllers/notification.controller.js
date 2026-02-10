import { getConnection } from '../config/database.js';
import sql from '../config/database.js';
import logger from '../utils/logger.js';
import notificationService from '../services/notification.service.js';
import transporter from '../config/mailer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getEvents = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT * FROM mae_evento_notificacion ORDER BY id_evento');
        res.json(result.recordset);
    } catch (error) {
        logger.error('Error fetching notification events:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

export const getRecipients = async (req, res) => {
    const { eventId } = req.params;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('eventId', sql.Numeric(10, 0), eventId)
            .query(`
                SELECT r.id_relacion, r.id_evento, r.tipo_envio,
                       r.id_usuario, u.nombre_usuario, u.correo_electronico as user_email,
                       r.id_rol, rol.nombre_rol
                FROM rel_evento_destinatario r
                LEFT JOIN mae_usuario u ON r.id_usuario = u.id_usuario AND u.habilitado = 'S'
                LEFT JOIN mae_rol rol ON r.id_rol = rol.id_rol
                WHERE r.id_evento = @eventId
                ORDER BY r.tipo_envio, u.nombre_usuario, rol.nombre_rol
            `);
        res.json(result.recordset);
    } catch (error) {
        logger.error('Error fetching recipients:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

export const addRecipient = async (req, res) => {
    const { eventId } = req.params;
    const { idUsuario, idRol, tipoEnvio } = req.body; // Expect either idUsuario OR idRol

    if (!eventId || (!idUsuario && !idRol)) {
        return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    try {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);
            request.input('idEvento', sql.Numeric(10, 0), eventId);
            request.input('idUsuario', sql.Numeric(10, 0), idUsuario || null);
            request.input('idRol', sql.Numeric(10, 0), idRol || null);
            request.input('tipoEnvio', sql.VarChar(10), tipoEnvio || 'TO');

            // Check duplicate
            const checkQuery = `
                SELECT COUNT(*) as count 
                FROM rel_evento_destinatario 
                WHERE id_evento = @idEvento 
                  AND ((id_usuario = @idUsuario AND id_usuario IS NOT NULL) 
                    OR (id_rol = @idRol AND id_rol IS NOT NULL))
            `;

            const check = await request.query(checkQuery);
            if (check.recordset[0].count > 0) {
                await transaction.rollback();
                return res.status(400).json({ message: 'El destinatario ya existe para este evento' });
            }

            await request.query(`
                INSERT INTO rel_evento_destinatario (id_evento, id_usuario, id_rol, tipo_envio)
                VALUES (@idEvento, @idUsuario, @idRol, @tipoEnvio)
            `);

            await transaction.commit();
            res.json({ success: true, message: 'Destinatario agregado correctamente' });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        logger.error('Error adding recipient:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

export const removeRecipient = async (req, res) => {
    const { id } = req.params; // id_relacion
    try {
        const pool = await getConnection();
        const request = pool.request();
        request.input('id', sql.Numeric(10, 0), id);
        await request.query('DELETE FROM rel_evento_destinatario WHERE id_relacion = @id');
        res.json({ success: true, message: 'Destinatario eliminado' });
    } catch (error) {
        logger.error('Error removing recipient:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// NEW: Test SMTP connection
export const testSMTP = async (req, res) => {
    try {
        await transporter.verify();
        logger.info('SMTP connection test successful');
        res.json({
            success: true,
            message: 'Conexión SMTP exitosa',
            config: {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                secure: process.env.SMTP_SECURE,
                user: process.env.SMTP_USER
            }
        });
    } catch (error) {
        logger.error('SMTP connection test failed:', error);
        res.status(500).json({
            success: false,
            message: 'Error de conexión SMTP',
            error: error.message
        });
    }
};

// NEW: Send test notification
export const sendTestNotification = async (req, res) => {
    const { eventCode, correlativo } = req.body;

    if (!eventCode) {
        return res.status(400).json({ message: 'Se requiere eventCode' });
    }

    try {
        logger.info(`Manual test notification triggered for event: ${eventCode}`);
        await notificationService.send(eventCode, { correlativo: correlativo || 'TEST-123' });
        res.json({
            success: true,
            message: `Notificación de prueba enviada para evento: ${eventCode}. Revisa los logs del servidor.`
        });
    } catch (error) {
        logger.error('Error sending test notification:', error);
        res.status(500).json({
            success: false,
            message: 'Error enviando notificación de prueba',
            error: error.message
        });
    }
};

// NEW: Test custom HTML email template (for design iteration)
export const testCustomHTML = async (req, res) => {
    let { subject, htmlContent, to } = req.body;

    if (!subject || !htmlContent) {
        return res.status(400).json({ message: 'Se requieren subject y htmlContent' });
    }

    try {
        const recipient = to || process.env.EMAIL_TO_LIST || 'vremolcoy@adldiagnostic.cl';
        let attachments = [];

        // INJECT LOCAL LOGO via CID (Content-ID) for better Outlook support
        if (htmlContent.includes('{LOGO_BASE64}')) {
            try {
                // Hardcoded path to dev environment logo - for testing purposes only
                const logoPath = 'C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\frontend-adlone\\src\\assets\\images\\logo-adlone.png';

                if (fs.existsSync(logoPath)) {
                    // Replace placeholder with CID reference
                    htmlContent = htmlContent.replace(/{LOGO_BASE64}/g, 'cid:logoAdlOne');

                    // Add to attachments
                    attachments.push({
                        filename: 'logo-adlone.png',
                        path: logoPath,
                        cid: 'logoAdlOne'
                    });
                } else {
                    logger.warn(`Logo not found at ${logoPath}`);
                }
            } catch (err) {
                logger.error('Error injecting logo:', err);
            }
        }

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"ADL ONE" <notificaciones@adldiagnostic.cl>',
            to: recipient,
            subject: subject,
            html: htmlContent,
            attachments: attachments
        };

        await transporter.sendMail(mailOptions);

        logger.info(`Custom HTML test email sent to: ${recipient}`);
        res.json({
            success: true,
            message: `Email de prueba enviado a: ${recipient}`,
            preview: htmlContent.substring(0, 200) + '...'
        });
    } catch (error) {
        logger.error('Error sending custom HTML test:', error);
        res.status(500).json({
            success: false,
            message: 'Error enviando email de prueba',
            error: error.message
        });
    }
};
