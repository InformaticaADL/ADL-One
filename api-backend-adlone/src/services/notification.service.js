
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
            // Robust absolute path to logo using resolve
            const logoPath = path.resolve(process.cwd(), '../frontend-adlone/src/assets/images/logo-adlone.png');
            if (fs.existsSync(logoPath)) {
                this.logoBuffer = fs.readFileSync(logoPath);
                logger.info(`Logo ADL ONE loaded successfully from: ${logoPath}`);
            } else {
                // Try parent if cwd is not backend root
                const altPath = path.resolve(process.cwd(), '..', '..', 'frontend-adlone', 'src', 'assets', 'images', 'logo-adlone.png');
                if (fs.existsSync(altPath)) {
                    this.logoBuffer = fs.readFileSync(altPath);
                    logger.info(`Logo ADL ONE loaded successfully from alt path.`);
                } else {
                    logger.warn(`Logo NOT found at: ${logoPath}`);
                }
            }
        } catch (error) {
            logger.error('Error loading logo:', error);
        }
    }

    /**
     * Envía una notificación basada en un evento del sistema.
     * @param {string} eventCode - Código del evento (ej: 'FICHA_NUEVA').
     * @param {object} context - Datos para reemplazar en el template (ej: { correlativo: '123' }).
     * @param {string[]} directEmails - Opcional. Lista de correos directos a añadir.
     */
    async send(eventCode, context = {}, directEmails = [], options = {}) {
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
            let recipients = [];
            if (!options.skipLegacyDb) {
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
                recipients = recipientsResult.recordset;
            }
            // Removed premature return to allow directEmails (e.g. from URS)

            // 3. Resolver lista final de correos
            const emailList = {
                to: new Set(),
                cc: new Set(),
                bcc: new Set()
            };

            // REQUERIMIENTO ESTRICTO USUARIO (19-02-2026):
            // 1. Si NO hay destinatarios configurados en BD -> NO ENVIAR A NADIE (ni siquiera directEmails).
            // 2. Si HAY destinatarios en BD -> ENVIAR SÓLO A ELLOS (Ignorar directEmails y permisos dinámicos).
            // NOTA (16-03-2026): Para URS permitimos directEmails si vienen del motor UNS.
            if (recipients.length === 0 && (!directEmails || directEmails.length === 0)) {
                logger.info(`Notificación CANCELADA para ${eventCode}: No hay destinatarios configurados.`);
                return;
            }

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

            // Añadir directEmails (Phase 22: URS Integration)
            if (directEmails && directEmails.length > 0) {
                directEmails.forEach(email => this._addEmail(emailList, 'TO', email));
            }
            if (options.ccEmails && options.ccEmails.length > 0) {
                options.ccEmails.forEach(email => this._addEmail(emailList, 'CC', email));
            }

            // 4. Compilar Asunto y Cuerpo
            // Phase 28: Use CID for logo embedding
            const compileResult = this._compileTemplate(event.cuerpo_template_html || '<p>Notificación del Sistema ADL One</p>', context, true);
            const htmlBody = compileResult.html;
            const subject = this._compileTemplate(event.asunto_template, context, false).html;

            // 5. Enviar Correo
            const to = Array.from(emailList.to).join(', ');
            const cc = Array.from(emailList.cc).join(', ');
            const bcc = Array.from(emailList.bcc).join(', ');
            
            if (!to) {
                logger.warn(`Evento ${eventCode} tiene destinatarios pero ningún email válido resultó.`);
                return;
            }

            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.SMTP_FROM || '"ADL One" <notificaciones@adldiagnostic.cl>',
                to: to,
                cc: cc,
                bcc: bcc,
                subject: subject,
                html: htmlBody,
                attachments: compileResult.attachments || [] 
            };

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
     * @param {string} permissionCode - Código del permiso (ej: 'MA_SOLICITUDES').
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

    _compileTemplate(templateSource, context, isHtml = true) {
        let output = '';
        
        if (typeof templateSource === 'string') {
            output = templateSource;
        } else if (templateSource && typeof templateSource === 'object') {
            if (isHtml) {
                output = templateSource.cuerpo_template_html || templateSource.cuerpo_mensaje || templateSource.mensaje || '';
            } else {
                output = templateSource.asunto_template || templateSource.cuerpo_mensaje || templateSource.mensaje || '';
            }
        }

        const attachments = [];

        // 0. Pre-process context: Merge datos_json into top-level for easier placeholder access
        // Fix 5b: Guard datos_json — ensure it's always an object
        if (context.datos_json && typeof context.datos_json === 'string') {
            try {
                context.datos_json = JSON.parse(context.datos_json);
            } catch (e) {
                context.datos_json = {};
            }
        }
        if (context.datos_json && typeof context.datos_json === 'object') {
            for (const [k, v] of Object.entries(context.datos_json)) {
                if (!(k in context)) context[k] = v;
            }
        }

        // 1. Force replace LOGO_BASE64 and LOGO_URL in template with CID
        if (isHtml && this.logoBuffer) {
            const cid = 'logo_adlone';
            const logoPath = path.resolve(process.cwd(), '../frontend-adlone/src/assets/images/logo-adlone.png');
            
            output = output.split('{LOGO_BASE64}').join(`cid:${cid}`);
            output = output.split('{LOGO_URL}').join(`cid:${cid}`);
            
            attachments.push({
                filename: 'logo-adlone.png',
                content: this.logoBuffer,
                cid: cid
            });
        }

        // 2. Handle SERVICIOS_DETALLE (dynamic array processing)
        if (isHtml && context.servicios && Array.isArray(context.servicios)) {
            const serviciosHtml = context.servicios.map((servicio, index) => {
                const hasFechaChange = !!servicio.old_fecha;
                const hasInstalacionChange = !!servicio.old_muestreador_instalacion;
                const hasRetiroChange = !!servicio.old_muestreador_retiro;

                // Build HTML for each field with change detection
                const fechaHtml = hasFechaChange 
                    ? `<span style="color: #e53e3e; text-decoration: line-through; margin-right: 8px;">${servicio.old_fecha}</span> <span style="color: #2b6cb0; font-weight: bold;">➔ ${servicio.fecha_muestreo}</span>`
                    : `<span>${servicio.fecha_muestreo}</span>`;

                const instalacionHtml = hasInstalacionChange
                    ? `<span style="color: #e53e3e; text-decoration: line-through; margin-right: 8px;">${servicio.old_muestreador_instalacion}</span> <span style="color: #2b6cb0; font-weight: bold;">➔ ${servicio.muestreador_instalacion}</span>`
                    : `<span>${servicio.muestreador_instalacion}</span>`;

                const retiroHtml = hasRetiroChange
                    ? `<span style="color: #e53e3e; text-decoration: line-through; margin-right: 8px;">${servicio.old_muestreador_retiro}</span> <span style="color: #2b6cb0; font-weight: bold;">➔ ${servicio.muestreador_retiro}</span>`
                    : `<span>${servicio.muestreador_retiro}</span>`;

                return `
                <div style="margin-bottom: 15px; padding: 12px; background: white; border-left: 4px solid #0062a8; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <strong style="color: #0062a8; font-size: 14px; font-family: Arial, sans-serif;">Servicio ${servicio.numero}:</strong><br>
                    <div style="margin-top: 8px; color: #333; font-size: 13px; line-height: 1.6; font-family: Arial, sans-serif;">
                        <div style="margin-bottom: 4px;">📥 <strong>Instalación:</strong> ${instalacionHtml}</div>
                        <div style="margin-bottom: 4px;">📤 <strong>Retiro:</strong> ${retiroHtml}</div>
                        <div>📅 <strong>Fecha muestreo:</strong> ${fechaHtml}</div>
                    </div>
                </div>
                `;
            }).join('');

            output = output.replace(/\{servicios_detalle\}/gi, serviciosHtml);
        }

        // Add alias for Planta if present
        if (context.fuente_centro) {
            context.planta = context.fuente_centro;
        }

        // 2.1 Handle EQUIPOS_DETALLE (dynamic array processing for equipment)
        if (isHtml && (context.equipos || context.datos_json)) {
            let equiposHtml = '';
            
            // Legacy handling for arrays
            if (Array.isArray(context.equipos)) {
                equiposHtml = context.equipos.map((equipo, index) => {
                    if (equipo.isTransfer) {
                        return `
                            <div style="margin-bottom: 20px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                                <div style="background: white; color: #0062a8; padding: 10px 15px; font-weight: bold; font-family: Arial, sans-serif; font-size: 14px; border-bottom: 2px solid #0062a8;">
                                    ${equipo.nombre} <span style="font-weight: normal; color: #555;">[${equipo.codigo}]</span>
                                    <div style="font-size: 11px; margin-top: 2px; color: #666; font-weight: normal;">Tipo: ${equipo.tipo}</div>
                                </div>
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse: collapse;">
                                    <tr>
                                        <td width="50%" style="padding: 15px; border-right: 1px solid #e2e8f0; vertical-align: top; background-color: #f8fafc;">
                                            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold; margin-bottom: 8px; font-family: Arial;">Datos Actuales (Origen)</div>
                                            <div style="margin-bottom: 6px; font-family: Arial; font-size: 13px; color: #334155;">
                                                <div style="color: #94a3b8; font-size: 10px;">Ubicación:</div>
                                                <strong>${equipo.datos_antiguos?.ubicacion || '-'}</strong>
                                            </div>
                                            <div style="font-family: Arial; font-size: 13px; color: #334155;">
                                                <div style="color: #94a3b8; font-size: 10px;">Responsable:</div>
                                                <strong>${equipo.datos_antiguos?.responsable || '-'}</strong>
                                            </div>
                                        </td>
                                        <td width="50%" style="padding: 15px; vertical-align: top; background-color: #fff;">
                                            <div style="color: #0062a8; font-size: 11px; text-transform: uppercase; font-weight: bold; margin-bottom: 8px; font-family: Arial;">Nuevos Datos (Destino)</div>
                                            <div style="margin-bottom: 6px; font-family: Arial; font-size: 13px; color: #0f172a;">
                                                <div style="color: #94a3b8; font-size: 10px;">Nueva Ubicación:</div>
                                                <strong style="color: #0062a8;">${equipo.datos_nuevos?.ubicacion || '-'}</strong>
                                            </div>
                                            <div style="font-family: Arial; font-size: 13px; color: #0f172a;">
                                                <div style="color: #94a3b8; font-size: 10px;">Nuevo Responsable:</div>
                                                <strong style="color: #0062a8;">${equipo.datos_nuevos?.responsable || '-'}</strong>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        `;
                    } else {
                        return `
                            <div style="margin-bottom: 15px; padding: 12px; background: white; border-left: 4px solid #0062a8; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <strong style="color: #0062a8; font-size: 14px; font-family: Arial, sans-serif;">${equipo.nombre || 'Equipo'}</strong><br>
                                <div style="margin-top: 8px; color: #333; font-size: 13px; line-height: 1.6; font-family: Arial, sans-serif;">
                                    ${equipo.codigo ? `<div style="margin-bottom: 2px;">🏷️ <strong>Código:</strong> [${equipo.codigo}]</div>` : ''}
                                    ${equipo.tipo ? `<div style="margin-bottom: 2px;">🔧 <strong>Tipo:</strong> ${equipo.tipo}</div>` : ''}
                                    ${equipo.marca ? `<div style="margin-bottom: 2px;">🏢 <strong>Marca:</strong> ${equipo.marca} ${equipo.modelo ? `(${equipo.modelo})` : ''}</div>` : ''}
                                    ${equipo.serie ? `<div style="margin-bottom: 2px;">🔢 <strong>Serie:</strong> ${equipo.serie}</div>` : ''}
                                    ${equipo.ubicacion ? `<div style="margin-bottom: 2px;">📍 <strong>Ubicación Actual:</strong> ${equipo.ubicacion}</div>` : ''}
                                </div>
                            </div>
                        `;
                    }
                }).join('');
            } 
            // Phase 24/29: URS / Specialized handling from datos_json
            else if (context.datos_json) {
                const dj = context.datos_json;
                
                // Case: Deshabilitar Muestreador (Specific handling)
                if (dj.muestreador_origen_nombre) {
                    let transferDetail = '';
                    if (dj.tipo_traspaso === 'BASE') {
                        transferDetail = `<div><strong>Base Destino:</strong> ${dj.base_destino || 'No especificada'}</div>`;
                    } else if (dj.tipo_traspaso === 'MUESTREADOR' || dj.tipo_traspaso === 'IGUAL') {
                        transferDetail = `<div><strong>Nuevo Muestreador:</strong> ${dj.muestreador_destino_nombre || 'No especificado'}</div>`;
                    } else if (dj.tipo_traspaso === 'MANUAL' && Array.isArray(dj.reasignacion_manual)) {
                        const rows = dj.reasignacion_manual.map(m => `
                            <tr style="border-bottom: 1px solid #edf2f7;">
                                <td style="padding: 6px 0; font-size: 13px; text-align: left;">${m.nombre_equipo || 'Equipo'}</td>
                                <td style="padding: 6px 0; font-size: 13px; text-align: left;">${m.codigo_equipo || '-'}</td>
                                <td style="padding: 6px 0; font-size: 13px; color: #0062a8; font-weight: bold; text-align: left;">${m.nombre_muestreador_nuevo || 'Sin asignar'}</td>
                            </tr>
                        `).join('');
                        
                        transferDetail = `
                            <div style="margin-top: 10px;">
                                <strong style="display: block; margin-bottom: 5px;">Reasignación Manual:</strong>
                                <table width="100%" style="border-collapse: collapse; margin-top: 5px; table-layout: fixed;">
                                    <thead>
                                        <tr style="border-bottom: 2px solid #0062a8; text-align: left; font-size: 11px; color: #64748b;">
                                            <th style="padding: 4px 0; text-align: left; width: 35%;">Equipo</th>
                                            <th style="padding: 4px 0; text-align: left; width: 35%;">Cód.</th>
                                            <th style="padding: 4px 0; text-align: left; width: 30%;">Nuevo Resp.</th>
                                        </tr>
                                    </thead>
                                    <tbody>${rows}</tbody>
                                </table>
                            </div>
                        `;
                    }

                    equiposHtml = `
                        <div style="padding: 15px; margin-top: 15px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <h4 style="margin: 0 0 10px 0; color: #0062a8; font-size: 15px;">Detalle Solicitud:</h4>
                            <div style="margin-bottom: 8px; font-size: 14px; color: #333;">
                                <div><strong>Muestreador a deshabilitar:</strong> ${dj.muestreador_origen_nombre}</div>
                                <div><strong>Tipo de traspaso de equipos:</strong> ${dj.tipo_traspaso}</div>
                                ${transferDetail}
                            </div>
                        </div>
                    `;
                } else {
                    // Generic handling for other URS request types (Formulario dinámico)
                    const keysToSkip = [
                        'muestreador_origen_id', 'muestreador_origen_nombre', 'tipo_traspaso', 'base_destino', 
                        'muestreador_destino_id', 'muestreador_destino_nombre', 'reasignacion_manual', 'id_equipo', 
                        'id_equipo_original', 'fecha_traspaso', 'form_type', '_form_type', 'formType', 'formtype',
                        'id_muestreador_destino', 'info_actual', 'traspaso_de', 'id_solicitante', 'id_centro_destino',
                        'nombre_equipo', 'nombre_equipo_full', 'encargado_actual', 'ubicacion_actual',
                        'id_tecnico', 'idTecnico', 'origen_solicitud', 'codigo_equipo', 'id_muestreador',
                        'id_muestreo', 'id_ficha', 'relacion_tipo', 'num_ficha', 'id_tipo_aviso'
                    ];
                    
                    const details = Object.entries(dj)
                        .filter(([key]) => !keysToSkip.includes(key) && typeof dj[key] !== 'object' && dj[key] !== null && dj[key] !== '' && dj[key] !== 'N/A')
                        .map(([key, val]) => {
                            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            
                            // Specific Traspaso Hide Logic based on traspaso_de array
                            if (dj._form_type === 'TRASPASO_EQUIPO' && Array.isArray(dj.traspaso_de)) {
                                if (key === 'nombre_centro_destino' && !dj.traspaso_de.includes('UBICACION')) return '';
                                if (key === 'nombre_muestreador_destino' && !dj.traspaso_de.includes('RESPONSABLE')) return '';
                            }

                            // Fix text formatting (DAÑO, DD-MM-YYYY)
                            let displayVal = val;
                            if (typeof val === 'string' && val.trim().toUpperCase() === 'DANIO') displayVal = 'DAÑO';
                            
                            // Date formatting logic (shared)
                            const formatDate = (dateStr) => {
                                if (typeof dateStr !== 'string') return dateStr;
                                if (/^\d{4}-\d{2}-\d{2}(\D.*)?$/.test(dateStr)) {
                                    const parts = dateStr.split(/\D/);
                                    if (parts.length >= 3 && parts[0].length === 4) {
                                        return `${parts[2]}-${parts[1]}-${parts[0]}`;
                                    }
                                }
                                return dateStr;
                            };

                            displayVal = formatDate(displayVal);
                            
                            return `<div style="margin-bottom: 6px;"><strong>${label}:</strong> <span style="color: #475569;">${displayVal}</span></div>`;
                        }).join('');

                    // Field Prioritization for Header (V16 Robustness)
                    // Robust type detection with accent normalization (V19.2)
                    const cleanTipo = (context.TIPO_SOLICITUD || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const isFicha = cleanTipo.includes('FICHA') || 
                                    cleanTipo.includes('CANCELACION') || 
                                    cleanTipo.includes('ANULACION') || 
                                    [12, 15].includes(Number(context.id_tipo)) ||
                                    (dj.relacion_tipo || '').toUpperCase() === 'SERVICIO' ||
                                    (dj.relacion_tipo || '').toUpperCase() === 'FICHA' ||
                                    (context.relacion_tipo || '').toUpperCase() === 'SERVICIO';
                    
                    const eqName = isFicha 
                        ? (dj.id_ficha || dj.num_ficha || context.equipo_nombre || context.nombre_equipo_full || dj.id_muestreo || dj.correlativo || 'N/A')
                        : (context.equipo_nombre || context.nombre_equipo_full || dj.nombre_equipo_full || dj.equipo_nombre || dj.nombre_equipo || 'N/A');
                    
                    const eqCode = context.codigo_equipo || context.codigo_equipo_db || dj.codigo_equipo || dj.codigo_equipo_db || '';
                    
                    const labelHeader = isFicha ? 'Servicio:' : 'Equipo:';
                    
                    if (details.trim() || eqName !== 'N/A') {
                        const eqNameStr = String(eqName);
                        const displayTitle = eqNameStr.includes('[') ? eqNameStr : `${eqNameStr}${eqCode ? ` [${eqCode}]` : ''}`;
                        equiposHtml = `
                            <div style="padding: 15px; margin-top: 15px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <h4 style="margin: 0 0 12px 0; color: #0062a8; font-size: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">Detalle de la Solicitud:</h4>
                                <div style="font-size: 14px; color: #1e293b;">
                                    ${eqName !== 'N/A' ? `<div style="margin-bottom: 10px; font-size: 15px;"><strong>${labelHeader}</strong> <span style="color: #0062a8; font-weight: bold;">${displayTitle}</span></div>` : ''}
                                    ${details}
                                </div>
                            </div>
                        `;
                    }
                }
            }

            // AVOID DUPLICATION: If the template already contains specific URS placeholders or markers,
            // we should NOT inject the automatic block unless {EQUIPOS_DETALLE} is explicitly present.
            // AVOID DUPLICATION: Check for specific placeholders. 
            // V17: Loosened regex and added DETALLE_SOLICITUD synonym support.
            const hasSpecificPlaceholders = /\{muestreador_(origen|destino)_nombre\}|\{tipo_traspaso\}/i.test(output);
            const shouldInject = !hasSpecificPlaceholders || output.includes('{EQUIPOS_DETALLE}') || output.includes('{DETALLE_SOLICITUD}');

            if (equiposHtml && shouldInject) {
                if (output.includes('{EQUIPOS_DETALLE}')) {
                    output = output.split('{EQUIPOS_DETALLE}').join(equiposHtml);
                } else if (output.includes('{DETALLE_SOLICITUD}')) {
                    output = output.split('{DETALLE_SOLICITUD}').join(equiposHtml);
                } else {
                    const injectionHtml = `
                        <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                            ${equiposHtml}
                        </div>
                    `;
                    // Fix 1: Inject BEFORE the firma/footer section, not after it
                    // Look for the firma marker (ADL Diagnostic / Sistema de Gestión) and inject before it
                    const firmaMarkers = ['ADL Diagnostic', 'Sistema de Gesti', 'Laboratorio de Diagn'];
                    let injected = false;
                    for (const marker of firmaMarkers) {
                        const markerIdx = output.indexOf(marker);
                        if (markerIdx > 0) {
                            // Find the start of the containing element (td, div, p) before the marker
                            const searchArea = output.substring(Math.max(0, markerIdx - 500), markerIdx);
                            // Find the last closing tag before this marker's container
                            const lastTdClose = searchArea.lastIndexOf('</td>');
                            const lastDivClose = searchArea.lastIndexOf('</div>');
                            const bestClose = Math.max(lastTdClose, lastDivClose);
                            if (bestClose > -1) {
                                const actualIdx = Math.max(0, markerIdx - 500) + bestClose;
                                const tag = output.substring(actualIdx, actualIdx + 6) === '</div>' ? '</div>' : '</td>';
                                output = output.substring(0, actualIdx + tag.length) + injectionHtml + output.substring(actualIdx + tag.length);
                                injected = true;
                                break;
                            }
                        }
                    }
                    // Fallback: if no firma found, inject before </body> or append
                    if (!injected) {
                        if (output.includes('</body>')) {
                            output = output.replace('</body>', `${injectionHtml}</body>`);
                        } else if (output.includes('</html>')) {
                            output = output.replace('</html>', `${injectionHtml}</html>`);
                        } else {
                            output += injectionHtml;
                        }
                    }
                }
            }
        }

        // 2.2 Handle Dynamic Observation Block {BLOQUE_OBSERVACION|Label}
        output = output.replace(/\{BLOQUE_OBSERVACION\|(.*?)\}/g, (match, label) => {
            // Handle nested placeholder in label (e.g. {ETIQUETA_OBSERVACION})
            let finalLabel = label;
            if (label.includes('ETIQUETA_OBSERVACION')) {
                finalLabel = context.ETIQUETA_OBSERVACION || 'Observaciones';
            }
            
            const obs = context.OBSERVACION;
            if (obs && obs.trim() !== '' && obs.trim().toLowerCase() !== 'sin observaciones' && obs.trim().toLowerCase() !== 'no especificado') {
                if (!isHtml) return `${finalLabel}: ${obs}`;
                return `<div style="margin-top:30px;padding:15px;background-color:#fffbf5;border-left:4px solid #0062a8;color:#666666;font-size:14px;font-family:Arial,sans-serif;"><strong>${finalLabel}:</strong><br>${obs}</div>`;
            }
            return '';
        });

        // 3. Replace all other placeholders
        for (const [key, value] of Object.entries(context)) {
            if (key === 'servicios' || key === 'equipos' || key === 'datos_json') continue;
            
            let val = value !== null && value !== undefined ? String(value) : '';
            
            // Auto-format dates in all replacements (YYYY-MM-DD -> DD-MM-YYYY)
            if (/^\d{4}-\d{2}-\d{2}(\D.*)?$/.test(val)) {
                const parts = val.split(/\D/);
                if (parts.length >= 3 && parts[0].length === 4) {
                    val = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            }
            
            // Replacement (Restore flexibility while allowing case-insensitive matches - V15)
            output = output.split(`{${key}}`).join(val);
            output = output.split(`{${key.toUpperCase()}}`).join(val);
        }

        // 4. Global fallback for any remaining ISO dates in the final HTML
        if (isHtml) {
            output = output.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3-$2-$1');
        }

        // 5. Final Clean-up: Remove any remaining placeholders {...} to avoid showing code to user
        if (isHtml) {
            // Keep {LOGO_BASE64} if it hasn't been replaced yet (though it should be)
            output = output.replace(/\{(?!LOGO_BASE64)[A-Z0-9_\-| ]+\}/gi, '');
        }

        return { html: output, attachments };
    }
}

export default new NotificationService();
