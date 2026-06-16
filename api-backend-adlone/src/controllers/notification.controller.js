import { getConnection } from '../config/database.js';
import sql from '../config/database.js';
import logger from '../utils/logger.js';
import unsService from '../services/uns.service.js';
import transporter from '../config/mailer.js';
import auditService from '../services/audit.service.js';
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
        await transporter().verify();
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
        const adminId = req.user.id || req.user.id_usuario;
        logger.info(`[TEST] Notificación de prueba para evento: ${eventCode} — solo enviada al admin ID ${adminId}`);

        // dryRun: only notify the admin triggering the test, never real recipients
        await unsService.sendWebNotification(
            adminId,
            `[PRUEBA] ${eventCode}`,
            `Prueba exitosa del evento "${eventCode}". Los destinatarios reales NO fueron notificados.`,
            'INFO',
            null,
            'test'
        );

        res.json({
            success: true,
            message: `Notificación de prueba enviada solo a ti. Los destinatarios reales no fueron afectados.`
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
                const logoPath = path.resolve(__dirname, '../assets/logo-adlone.png');

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

        await transporter().sendMail(mailOptions);

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

        // 4. SYNC: If transactional, update or insert mae_notificacion_regla (Master Rules)
        if (eventInfo && eventInfo.es_transaccional) {
            const firstConfig = configs.length > 0 ? configs[0] : { envia_email: 0, envia_web: 0 };
            await transaction.request()
                .input('code', sql.VarChar(50), eventInfo.codigo_evento)
                .input('email', sql.Bit, firstConfig.envia_email ?? 0)
                .input('web', sql.Bit, firstConfig.envia_web ?? 0)
                .query(`
                    IF EXISTS (SELECT 1 FROM mae_notificacion_regla WHERE codigo_evento = @code)
                    BEGIN
                        UPDATE mae_notificacion_regla 
                        SET envia_email = @email,
                            envia_web = @web
                        WHERE codigo_evento = @code
                    END
                    ELSE
                    BEGIN
                        INSERT INTO mae_notificacion_regla (codigo_evento, envia_email, envia_web, estado)
                        VALUES (@code, @email, @web, 1)
                    END
                `);
            logger.info(`UNS Sync: Updated/Inserted mae_notificacion_regla for ${eventInfo.codigo_evento} (Email: ${firstConfig.envia_email ?? 0}, Web: ${firstConfig.envia_web ?? 0})`);
        }

        await transaction.commit();

        const adminId = req.user?.id || req.user?.id_usuario || 0;
        auditService.log({
            usuario_id: adminId,
            area_key: 'it',
            modulo_nombre: 'Notificaciones',
            evento_tipo: 'NOTIFICATION_CONFIG_SAVE',
            entidad_nombre: 'cfg_notificacion_config',
            entidad_id: String(id_evento),
            descripcion_humana: `${req.user?.nombre_usuario || `ID:${adminId}`} actualizó la configuración del evento de notificación ID ${id_evento} (${configs.length} destinatarios)`,
            datos_nuevos: { id_evento, configs },
            severidad: 1
        });

        res.json({ success: true, message: 'Configuración actualizada correctamente' });
    } catch (error) {
        await transaction.rollback();
        logger.error('Error in saveNotificationConfig:', error);
        res.status(500).json({ message: 'Error al guardar la configuración' });
    }
};

import notificationService from '../services/notification.service.js';

