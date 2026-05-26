import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

// X-08: helper de escape HTML para prevenir inyección en plantillas de email.
// Úsalo SIEMPRE que insertes contenido provisto por usuarios en plantillas HTML.
export const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true', // true for 465
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    async sendEmail({ to, subject, text, html, bcc }) {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to,
            bcc,
            subject,
            text,
            ...(html ? { html } : {})
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            logger.info(`Email sent: ${info.messageId}`);
            return info;
        } catch (error) {
            logger.error('Error sending email:', error);
            // We log but don't throw to prevent blocking the main process if email fails
            return null;
        }
    }

    // S-14: enviar correo de recuperación de contraseña con enlace de un solo uso.
    async sendPasswordReset({ to, nombreUsuario, resetUrl, expiresInMinutes }) {
        const subject = 'ADL ONE — Recuperación de contraseña';
        const text = `Hola ${nombreUsuario || ''},\n\n` +
            `Recibimos una solicitud para restablecer tu contraseña de ADL ONE.\n\n` +
            `Para crear una nueva clave, abre el siguiente enlace dentro de los próximos ${expiresInMinutes} minutos:\n\n` +
            `${resetUrl}\n\n` +
            `Si no fuiste tú quien solicitó este cambio, puedes ignorar este mensaje y tu clave actual seguirá siendo válida.\n\n` +
            `Saludos,\nEquipo ADL ONE`;
        const html = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #f8fafc;">
                <div style="background: white; border-radius: 12px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                    <h2 style="color: #1e3a8a; margin-top: 0;">Recuperación de contraseña</h2>
                    <p>Hola <strong>${escapeHtml(nombreUsuario || 'usuario')}</strong>,</p>
                    <p>Recibimos una solicitud para restablecer tu contraseña de <strong>ADL ONE</strong>.</p>
                    <p>Haz clic en el botón para crear una nueva clave. El enlace caduca en <strong>${expiresInMinutes} minutos</strong> y solo puede usarse una vez.</p>
                    <p style="text-align: center; margin: 32px 0;">
                        <a href="${resetUrl}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">Restablecer contraseña</a>
                    </p>
                    <p style="color: #64748b; font-size: 13px;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><span style="color: #1e40af; word-break: break-all;">${resetUrl}</span></p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
                    <p style="color: #64748b; font-size: 12px;">Si no fuiste tú quien hizo esta solicitud, ignora este correo: tu clave actual seguirá siendo válida.</p>
                </div>
            </div>`;
        return this.sendEmail({ to, subject, text, html });
    }

    /**
     * Send notification for Approved Ficha (Legacy FoxPro Logic)
     * @param {Object} params
     * @param {number} params.id - Ficha ID
     * @param {string} params.usuario - Updated by User Name (Approver)
     * @param {string} params.observaciones - Technical Observations
     */
    async sendFichaAceptada({ id, usuario, observaciones }) {
        const recipients = process.env.EMAIL_TO_LIST; // List from .env
        const bcc = process.env.EMAIL_BCC_LIST;       // BCC List from .env

        const timestamp = new Date().toLocaleString('es-CL');
        const subject = `ADLOne: ACEPTADA Ficha Comercial N°: ${id} - ${timestamp}`;

        const body =
            `FICHA COMERCIAL N°: ${id}
ESTADO            : ACEPTADA
USUARIO           : ${usuario}
OBSERVACIONES     : ${observaciones || 'Sin observaciones'}

Correo automático Sistema ADLOne - ADL Diagnostic Chile SpA`;

        logger.info(`Sending Approval Email for Ficha ${id} to ${recipients}`);
        return this.sendEmail({ to: recipients, bcc, subject, text: body });
    }

    /**
     * Send notification for Rejected Ficha
     * @param {Object} params
     * @param {number} params.id - Ficha ID
     * @param {string} params.usuario - Updated by User Name (Rejecter)
     * @param {string} params.observaciones - Rejection Reason
     * @param {string} params.emailCreador - Email of the ficha creator
     */
    async sendFichaRechazada({ id, usuario, observaciones, emailCreador }) {
        if (!emailCreador) {
            logger.warn(`No creator email provided for rejected ficha ${id}. Email not sent.`);
            return;
        }

        const timestamp = new Date().toLocaleString('es-CL');
        const subject = `ADLOne: RECHAZADA Ficha Comercial N°: ${id} - ${timestamp}`;

        const body =
            `FICHA COMERCIAL N°: ${id}
ESTADO            : RECHAZADA
USUARIO           : ${usuario}
OBSERVACIONES     : ${observaciones}

Por favor revise las observaciones y corrija la ficha.

Correo automático Sistema ADLOne - ADL Diagnostic Chile SpA`;

        logger.info(`Sending Rejection Email for Ficha ${id} to Creator ${emailCreador}`);
        // We probably don't need the extensive BCC list for individual rejections, but can add if needed
        return this.sendEmail({ to: emailCreador, subject, text: body });
    }

    /**
     * Send notification for Coordination Accepted Ficha
     * @param {Object} params
     * @param {number} params.id - Ficha ID
     * @param {string} params.usuario - Coordinator Name
     * @param {string} params.observaciones - Coordination Observations
     */
    async sendCoordinacionAceptada({ id, usuario, observaciones }) {
        const recipients = process.env.EMAIL_TO_LIST; // Development: vremolcoy@adldiagnostic.cl
        const bcc = process.env.EMAIL_BCC_LIST;

        const timestamp = new Date().toLocaleString('es-CL');
        const subject = `ADLOne: ACEPTADA Ficha Comercial N°: ${id} - Usuario: ${usuario} - ${timestamp}`;

        const body =
            `FICHA COMERCIAL N°: ${id}

ESTADO            : ACEPTADA
USUARIO           : ${usuario}
OBSERVACIONES     : ${observaciones || 'Sin observaciones'}

Correo automático Sistema ADLOne - ADL Diagnostic Chile SpA`;

        logger.info(`Sending Coordination Approval Email for Ficha ${id}`);
        return this.sendEmail({ to: recipients, bcc, subject, text: body });
    }

    /**
     * Send notification for Coordination Review (Send to Technical)
     * @param {Object} params
     * @param {number} params.id - Ficha ID
     * @param {string} params.usuario - Coordinator Name
     * @param {string} params.observaciones - Coordination Observations
     */
    async sendCoordinacionRevisar({ id, usuario, observaciones }) {
        // In production: pflores@adldiagnostic.cl (Technical Manager)
        // In development: vremolcoy@adldiagnostic.cl
        const recipients = process.env.EMAIL_TO_LIST;
        const bcc = process.env.EMAIL_BCC_LIST;

        const timestamp = new Date().toLocaleString('es-CL');
        const subject = `ADLOne: REVISAR Ficha Comercial N°: ${id} - ${timestamp}`;

        const body =
            `FICHA COMERCIAL N°: ${id}

ESTADO            : REVISAR
USUARIO           : ${usuario}
OBSERVACIONES     : ${observaciones || 'Sin observaciones'}

Correo automático Sistema ADLOne - ADL Diagnostic Chile SpA`;

        logger.info(`Sending Coordination Review Email for Ficha ${id}`);
        return this.sendEmail({ to: recipients, bcc, subject, text: body });
    }
}

export default new EmailService();
