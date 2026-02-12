import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

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

    async sendEmail({ to, subject, text, bcc }) {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to,
            bcc,
            subject,
            text, // Plain text body
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
