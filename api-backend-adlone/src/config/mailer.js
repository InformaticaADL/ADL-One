import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { redirigirCorreo, soloDominiosPermitidos } from './redireccionCorreo.js';

dotenv.config();

let transporter = null;

export const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: {
                rejectUnauthorized: process.env.NODE_ENV !== 'development',
            }
        });
        // Modo pruebas: con EMAIL_REDIRECT_TO definida, todo correo sale solo a esa dirección (ver redireccionCorreo.js).
        const enviarReal = transporter.sendMail.bind(transporter);
        transporter.sendMail = (opciones, ...resto) => {
            const redirigido = redirigirCorreo(opciones);
            if (redirigido !== opciones) logger.warn(`[correo] MODO PRUEBAS: "${opciones && opciones.subject}" redirigido a ${redirigido.to} (destinatarios reales: ${opciones && opciones.to})`);
            // Solo correos de ADL: se quitan los destinatarios de otros dominios; si no queda nadie, no se envía.
            const { opciones: final, bloqueados, vacio } = soloDominiosPermitidos(redirigido);
            if (bloqueados.length) logger.warn(`[correo] Destinatarios que NO son de ADL, quitados de "${opciones && opciones.subject}": ${bloqueados.join(', ')}${vacio ? ' (no quedó nadie: el correo NO se envió)' : ''}`);
            if (vacio) return Promise.resolve({ messageId: null, accepted: [], rejected: bloqueados, bloqueadoPorDominio: true });
            return enviarReal(final, ...resto);
        };
    }
    return transporter;
};

export const verifyConnection = async () => {
    try {
        const t = getTransporter();
        await t.verify();
        logger.info('SMTP Connection established successfully');
        return true;
    } catch (error) {
        logger.error('SMTP Connection failed:', error);
        return false;
    }
};

export default getTransporter;
