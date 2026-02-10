import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

let transporter = null;

export const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: {
                rejectUnauthorized: false // Helpful for self-signed development certs
            }
        });
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
