import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
import { soloDominiosPermitidos, redirigirCorreo } from '../config/redireccionCorreo.js';
import { registrarCorreo } from '../config/registroCorreos.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderRecuperacionClave, renderClaveCambiada, renderEquiposPorVencer, LOGO_CID } from '../notifications/system-emails.js';

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

// Logo de ADL ONE incrustado en los correos con el diseño nuevo (el mismo archivo que usan las notificaciones). Si falta, el correo sale sin logo.
const RUTA_LOGO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/logo-adlone.png');
const LOGO = fs.existsSync(RUTA_LOGO) ? fs.readFileSync(RUTA_LOGO) : null;

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

    async sendEmail({ to, subject, text, html, bcc, attachments, tipo = null }) {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to,
            bcc,
            subject,
            text,
            ...(html ? { html } : {}),
            ...(attachments && attachments.length ? { attachments } : {})
        };

        // Modo pruebas (mientras no estemos en producción): todo llega solo a la dirección de pruebas. Ver config/redireccionCorreo.js.
        const redirigido = redirigirCorreo(mailOptions);
        const fueRedirigido = redirigido !== mailOptions;
        // Solo correos de ADL: se quitan los destinatarios de otros dominios; si no queda nadie, no se envía.
        const { opciones: seguras, bloqueados, vacio } = soloDominiosPermitidos(redirigido);
        const anotar = (estado, error) => registrarCorreo({ tipo, asunto: subject, reales: [to, bcc].filter(Boolean).flat(), final: seguras && seguras.to, redirigido: fueRedirigido, estado, error });
        if (bloqueados.length) logger.warn(`[correo] Destinatarios que NO son de ADL, quitados: ${bloqueados.join(', ')}${vacio ? ' (no quedó nadie: el correo NO se envió)' : ''}`);
        if (vacio) { anotar('bloqueado', 'ningún destinatario de ADL'); return null; }

        try {
            const info = await this.transporter.sendMail(seguras);
            logger.info(`Email sent: ${info.messageId}`);
            anotar('enviado');
            return info;
        } catch (error) {
            logger.error('Error sending email:', error);
            anotar('fallido', error && error.message);
            // We log but don't throw to prevent blocking the main process if email fails
            return null;
        }
    }

    // S-14: enviar correo de recuperación de contraseña con enlace de un solo uso.
    async sendPasswordReset({ to, nombreUsuario, resetUrl, expiresInMinutes }) {
        const { subject, text, html } = renderRecuperacionClave({ nombreUsuario, resetUrl, expiresInMinutes });
        const attachments = LOGO ? [{ filename: 'logo-adlone.png', content: LOGO, cid: LOGO_CID }] : [];
        return this.sendEmail({ to, subject, text, html, attachments, tipo: 'recuperacion_clave' });
    }

    // Aviso a quien gestiona los equipos: los que vencen pronto (tramo 7 o 30 días).
    async sendEquiposPorVencer({ to, tramo, equipos }) {
        const { subject, text, html } = renderEquiposPorVencer({ tramo, equipos, appUrl: process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173' });
        const attachments = LOGO ? [{ filename: 'logo-adlone.png', content: LOGO, cid: LOGO_CID }] : [];
        return this.sendEmail({ to, subject, text, html, attachments, tipo: 'equipos_por_vencer' });
    }

    // Confirmación a la persona de que su contraseña cambió. motivo: 'cambio' (lo hizo ella) o 'recuperacion' (enlace de recuperación).
    async sendPasswordChanged({ to, nombreUsuario, motivo = 'cambio' }) {
        const { subject, text, html } = renderClaveCambiada({ nombreUsuario, motivo });
        const attachments = LOGO ? [{ filename: 'logo-adlone.png', content: LOGO, cid: LOGO_CID }] : [];
        return this.sendEmail({ to, subject, text, html, attachments, tipo: 'clave_cambiada' });
    }
}

export default new EmailService();
