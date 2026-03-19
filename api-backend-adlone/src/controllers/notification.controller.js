import { getConnection } from '../config/database.js';
import sql from '../config/database.js';
import logger from '../utils/logger.js';
import unsService from '../services/uns.service.js';
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
        // First get the event code
        const eventRes = await pool.request()
            .input('id', sql.Numeric(10, 0), eventId)
            .query('SELECT codigo_evento FROM mae_evento_notificacion WHERE id_evento = @id');
        
        if (eventRes.recordset.length === 0) return res.status(404).json({ message: 'Evento no encontrado' });
        
        const eventCode = eventRes.recordset[0].codigo_evento;
        const rules = await unsService.getRulesByEvent(eventCode);
        
        // Map rules to the format expected by the frontend (for backward compatibility where possible)
        const recipients = rules.map(r => ({
            id_relacion: r.id_regla, // map id_regla to id_relacion
            id_evento: eventId,
            id_usuario: r.id_usuario_destino,
            nombre_usuario: r.nombre_usuario,
            id_rol: r.id_rol_destino,
            nombre_rol: r.nombre_rol,
            tipo_envio: 'TO', // Defaultmode
            // UNS specific fields
            envia_email: r.envia_email,
            envia_web: r.envia_web,
            plantilla_web: r.plantilla_web,
            plantilla_web_titulo: r.plantilla_web_titulo,
            area_destino: r.area_destino
        }));

        res.json(recipients);
    } catch (error) {
        logger.error('Error fetching recipients:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

export const addRecipient = async (req, res) => {
    const { eventId } = req.params;
    const { idUsuario, idRol, enviaEmail, enviaWeb, plantillaWeb, plantillaWebTitulo, areaDestino } = req.body;

    try {
        const pool = await getConnection();
        const eventRes = await pool.request()
            .input('id', sql.Numeric(10, 0), eventId)
            .query('SELECT codigo_evento FROM mae_evento_notificacion WHERE id_evento = @id');
        
        if (eventRes.recordset.length === 0) return res.status(404).json({ message: 'Evento no encontrado' });
        
        const eventCode = eventRes.recordset[0].codigo_evento;

        const ruleData = {
            codigo_evento: eventCode,
            id_rol_destino: idRol,
            id_usuario_destino: idUsuario,
            area_destino: areaDestino,
            envia_email: enviaEmail ?? 1,
            envia_web: enviaWeb ?? 0,
            plantilla_web_titulo: plantillaWebTitulo,
            plantilla_web: plantillaWeb,
            estado: 1
        };

        const result = await unsService.saveRule(ruleData);
        res.json({ success: true, message: 'Regla agregada correctamente', data: result });

    } catch (error) {
        logger.error('Error adding rule/recipient:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

export const removeRecipient = async (req, res) => {
    const { id } = req.params; // this is id_regla now
    try {
        await unsService.deleteRule(id);
        res.json({ success: true, message: 'Regla eliminada' });
    } catch (error) {
        logger.error('Error removing rule:', error);
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
    const { eventCode, context } = req.body;

    if (!eventCode) {
        return res.status(400).json({ message: 'Se requiere eventCode' });
    }

    try {
        logger.info(`Manual test notification triggered for event: ${eventCode}`);
        await unsService.trigger(eventCode, context || { correlativo: 'TEST-123', usuario: 'Admin Test' });
        res.json({
            success: true,
            message: `Notificación de prueba enviada para evento: ${eventCode}. Revisa los logs y la campanita.`
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

// ARCHITECTURE 3.0: Get hierarchical catalog (Modulo > Funcionalidad > Eventos)
export const getNotificationCatalog = async (req, res) => {
    try {
        const pool = await getConnection();
        
        // Final Query: Join Modulos, Funcionalidades, Eventos and current Config
        const result = await pool.request().query(`
            SELECT 
                m.id_modulo, m.nombre as modulo_nombre, m.icono as modulo_icono,
                f.id_funcionalidad, f.nombre as funcionalidad_nombre,
                e.id_evento, e.codigo_evento, e.descripcion as evento_descripcion, e.es_transaccional,
                c.envia_email, c.envia_web, c.id_rol, c.id_usuario, c.es_propietario, c.cc_emails,
                r.nombre_rol, u.nombre_usuario
            FROM mae_notificacion_modulo m
            JOIN mae_notificacion_funcionalidad f ON f.id_modulo = m.id_modulo
            JOIN mae_evento_notificacion e ON e.id_funcionalidad = f.id_funcionalidad AND (e.oculto_en_hub = 0 OR e.oculto_en_hub IS NULL)
            LEFT JOIN cfg_notificacion_config c ON c.id_evento = e.id_evento
            LEFT JOIN mae_rol r ON r.id_rol = c.id_rol
            LEFT JOIN mae_usuario u ON u.id_usuario = c.id_usuario
            ORDER BY m.id_modulo, f.id_funcionalidad, e.id_evento
        `);

        // Transform flat list into nested JSON
        const catalog = [];
        const rows = result.recordset;

        rows.forEach(row => {
            let mod = catalog.find(m => m.id === row.id_modulo);
            if (!mod) {
                mod = { id: row.id_modulo, nombre: row.modulo_nombre, icono: row.modulo_icono, funcionalidades: [] };
                catalog.push(mod);
            }

            let func = mod.funcionalidades.find(f => f.id === row.id_funcionalidad);
            if (!func) {
                func = { id: row.id_funcionalidad, nombre: row.funcionalidad_nombre, eventos: [] };
                mod.funcionalidades.push(func);
            }

            let ev = func.eventos.find(e => e.id === row.id_evento);
            if (!ev) {
                ev = { 
                    id: row.id_evento, 
                    codigo: row.codigo_evento, 
                    descripcion: row.evento_descripcion,
                    es_transaccional: !!row.es_transaccional,
                    config: [] 
                };
                func.eventos.push(ev);
            }

            if (row.id_rol || row.id_usuario || row.es_propietario !== null || row.cc_emails) {
                ev.config.push({
                    envia_email: row.envia_email,
                    envia_web: row.envia_web,
                    id_rol: row.id_rol,
                    nombre_rol: row.nombre_rol,
                    id_usuario: row.id_usuario,
                    nombre_usuario: row.nombre_usuario,
                    es_propietario: row.es_propietario,
                    cc_emails: row.cc_emails
                });
            }
        });

        res.json(catalog);
    } catch (error) {
        logger.error('Error in getNotificationCatalog:', error);
        res.status(500).json({ message: 'Error al obtener el catálogo de notificaciones' });
    }
};

// ARCHITECTURE 3.0: Save event config (Delete & Replace)
export const saveNotificationConfig = async (req, res) => {
    const { id_evento, configs } = req.body; // configs: [{ id_rol, id_usuario, es_propietario, envia_email, envia_web, cc_emails }]

    if (!id_evento || !Array.isArray(configs)) {
        return res.status(400).json({ message: 'Datos inválidos' });
    }

    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        
        // 1. Delete existing config in Architecture 3.0 Standard
        await transaction.request()
            .input('id_ev', sql.Numeric(10, 0), id_evento)
            .query('DELETE FROM cfg_notificacion_config WHERE id_evento = @id_ev');

        // 2. Fetch Event Info to check if it's transactional
        const eventInfoRes = await transaction.request()
            .input('id_ev', sql.Numeric(10, 0), id_evento)
            .query('SELECT codigo_evento, es_transaccional FROM mae_evento_notificacion WHERE id_evento = @id_ev');
        
        const eventInfo = eventInfoRes.recordset[0];

        // 3. Insert new config
        for (const c of configs) {
            await transaction.request()
                .input('id_ev', sql.Numeric(10, 0), id_evento)
                .input('email', sql.Bit, c.envia_email ?? 1)
                .input('web', sql.Bit, c.envia_web ?? 1)
                .input('rol', sql.Numeric(10, 0), c.id_rol || null)
                .input('usr', sql.Numeric(10, 0), c.id_usuario || null)
                .input('prop', sql.Bit, c.es_propietario ? 1 : 0)
                .input('cc', sql.VarChar(sql.MAX), c.cc_emails || null)
                .query(`
                    INSERT INTO cfg_notificacion_config (id_evento, envia_email, envia_web, id_rol, id_usuario, es_propietario, cc_emails)
                    VALUES (@id_ev, @email, @web, @rol, @usr, @prop, @cc)
                `);
        }

        // 4. SYNC: If transactional, update mae_notificacion_regla (Master Rules)
        if (eventInfo && eventInfo.es_transaccional && configs.length > 0) {
            const firstConfig = configs[0];
            await transaction.request()
                .input('code', sql.VarChar(50), eventInfo.codigo_evento)
                .input('email', sql.Bit, firstConfig.envia_email ?? 1)
                .input('web', sql.Bit, firstConfig.envia_web ?? 1)
                .query(`
                    UPDATE mae_notificacion_regla 
                    SET envia_email = @email,
                        envia_web = @web
                    WHERE codigo_evento = @code
                `);
            logger.info(`UNS Sync: Updated mae_notificacion_regla for ${eventInfo.codigo_evento} (Email: ${firstConfig.envia_email}, Web: ${firstConfig.envia_web})`);
        }

        await transaction.commit();
        res.json({ success: true, message: 'Configuración actualizada correctamente' });
    } catch (error) {
        await transaction.rollback();
        logger.error('Error in saveNotificationConfig:', error);
        res.status(500).json({ message: 'Error al guardar la configuración' });
    }
};