// TEMPORARY: Email Viewer
export const previewIndex = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT codigo_evento, asunto_template FROM mae_evento_notificacion ORDER BY codigo_evento');
        
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Visor de Correos ADL</title>
            <style>
                body { font-family: -apple-system, sans-serif; background: #f8fafc; padding: 40px; color: #334155; }
                h1 { color: #0f172a; margin-bottom: 20px; }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
                .card { background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; text-decoration: none; color: inherit; display: block; transition: all 0.2s; }
                .card:hover { border-color: #3b82f6; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); transform: translateY(-2px); }
                .code { font-size: 13px; color: #64748b; font-weight: 600; margin-bottom: 4px; }
                .subject { font-size: 15px; color: #0f172a; }
            </style>
        </head>
        <body>
            <h1>Visor de Correos (Eventos)</h1>
            <div class="grid">
        `;
        
        for (const row of result.recordset) {
            html += `
                <a href="/api/notifications/preview/${row.codigo_evento}" class="card" target="_blank">
                    <div class="code">${row.codigo_evento}</div>
                    <div class="subject">${row.asunto_template || 'Sin asunto'}</div>
                </a>
            `;
        }
        
        html += `</div></body></html>`;
        res.send(html);
    } catch (err) {
        res.status(500).send('Error loading index');
    }
};

export const previewEventHTML = async (req, res) => {
    const { eventCode } = req.params;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('code', sql.VarChar(50), eventCode)
            .query('SELECT * FROM mae_evento_notificacion WHERE codigo_evento = @code');
            
        if (result.recordset.length === 0) return res.status(404).send('Not found');
        const event = result.recordset[0];
        
        // Dummy Context
        const dummyContext = {
            correlativo: '12345',
            CORRELATIVO: '12345',
            usuario: 'Juan Pérez',
            USUARIO: 'Juan Pérez',
            fecha: '10 de junio de 2026',
            FECHA: '10 de junio de 2026',
            hora: '14:30',
            HORA: '14:30',
            ACCION_AREA: 'Aprobación / Creación de Prueba',
            TIPO_FICHA_INFO: 'Agua/RIL - Compuesta',
            BASE_OPERACIONES: 'Base Puerto Montt',
            EMPRESA_FACTURAR: 'Salmones Antártica S.A.',
            EMPRESA_SERVICIO: 'Servicios Acuícolas SpA',
            FUENTE_EMISORA: 'Piscicultura Río Blanco',
            OBJETIVO_MUESTREO: 'Monitoreo Mensual D.S. 90',
            OBSERVACION: 'Este es un texto de prueba para la simulación del correo electrónico en el visualizador temporal.',
            servicios_detalle: '<table width="100%" border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; border-color: #cbd5e1; font-size: 13px; text-align: left;"><thead><tr style="background-color: #f1f5f9;"><th style="padding: 8px;">Nº</th><th style="padding: 8px;">Instalación</th><th style="padding: 8px;">Muestreador (Inst.)</th><th style="padding: 8px;">Retiro</th><th style="padding: 8px;">Muestreador (Ret.)</th></tr></thead><tbody><tr><td style="padding: 8px;">1</td><td style="padding: 8px;">12-06-2026</td><td style="padding: 8px;">Carlos Ríos</td><td style="padding: 8px;">14-06-2026</td><td style="padding: 8px;">No asignado</td></tr><tr><td style="padding: 8px;">2</td><td style="padding: 8px;">15-06-2026</td><td style="padding: 8px;">Carlos Ríos</td><td style="padding: 8px;">17-06-2026</td><td style="padding: 8px;">Carlos Ríos</td></tr></tbody></table>',
            servicios: [
                { numero: 1, fecha_muestreo: '12-06-2026', fecha_retiro: '14-06-2026', muestreador_instalacion: 'Carlos Ríos', muestreador_retiro: 'No asignado' },
                { numero: 2, fecha_muestreo: '15-06-2026', fecha_retiro: '17-06-2026', muestreador_instalacion: 'Carlos Ríos', muestreador_retiro: 'Carlos Ríos' }
            ],
            SOLICITANTE: 'Juan Solicitante Pérez',
            RESPONSABLE: 'Técnico Responsable Gómez'
        };

        // Generar un array de equipos dinámico según el tipo de evento para que la vista previa sea realista
        let dummyEquipos = [];
        if (eventCode.includes('NUEVO_EQUIPO')) {
            dummyEquipos = [{
                nombre: 'Multiparámetro de Campo',
                tipo: 'Multiparámetro',
                marca: 'YSI',
                modelo: 'ProDSS',
                serie: 'SN-12345',
                fecha_adquisicion: '2026-06-15',
                status: 'SOLICITADO'
            }];
        } else if (eventCode.includes('ALTA')) {
            dummyEquipos = [{
                nombre: 'Sensor de Oxígeno Disuelto',
                codigo: 'OD-003',
                tipo: 'Sensor OD',
                ubicacion: 'Piscicultura Río Blanco',
                vigencia: '2026-12-31',
                status: 'SOLICITADO'
            }];
        } else if (eventCode.includes('TRASPASO') || eventCode.includes('DESHABILITAR')) {
            // No se usa dummyEquipos como array para Traspasos/Deshabilitar de Muestreadores
            dummyEquipos = null;
            if (eventCode.includes('DESHABILITAR')) {
                dummyContext.datos_json = {
                    muestreador_origen_nombre: 'Pedro Díaz',
                    tipo_traspaso: 'BASE',
                    base_destino: 'Base Sur',
                    _form_type: 'DESHABILITAR_MUESTREADOR'
                };
            } else {
                dummyContext.datos_json = {
                    nombre_equipo_full: 'Termómetro Infrarrojo [TERM-IR-02]',
                    sede_actual: 'Base Norte',
                    nombre_centro_destino: 'Base Sur',
                    responsable_actual: 'Pedro Díaz',
                    nombre_muestreador_destino: 'María López',
                    traspaso_de: eventCode.includes('SEDE') ? ['UBICACION'] : (eventCode.includes('MUESTREADOR') ? ['RESPONSABLE'] : ['UBICACION', 'RESPONSABLE']),
                    _form_type: 'TRASPASO_EQUIPO'
                };
            }
            dummyEquipos = [{
                nombre: 'Turbidímetro Portátil',
                codigo: 'TURB-05',
                motivo_baja: 'Obsolescencia Técnica',
                fecha_baja: '2026-06-10',
                status: 'SOLICITADO'
            }];
        } else if (eventCode.includes('REPORTE_PROBLEMA')) {
            dummyEquipos = [{
                nombre: 'Sensor de pH',
                codigo: 'PH-10',
                asunto: 'Fallo en calibración',
                categoria_problema: 'CALIBRACION',
                gravedad: 'ALTO',
                descripcion_problema: 'El equipo no retiene la calibración después de 2 horas de uso en terreno.',
                status: 'SOLICITADO'
            }];
        } else {
            // Genérico
            dummyEquipos = [{
                nombre: 'Equipo Estándar',
                codigo: 'EQ-000',
                status: 'SOLICITADO'
            }];
        }
        
        dummyContext.equipos = dummyEquipos;
        
        // Add more older form mappings
        dummyContext.MOTIVO = 'Revisión periódica';
        dummyContext.CLIENTE = 'Salmones Antártica S.A.';
        
        let baseTemplate = '';
        try {
            baseTemplate = fs.readFileSync(path.resolve(__dirname, '../templates/base_email.html'), 'utf8');
        } catch (e) {}

        let rawHtml = event.cuerpo_template_html || '<p>Notificación del Sistema</p>';
        dummyContext.THEME_COLOR = eventCode.includes('RECH') || eventCode.includes('CANCEL') ? '#e11d48' : (eventCode.includes('APR') ? '#0d9488' : '#0062a8');
        dummyContext.THEME_BG = eventCode.includes('RECH') || eventCode.includes('CANCEL') ? '#ffe4e6' : (eventCode.includes('APR') ? '#f0fdf4' : '#f0f9ff');
        dummyContext.THEME_BORDER = eventCode.includes('RECH') || eventCode.includes('CANCEL') ? '#fda4af' : (eventCode.includes('APR') ? '#bbf7d0' : '#bae6fd');
        dummyContext.TITLE = notificationService._compileTemplate(event.asunto_template || '', dummyContext, false).html;
        
        let finalHtml = '';
        if (baseTemplate && !rawHtml.includes('<!DOCTYPE html>')) {
            const innerHtml = notificationService._compileTemplate(rawHtml, dummyContext, true).html;
            dummyContext.EMAIL_CONTENT = innerHtml;
            finalHtml = notificationService._compileTemplate(baseTemplate, dummyContext, true).html;
        } else {
            finalHtml = notificationService._compileTemplate(rawHtml, dummyContext, true).html;
        }
        
        res.send(finalHtml);
    } catch (err) {
        logger.error('Error in preview:', err);
        res.status(500).send('Error rendering preview: ' + err.message);
    }
};
