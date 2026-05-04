import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';
import notificationService from './notification.service.js';
import { getIo } from '../utils/socketManager.js';

class UnsService {
    /**
     * Dispara una notificación basada en un evento y datos contextuales
     * @param {string} codigoEvento - Código del evento (ej: 'SOLICITUD_NUEVA')
     * @param {object} context - Datos para completar las plantillas
     */
    async trigger(codigoEvento, context = {}) {
        try {
            logger.info(`UNS Trigger Architecture 3.0: ${codigoEvento}`);
            const pool = await getConnection();

            // 0. Robust Actor Resolution (get email too)
            const actorId = Number(context.id_usuario_accion || context.id_usuario || 0);
            let actorEmail = null;
            if (actorId && actorId !== 0) {
                const actorRes = await pool.request()
                    .input('aid', sql.Numeric(10, 0), actorId)
                    .query('SELECT correo_electronico FROM mae_usuario WHERE id_usuario = @aid');
                if (actorRes.recordset.length > 0) {
                    actorEmail = actorRes.recordset[0].correo_electronico;
                }
            }
            if (actorEmail) context.actorEmail = actorEmail; // Pass to sub-methods

            // 1. Obtener Reglas 3.0 (mae_notificacion_regla)
            const rulesRes = await pool.request()
                .input('code', sql.VarChar(50), codigoEvento)
                .input('idTipo', sql.Numeric(10, 0), context.id_tipo || null)
                .query(`
                    SELECT * FROM mae_notificacion_regla 
                    WHERE codigo_evento = @code 
                    AND (id_tipo_solicitud = @idTipo OR id_tipo_solicitud IS NULL)
                    AND estado = 1
                `);
            const rules = rulesRes.recordset;

            // Sort rules by specificity (Priority: User > Role > Area > Global)
            rules.sort((a, b) => {
                const scoreA = (a.id_usuario_destino ? 100 : 0) + (a.id_rol_destino ? 50 : 0) + (a.area_destino ? 20 : 0);
                const scoreB = (b.id_usuario_destino ? 100 : 0) + (b.id_rol_destino ? 50 : 0) + (b.area_destino ? 20 : 0);
                return scoreB - scoreA;
            });

            logger.info(`UNS: ${rules.length} reglas encontradas para ${codigoEvento}`);

            // 2. Ejecutar Dispatcher SQL (Architecture 1.0/2.0 compatible)
            // Fallback: use parent event code for dispatch if event is a sub-variant
            const dispatchCode = codigoEvento === 'FICHA_REMUESTREO_CREADA' ? 'FICHA_CREADA' : codigoEvento;
            const dispatchRes = await pool.request()
                .input('codigo_evento', sql.VarChar(50), dispatchCode)
                .input('id_usuario_accion', sql.Numeric(10, 0), context.id_usuario_accion || context.id_usuario || 0)
                .input('id_usuario_propietario', sql.Numeric(10, 0), context.id_usuario_propietario || null)
                .execute('sp_DespacharNotificacion');

            // 3. Resolución Dinámica de Destinatarios (Architecture 3.0 + URS Permissions)
            const recipientsById = new Map(); // id -> { id_usuario, web, email, regla }

            // Add From SQL Dispatcher (Legacy/Global)
            dispatchRes.recordset.forEach(r => {
                recipientsById.set(Number(r.id_usuario), {
                    id_usuario: Number(r.id_usuario),
                    web: !!r.web,
                    email: !!r.email
                });
            });

            // Add From Rules 3.0 + Permissions (JS Resolution)
            const resolvedFromRules = await this._resolveDestinatarios(pool, rules, context, codigoEvento);
            resolvedFromRules.forEach(r => {
                const existing = recipientsById.get(r.id_usuario);
                if (existing) {
                    existing.web = existing.web || r.web;
                    existing.email = existing.email || r.email;
                    if (r.regla) existing.regla = r.regla;
                } else {
                    recipientsById.set(r.id_usuario, r);
                }
            });

            // Architecture 3.0 Fix: If a recipient has NO rule attached but we have rules for this event,
            // assign the first available rule to ensure we use the DB templates instead of hardcoded ones.
            const primaryRule = rules.length > 0 ? rules[0] : null;

            // Fallback for comment events: if no recipients resolved from DB rules or SP,
            // check rel_solicitud_tipo_notificacion and notify request owner + GESTION users.
            if (recipientsById.size === 0 && codigoEvento === 'SOLICITUD_COMENTARIO_NUEVO') {
                try {
                    const actorId = Number(context.id_usuario_accion || context.id_usuario || 0);

                    // Check per-type notification config
                    const notifCfgRes = await pool.request()
                        .input('idTipo', sql.Numeric(10, 0), context.id_tipo || null)
                        .query(`SELECT notifica_web, notifica_email FROM rel_solicitud_tipo_notificacion 
                                WHERE id_tipo = @idTipo AND accion = 'COMENTARIO'`);

                    const webEnabled = notifCfgRes.recordset.length === 0 || notifCfgRes.recordset[0].notifica_web;
                    const emailEnabled = notifCfgRes.recordset.length > 0 && notifCfgRes.recordset[0].notifica_email;

                    if (webEnabled) {
                        // Always notify request owner
                        const ownerId = Number(context.id_usuario_propietario || context.id_solicitante || 0);
                        if (ownerId && ownerId !== actorId) {
                            recipientsById.set(ownerId, { id_usuario: ownerId, web: true, email: emailEnabled });
                        }

                        // Also notify all users with GESTION permission for this request type
                        if (context.id_tipo) {
                            const gestoresRes = await pool.request()
                                .input('idTipo', sql.Numeric(10, 0), context.id_tipo)
                                .query(`
                                    SELECT DISTINCT u.id_usuario FROM rel_solicitud_tipo_permiso p
                                    JOIN rel_usuario_rol ur ON p.id_rol = ur.id_rol
                                    JOIN mae_usuario u ON u.id_usuario = ur.id_usuario
                                    WHERE p.id_tipo = @idTipo AND p.tipo_acceso = 'GESTION' AND u.habilitado = 'S'
                                    UNION
                                    SELECT p2.id_usuario FROM rel_solicitud_tipo_permiso p2
                                    WHERE p2.id_tipo = @idTipo AND p2.id_usuario IS NOT NULL AND p2.tipo_acceso = 'GESTION'
                                `);
                            gestoresRes.recordset.forEach(r => {
                                const uid = Number(r.id_usuario);
                                if (uid && uid !== actorId && !recipientsById.has(uid)) {
                                    recipientsById.set(uid, { id_usuario: uid, web: true, email: emailEnabled });
                                }
                            });
                        }
                        logger.info(`UNS Fallback COMENTARIO: ${recipientsById.size} destinatarios resueltos para solicitud #${context.id_solicitud}`);
                    }
                } catch (fbErr) {
                    logger.warn('UNS: Error en fallback de comentario:', fbErr.message);
                }
            }

            const recipients = Array.from(recipientsById.values()).map(r => {
                if (!r.regla && primaryRule) {
                   return { ...r, regla: primaryRule };
                }
                return r;
            });
            logger.info(`UNS: ${recipients.length} destinatarios resueltos para ${codigoEvento} (id_tipo: ${context.id_tipo || 'N/A'})`);
            if (recipients.length === 0) {
                logger.info(`[UNS] No hay destinatarios para evento: ${codigoEvento} (id_tipo: ${context.id_tipo || 'N/A'})`);
                return;
            }


            // Global CC for Email
            const globalCC = dispatchRes.recordset[0]?.global_cc || null;

            const defaultWebTemplates = {
                'SOLICITUD_NUEVA': {
                    titulo: 'Nueva Solicitud: {{nombre_tipo}}',
                    asunto_template: 'Nueva Solicitud: {{nombre_tipo}}',
                    mensaje: 'Recibida #{{id_solicitud}} de {{solicitante}}. Prioridad: {{prioridad}}',
                    cuerpo_mensaje: 'Recibida #{{id_solicitud}} de {{solicitante}}. Prioridad: {{prioridad}}'
                },
                'SOLICITUD_ESTADO_CAMBIO': {
                    titulo: 'Estado Actualizado: #{{correlativo}}',
                    asunto_template: 'Solicitud #{{correlativo}} {{estado}}',
                    mensaje: 'Tu solicitud ha cambiado a estado: {{estado_legible}}. {{usuario_accion}}: {{observaciones}}',
                    cuerpo_mensaje: 'La solicitud #{{correlativo}} de {{nombre_tipo}} ha sido {{estado}} por {{usuario_accion}}'
                },
                'SOLICITUD_COMENTARIO_NUEVO': {
                    titulo: 'Nuevo Mensaje en #{{correlativo}}',
                    asunto_template: 'Nuevo Mensaje en #{{correlativo}}',
                    mensaje: 'Has recibido un nuevo comentario de {{usuario_accion}} en tu solicitud.',
                    cuerpo_mensaje: 'Has recibido un nuevo comentario de {{usuario_accion}} en tu solicitud.'
                },
                'SOLICITUD_DERIVACION': {
                    titulo: 'Solicitud #{{correlativo}} Derivada',
                    asunto_template: 'Solicitud #{{correlativo}} Derivada',
                    mensaje: 'La solicitud #{{correlativo}} te ha sido derivada por {{usuario_accion}}',
                    cuerpo_mensaje: 'La solicitud #{{correlativo}} te ha sido derivada por {{usuario_accion}}'
                },
                'SOL_TRASPASO_MUESTREADOR_NUEVA': {
                    titulo: 'Nueva Solicitud: Traspaso de Equipo',
                    asunto_template: 'Nueva Solicitud: Traspaso de Equipo',
                    mensaje: '{{usuario_accion}} ha solicitado el traspaso del equipo {{equipo_nombre}} a {{nombre_muestreador_destino}}',
                    cuerpo_mensaje: '{{usuario_accion}} ha solicitado el traspaso del equipo {{equipo_nombre}} a {{nombre_muestreador_destino}}'
                },
                'SOL_TRASPASO_SEDE_NUEVA': {
                    titulo: 'Nueva Solicitud: Traspaso de Ubicación',
                    asunto_template: 'Nueva Solicitud: Traspaso de Ubicación',
                    mensaje: '{{usuario_accion}} ha solicitado el traspaso del equipo {{equipo_nombre}} a {{nombre_centro_destino}}',
                    cuerpo_mensaje: '{{usuario_accion}} ha solicitado el traspaso del equipo {{equipo_nombre}} a {{nombre_centro_destino}}'
                },
                'SOL_TRASPASO_AMBOS_NUEVA': {
                    titulo: 'Nueva Solicitud: Traspaso de Equipo',
                    asunto_template: 'Nueva Solicitud: Traspaso de Equipo',
                    mensaje: '{{usuario_accion}} ha solicitado el traspaso del equipo {{equipo_nombre}}',
                    cuerpo_mensaje: '{{usuario_accion}} ha solicitado el traspaso del equipo {{equipo_nombre}}'
                },
                'SOL_DESHABILITAR_MUESTREADOR_NUEVA': {
                    titulo: 'Nueva Solicitud: Deshabilitar Muestreador',
                    asunto_template: 'Nueva Solicitud: Deshabilitar Muestreador',
                    mensaje: '{{usuario_accion}} solicita deshabilitar a {{muestreador_origen_nombre}}',
                    cuerpo_mensaje: '{{usuario_accion}} solicita deshabilitar a {{muestreador_origen_nombre}}'
                },
                'SOL_EQUIPO_BAJA_NUEVA': {
                    titulo: 'Nueva Solicitud: Baja de Equipo',
                    asunto_template: 'Nueva Solicitud: Baja de Equipo',
                    mensaje: '{{usuario_accion}} ha solicitado la baja del equipo {{equipo_nombre}}',
                    cuerpo_mensaje: '{{usuario_accion}} ha solicitado la baja del equipo {{equipo_nombre}}'
                },
                'SOL_EQUIPO_ALTA_NUEVA': {
                    titulo: 'Nueva Solicitud: Activación de Equipo',
                    asunto_template: 'Nueva Solicitud: Activación de Equipo',
                    mensaje: '{{usuario_accion}} solicita activar un nuevo equipo',
                    cuerpo_mensaje: '{{usuario_accion}} solicita activar un nuevo equipo'
                },
                'SOL_EQUIPO_NUEVO_EQUIPO_NUEVA': {
                    titulo: 'Nueva Solicitud: Equipo Nuevo',
                    asunto_template: 'Nueva Solicitud: Equipo Nuevo',
                    mensaje: '{{usuario_accion}} ha solicitado la adquisición de un nuevo equipo',
                    cuerpo_mensaje: '{{usuario_accion}} ha solicitado la adquisición de un nuevo equipo'
                },
                'SOL_EQUIPO_REPORTE_PROBLEMA_NUEVA': {
                    titulo: 'Nueva Solicitud: Reporte de Problema',
                    asunto_template: 'Nueva Solicitud: Reporte de Problema',
                    mensaje: '{{usuario_accion}} ha reportado un problema con el equipo {{equipo_nombre}}',
                    cuerpo_mensaje: '{{usuario_accion}} ha reportado un problema con el equipo {{equipo_nombre}}'
                },
                'FICHA_CREADA': {
                    titulo: 'Nueva Ficha Comercial #{{correlativo}}',
                    asunto_template: 'Nueva Ficha Comercial #{{correlativo}}',
                    mensaje: '{{usuario_accion}} ha creado una nueva ficha para {{cliente}}',
                    cuerpo_mensaje: '{{usuario_accion}} ha creado una nueva ficha para {{cliente}}'
                },
                'AVISO_PERDIDO_NUEVO': {
                    titulo: 'Reporte de Extravío/Robo',
                    mensaje: '{{usuario_accion}} reportó el extravío del equipo {{equipo_nombre}}. Fecha suceso: {{fecha_suceso}}'
                },
                'AVISO_PROBLEMA_NUEVO': {
                    titulo: 'Aviso de Problema Técnico',
                    mensaje: '{{usuario_accion}} reportó un problema con el equipo {{equipo_nombre}}'
                },
                'AVISO_CONSULTA_NUEVA': {
                    titulo: 'Nueva Consulta General',
                    mensaje: '{{usuario_accion}} ha enviado una consulta al sistema.'
                },
                'AVISO_CONSULTA_EQUIPO_NUEVA': {
                    titulo: 'Consulta de Equipo',
                    mensaje: '{{usuario_accion}} realizó una consulta sobre el equipo {{equipo_nombre}}'
                },
                'AVISO_CONSULTA_FICHA_NUEVA': {
                    titulo: 'Consulta de Ficha',
                    mensaje: '{{usuario_accion}} realizó una consulta técnica sobre un servicio.'
                },
                'AVISO_CANCELACION_NUEVA': {
                    titulo: 'Cancelación de Muestreo',
                    mensaje: '{{usuario_accion}} ha reportado la anulación del servicio {{CORRELATIVO}}'
                },
                'FICHA_APROBADA_TECNICA': {
                    titulo: 'Aprobación Técnica: #{{correlativo}}',
                    mensaje: 'La ficha #{{correlativo}} ha sido APROBADA técnicamente por {{usuario_accion}}.'
                },
                'FICHA_RECHAZADA_TECNICA': {
                    titulo: 'Ficha Rechazada: #{{correlativo}}',
                    mensaje: 'La ficha #{{correlativo}} ha sido RECHAZADA técnicamente por {{usuario_accion}}.'
                },
                'FICHA_APROBADA_COORDINACION': {
                    titulo: 'Aprobación Coordinación: #{{correlativo}}',
                    mensaje: 'La ficha #{{correlativo}} ha sido APROBADA por coordinación ({{usuario_accion}}).'
                },
                'FICHA_RECHAZADA_COORDINACION': {
                    titulo: 'Rechazo Coordinación: #{{correlativo}}',
                    mensaje: 'La ficha #{{correlativo}} ha sido RECHAZADA por coordinación ({{usuario_accion}}).'
                },
                'FICHA_ASIGNADA': {
                    titulo: 'Muestreo Asignado: #{{correlativo}}',
                    mensaje: 'Se ha asignado el muestreo de la ficha #{{correlativo}} al equipo de terreno.'
                },
                'FICHA_MUESTREO_CANCELADO': {
                    titulo: 'Muestreo Cancelado: #{{correlativo}}',
                    mensaje: 'El muestreo agendado para la ficha #{{correlativo}} ha sido cancelado.'
                },
                'FICHA_MUESTREO_REPROGRAMADO': {
                    titulo: 'Muestreo Reprogramado: #{{correlativo}}',
                    mensaje: 'El muestreo de la ficha #{{correlativo}} ha sido reprogramado para una nueva fecha.'
                },
                'GCHAT_NUEVO_MENSAJE': {
                    titulo: '{{titulo_notificacion}}',
                    mensaje: '{{mensaje_notificacion}}'
                },
                'GCHAT_GRUPO_CREADO': {
                    titulo: 'Nuevo Grupo: {{nombre_grupo}}',
                    mensaje: 'Has sido añadido al grupo "{{nombre_grupo}}"'
                },
                'GCHAT_GRUPO_MIEMBRO_NUEVO': {
                    titulo: 'Grupo: {{nombre_grupo}}',
                    mensaje: '{{usuario_accion}} ha sido añadido al grupo'
                },
                'GCHAT_GRUPO_EXPULSADO': {
                    titulo: 'Remoción de Grupo: {{nombre_grupo}}',
                    mensaje: 'Has sido removido del grupo "{{nombre_grupo}}"'
                }
            };

            // 4. Despacho Web
            for (const recipient of recipients) {
                if (recipient.web) {
                    const { id_usuario } = recipient;
                    const ctxParaWeb = { 
                        ...context, 
                        id_solicitud: context.id_solicitud || context.CORRELATIVO || context.correlativo || 'N/A',
                        usuario_accion: context.usuario_accion || context.USUARIO || context.SOLICITANTE || context.nombre_solicitante || 'Un usuario',
                        correlativo: context.id_solicitud || context.CORRELATIVO || context.correlativo || 'N/A',
                        estado_legible: context.estado ? this._formatEstado(context.estado) : 'Desconocido',
                        equipo_nombre: (() => {
                            try {
                                const name = context.equipo_nombre || context.nombre_equipo_full || context.equipo || 'N/A';
                                const code = context.codigo_equipo || context.codigo_equipo_db;
                                if (name && code && typeof name === 'string' && !name.includes('[')) return `${name} [${code}]`;
                                return name;
                            } catch (e) { return 'N/A'; }
                        })(),
                        fecha_suceso: context.fecha_suceso || context.fecha_extravio || 'N/A',
                        fecha_extravio: context.fecha_extravio || context.fecha_suceso || 'N/A',
                        motivo: context.observaciones || context.motivo || 'N/A',
                        equipo: context.equipo_nombre || context.equipo || 'N/A'
                    };

                    // Try to find rule with web template
                    const ruleWithTemplate = rules.find(ru => ru.envia_web && ru.plantilla_web && ru.plantilla_web.trim() !== '');
                    
                    // User Issue 3: If the DB rule just says "EN_REVISION", it overriding our nice formatted text.
                    // Let's force use of default templates if the DB template is too short/generic, or just use ours.
                    const isGenericLocalRule = ruleWithTemplate && ruleWithTemplate.plantilla_web.length < 20 && !ruleWithTemplate.plantilla_web.includes('{{');
                    
                    const template = (ruleWithTemplate && !isGenericLocalRule) ? {
                        titulo: ruleWithTemplate.plantilla_web_titulo || `Aviso: ${codigoEvento}`,
                        mensaje: ruleWithTemplate.plantilla_web
                    } : (defaultWebTemplates[codigoEvento] || { 
                        titulo: (context.titulo_notificacion || context.titulo) || `Aviso: ${codigoEvento.replace(/_/g, ' ')}`, 
                        mensaje: (context.mensaje_notificacion || context.mensaje) || 'Nuevo aviso en el sistema' 
                    });
                    
                    let titulo = this._compileTemplate(template.titulo, ctxParaWeb);
                    let mensaje = this._compileTemplate(template.mensaje, ctxParaWeb);
                    
                    // Hard override to fix user issue 3 if the template still rendered EN_REVISION literally
                    if (mensaje.includes('EN_REVISION')) {
                        mensaje = mensaje.replace('EN_REVISION', 'En revisión');
                    }

                    await this.sendWebNotification(id_usuario, titulo, mensaje, 'INFO', context.id_solicitud || context.id_referencia || context.correlativo, context.area_destino || context.area);
                }
            }

            // 5. Despacho Email
            const emailRecipients = recipients.filter(r => r.email);
            if (emailRecipients.length > 0 || globalCC) {
                const userIdsForEmail = emailRecipients.map(r => r.id_usuario);
                let emailList = await this._resolveEmails(pool, userIdsForEmail);
                let ccArray = [];
                if (globalCC) {
                    ccArray = globalCC.split(',').map(e => e.trim()).filter(e => e);
                }

                if (emailList.length > 0 || ccArray.length > 0) {
                    const now = new Date();
                    let tituloCorreo = 'Notificación de Solicitud';
                    let etiquetaObs = 'Comentarios de la Acción';
                    let labelSolicitante = 'Acción por';
                    let etiquetaHora = 'Hora';
                    let colorPrincipal = '#0062a8'; 
                    let colorFondo = '#ffffff'; 

                    // ── Eventos de Fichas ──────────────────────────────────
                    if (codigoEvento.startsWith('FICHA_')) {
                        const correlativo = context.correlativo || context.CORRELATIVO || '';
                        if (codigoEvento === 'FICHA_APROBADA_TECNICA') {
                            colorPrincipal = '#0d9488';
                            tituloCorreo = `Ficha Aprobada Técnica: #${correlativo}`;
                            etiquetaObs = 'Observaciones';
                            labelSolicitante = 'Aprobado por';
                            etiquetaHora = 'Hora Aprobación';
                        } else if (codigoEvento === 'FICHA_RECHAZADA_TECNICA') {
                            colorPrincipal = '#dc3545';
                            tituloCorreo = `Ficha Rechazada: #${correlativo}`;
                            etiquetaObs = 'Motivo del Rechazo';
                            labelSolicitante = 'Rechazado por';
                            etiquetaHora = 'Hora Rechazo';
                        } else if (codigoEvento === 'FICHA_APROBADA_COORDINACION') {
                            colorPrincipal = '#0d9488';
                            tituloCorreo = `Ficha Aprobada Coordinación: #${correlativo}`;
                            etiquetaObs = 'Observaciones';
                            labelSolicitante = 'Aprobado por';
                            etiquetaHora = 'Hora Aprobación';
                        } else if (codigoEvento === 'FICHA_RECHAZADA_COORDINACION') {
                            colorPrincipal = '#dc3545';
                            tituloCorreo = `Ficha Devuelta a Revisión: #${correlativo}`;
                            etiquetaObs = 'Motivo';
                            labelSolicitante = 'Revisado por';
                            etiquetaHora = 'Hora Rechazo';
                        } else if (codigoEvento === 'FICHA_CREADA' || codigoEvento === 'FICHA_REMUESTREO_CREADA') {
                            tituloCorreo = `Nueva Ficha Comercial: #${correlativo}`;
                            etiquetaObs = 'Detalle';
                            labelSolicitante = 'Creado por';
                            etiquetaHora = 'Hora Creación';
                        } else if (codigoEvento === 'FICHA_ASIGNADA') {
                            colorPrincipal = '#6366f1';
                            tituloCorreo = `Muestreo Asignado: #${correlativo}`;
                            labelSolicitante = 'Asignado por';
                            etiquetaHora = 'Hora Asignación';
                        }
                    // ── Eventos de Solicitudes ─────────────────────────────
                    } else if (codigoEvento.includes('NUEVA') || codigoEvento.includes('CREADA')) {
                        tituloCorreo = `Nueva Solicitud: ${context.nombre_tipo || 'Servicio'}`;
                        etiquetaObs = 'Detalle de la Solicitud';
                        labelSolicitante = 'Creado por';
                    } else if (codigoEvento.includes('ESTADO') || codigoEvento.includes('CAMBIO')) {
                        const est = (context.estado || '').toUpperCase();
                        if (est === 'RECHAZADA') { colorPrincipal = '#dc3545'; tituloCorreo = `Solicitud Rechazada: ${context.nombre_tipo || 'Servicio'}`; }
                        else if (est === 'ACEPTADA') { colorPrincipal = '#0d9488'; tituloCorreo = `Solicitud Aceptada: ${context.nombre_tipo || 'Servicio'}`; }
                        else if (est === 'REALIZADA') { colorPrincipal = '#28a745'; tituloCorreo = `Solicitud Realizada: ${context.nombre_tipo || 'Servicio'}`; }
                        else if (est === 'EN_REVISION') { colorPrincipal = '#3b82f6'; tituloCorreo = `Solicitud En Revisión: ${context.nombre_tipo || 'Servicio'}`; }
                        else { colorPrincipal = '#28a745'; tituloCorreo = `Solicitud Actualizada: ${context.nombre_tipo || 'Servicio'}`; }
                    } else if (codigoEvento.includes('DERIVACION')) {
                        colorPrincipal = '#6366f1'; 
                        tituloCorreo = `Solicitud Derivada: ${context.nombre_tipo || 'Servicio'}`;
                    }

                    const enrichedContext = {
                        ...context,
                        ID_SOLICITUD: context.ID_SOLICITUD || context.id_solicitud || context.id_referencia || 'N/A',
                        CORRELATIVO: context.CORRELATIVO || context.correlativo || context.id_solicitud || context.id_referencia || 'N/A',
                        USUARIO: context.USUARIO || context.usuario_accion || context.nombre_solicitante || context.nombre_autor || 'Técnico en Terreno (App)',
                        SOLICITANTE: context.SOLICITANTE || context.nombre_solicitante || context.solicitante || context.usuario_accion || context.nombre_autor || 'Usuario',
                        FECHA: now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
                        HORA: now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        ETIQUETA_HORA: etiquetaHora,
                        TIPO_SOLICITUD: context.nombre_tipo || 'Notificación General',
                        OBSERVACION: context.observaciones || context.mensaje || 'Sin observaciones adicionales.',
                        TITULO_CORREO: tituloCorreo,
                        ETIQUETA_OBSERVACION: context.etiqueta_observacion || etiquetaObs,
                        LABEL_SOLICITANTE: labelSolicitante,
                        COLOR_PRINCIPAL: colorPrincipal,
                        COLOR_FONDO: colorFondo,
                        APP_URL: context.APP_URL || process.env.APP_URL || 'http://localhost:5173'
                    };

                    // --- RESOLUCIÓN DE EVENTO ESPECÍFICO (Arquitectura 3.0) ---
                    // Intentamos encontrar una plantilla más específica en mae_evento_notificacion
                    let emailEventCode = codigoEvento;
                    if (context.id_tipo && (codigoEvento === 'SOLICITUD_NUEVA' || codigoEvento === 'SOLICITUD_ESTADO_CAMBIO')) {
                        try {
                            const pool = await getConnection();
                            const typeRes = await pool.request()
                                .input('id', sql.Numeric(10, 0), context.id_tipo)
                                .query('SELECT nombre FROM mae_solicitud_tipo WHERE id_tipo = @id');
                            
                            const tipoNombre = typeRes.recordset[0]?.nombre;
                            if (tipoNombre) {
                                // Generar SLUG: "Traspaso de Equipo" -> "EQUIPO_TRASPASO"
                                const slug = tipoNombre.toUpperCase()
                                    .replace(/SOLICITUD DE /g, '')
                                    .replace(/ DE /g, '_')
                                    .replace(/ /g, '_')
                                    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // quitar tildes
                                
                                const slugNoEquipo = slug.replace(/EQUIPO_/g, '').replace(/_EQUIPO/g, '');
                                
                                const suffix = codigoEvento === 'SOLICITUD_NUEVA' ? 'NUEVA' : 'CAMBIO';
                                const candidates = [
                                    `SOL_${slug}_${suffix}`,
                                    `SOL_EQUIPO_${slug}_${suffix}`,
                                    `SOL_EQUIPO_${slugNoEquipo}_${suffix}`,
                                    `SOL_${slugNoEquipo}_${suffix}`
                                ].filter(Boolean);
                                
                                // Eliminar duplicados
                                const uniqueCandidates = [...new Set(candidates)];
                                
                                logger.info(`UNS: Buscando plantilla específica para [${tipoNombre}] -> Candidatos: ${uniqueCandidates.join(', ')}`);
                                
                                const checkReq = pool.request();
                                const checkPlaceholders = uniqueCandidates.map((c, i) => {
                                    checkReq.input(`ec${i}`, sql.VarChar(50), c);
                                    return `@ec${i}`;
                                }).join(',');
                                const checkRes = await checkReq.query(`SELECT codigo_evento FROM mae_evento_notificacion WHERE codigo_evento IN (${checkPlaceholders})`);
                                
                                if (checkRes.recordset.length > 0) {
                                    emailEventCode = checkRes.recordset[0].codigo_evento;
                                    logger.info(`UNS: Usando plantilla personalizada [${emailEventCode}] para el email.`);
                                }
                            }
                        } catch (resError) {
                            logger.error('UNS: Error resolviendo evento específico:', resError);
                        }
                    }

                    await notificationService.send(emailEventCode, enrichedContext, emailList, { skipLegacyDb: true, ccEmails: ccArray });
                }
            }
        } catch (error) {
            logger.error(`Error in UnsService.trigger (${codigoEvento}):`, error);
            throw error;
        }
    }

    /**
     * Resuelve destinatarios basados en reglas 3.0 y permisos dinámicos
     */
    async _resolveDestinatarios(pool, reglas, context, codigoEvento) {
        const recipientsMap = new Map(); // id -> { id_usuario, web, email }
        const actorId = Number(context.id_usuario_accion || context.id_usuario || 0);
        const actorEmail = context.actorEmail || null;

        // Helper to check if a user matches the actor (by ID or Email)
        const isNotActor = (uid, email = null) => {
            if (Number(uid) === actorId) return false;
            if (actorEmail && email && actorEmail.toLowerCase() === email.toLowerCase()) return false;
            return true;
        };

        // A. Procesar Reglas 3.0 (mae_notificacion_regla) — batch lookups
        const directUserRules = reglas.filter(r => r.id_usuario_destino);
        const roleRules = reglas.filter(r => r.id_rol_destino);

        // Batch: all direct-user IDs in a single query
        const directUserMap = new Map(); // uid -> email
        if (directUserRules.length > 0) {
            const req = pool.request();
            const ph = directUserRules.map((r, i) => {
                req.input(`du${i}`, sql.Int, Number(r.id_usuario_destino));
                return `@du${i}`;
            }).join(',');
            const uRes = await req.query(`SELECT id_usuario, correo_electronico FROM mae_usuario WHERE id_usuario IN (${ph})`);
            uRes.recordset.forEach(r => directUserMap.set(Number(r.id_usuario), r.correo_electronico));
        }

        // Batch: all role IDs in a single query
        const roleUserMap = new Map(); // uid -> { email, roleId }
        if (roleRules.length > 0) {
            const req = pool.request();
            const ph = roleRules.map((r, i) => {
                req.input(`ro${i}`, sql.Int, Number(r.id_rol_destino));
                return `@ro${i}`;
            }).join(',');
            const rRes = await req.query(`SELECT rur.id_rol, u.id_usuario, u.correo_electronico FROM rel_usuario_rol rur JOIN mae_usuario u ON rur.id_usuario = u.id_usuario WHERE rur.id_rol IN (${ph}) AND u.habilitado = 'S'`);
            rRes.recordset.forEach(r => roleUserMap.set(Number(r.id_usuario), { email: r.correo_electronico, roleId: Number(r.id_rol) }));
        }

        for (const regla of reglas) {
            const userIdsInRule = new Map(); // id -> email

            if (regla.id_usuario_destino) {
                const uid = Number(regla.id_usuario_destino);
                userIdsInRule.set(uid, directUserMap.get(uid) || null);
            }

            if (regla.id_rol_destino) {
                const rid = Number(regla.id_rol_destino);
                roleUserMap.forEach((v, uid) => {
                    if (v.roleId === rid) userIdsInRule.set(uid, v.email);
                });
            }

            // Merge con mapa global
            userIdsInRule.forEach((email, uid) => {
                if (!isNotActor(uid, email)) return;
                const existing = recipientsMap.get(uid) || { id_usuario: uid, web: false, email: false };
                recipientsMap.set(uid, {
                    id_usuario: uid,
                    web: existing.web || !!regla.envia_web,
                    email: existing.email || !!regla.envia_email
                });
            });
        }

        // B. Resolución Dinámica URS (Phase 22/40)
        // Si es una solicitud y no hay reglas específicas, notificamos a los Gestores por defecto
        if (context.id_tipo) {
            const permsRes = await pool.request()
                .input('idTipo', sql.Numeric(10, 0), context.id_tipo)
                .query(`
                    SELECT DISTINCT p.id_usuario, ur.id_usuario as id_usuario_rol
                    FROM rel_solicitud_tipo_permiso p
                    LEFT JOIN rel_usuario_rol ur ON p.id_rol = ur.id_rol
                    WHERE p.id_tipo = @idTipo AND (p.tipo_acceso = 'GESTION' OR p.tipo_acceso = 'DESTINO_DERIVACION')
                `);
            
            // Fix 8b: Respect NotificationHub configuration for email
            const rulesAllowEmail = reglas.length > 0 ? reglas.some(r => r.envia_email) : true;
            let rulesAllowWeb = reglas.length > 0 ? reglas.some(r => r.envia_web) : true;
            
            // Override: NUEVA events should always notify on web so Inbox isn't missed
            if (codigoEvento.includes('NUEVA')) {
                rulesAllowWeb = true;
            }
            
            permsRes.recordset.forEach(r => {
                const uid = Number(r.id_usuario || r.id_usuario_rol);
                if (uid && uid !== actorId) {
                    const existing = recipientsMap.get(uid) || { id_usuario: uid, web: false, email: false };
                    // En URS, si tienes permiso de GESTION, notificamos web si las reglas lo permiten
                    existing.web = existing.web || rulesAllowWeb;
                    
                    // Solo activamos email si las reglas lo permiten Y es un evento crítico (No incluimos comentarios/chat por defecto)
                    if (codigoEvento.includes('NUEVA') || codigoEvento.includes('ESTADO_CAMBIO') || codigoEvento.includes('DERIVACION')) {
                        // SOLICITUD_COMENTARIO_NUEVO contains 'NUEVO' not 'NUEVA', so it stays false here.
                        existing.email = existing.email || rulesAllowEmail;
                    } else if (codigoEvento === 'SOLICITUD_COMENTARIO_NUEVO') {
                        // Trust the specific rule flag directly if provided
                        existing.email = reglas.length > 0 ? reglas.some(r => r.envia_email) : false;
                    }
                    
                    recipientsMap.set(uid, existing);
                }
            });
            logger.info(`UNS: Resolviendo URS para tipo ${context.id_tipo}. Encontrados: ${permsRes.recordset.length}`);
        }

        // C. Casos Especiales (Propietario / Solicitante / Chat Afectado)
        // Solo enviamos si NO se ha desactivado explícitamente en el contexto
        if (context.notificar_propietario !== false) {
            const eventsForOwner = [
                'SOLICITUD_ESTADO_CAMBIO', 
                'SOLICITUD_COMENTARIO_NUEVO', 
                'SOLICITUD_DERIVACION',
                'FICHA_CREADA',
                'FICHA_REMUESTREO_CREADA',
                'FICHA_APROBADA_TECNICA',
                'FICHA_RECHAZADA_TECNICA',
                'FICHA_APROBADA_COORDINACION',
                'FICHA_RECHAZADA_COORDINACION',
                'FICHA_ASIGNADA',
                'GCHAT_GRUPO_EXPULSADO', 
                'GCHAT_GRUPO_CREADO'
            ];
            
            if (eventsForOwner.includes(codigoEvento)) {
                const ownerId = Number(context.id_usuario_destino || context.id_solicitante || context.id_usuario_propietario);
                if (ownerId && ownerId !== actorId) {
                    // Sync with Hub: Only notify if there are rules and at least one has the toggle enabled.
                    // For legacy Fichas/Solicitudes, we default to true if no rules exist to maintain compatibility.
                    const isGchat = codigoEvento.startsWith('GCHAT');
                    const isFicha = codigoEvento.startsWith('FICHA');
                    const isChatSol = codigoEvento === 'SOLICITUD_COMENTARIO_NUEVO';
                    
                    const canSendWeb = reglas.length > 0 ? reglas.some(r => r.envia_web) : (!isGchat || isFicha);
                    // Architecture 3.0 Fix: Chat messages (SOLICITUD_COMENTARIO_NUEVO) should NOT send email by default
                    const canSendEmail = reglas.length > 0 ? reglas.some(r => r.envia_email) : ((!isGchat && !isChatSol) || isFicha);
                    
                    const existing = recipientsMap.get(ownerId) || { id_usuario: ownerId, web: false, email: false };
                    existing.web = existing.web || canSendWeb;
                    
                    // User Issue 2 (Reverted): User actually wants chat emails if they configured it in Hub.
                    // We trust canSendEmail directly.
                    existing.email = existing.email || canSendEmail;
                    
                    if (existing.web || existing.email) {
                        recipientsMap.set(ownerId, existing);
                    }
                }
            }
        }

        // D. Destinatarios Directos (Para Chat y eventos recurrentes/masivos dinámicos)
        if (context.destinatarios_directos && Array.isArray(context.destinatarios_directos)) {
            const isGchat = codigoEvento.startsWith('GCHAT');
            const canSendWeb = reglas.length > 0 ? reglas.some(r => r.envia_web) : !isGchat;
            const canSendEmail = reglas.length > 0 ? reglas.some(r => r.envia_email) : !isGchat;
            
            context.destinatarios_directos.forEach(uid => {
                const id = Number(uid);
                if (id && id !== actorId) {
                    const existing = recipientsMap.get(id) || { id_usuario: id, web: false, email: false };
                    existing.web = existing.web || canSendWeb;
                    existing.email = existing.email || canSendEmail;
                    if (existing.web || existing.email) {
                        recipientsMap.set(id, existing);
                    }
                }
            });
        }

        return Array.from(recipientsMap.values());
    }

    _compileTemplate(template, context) {
        if (!template) return '';
        let output = template;
        
        // Ensure we have a working context
        const ctx = { ...context };
        if (ctx.datos_json && typeof ctx.datos_json === 'object') {
            Object.assign(ctx, ctx.datos_json);
        }

        for (const [key, value] of Object.entries(ctx)) {
            // Skip complex objects
            if (value !== null && typeof value === 'object') continue;
            
            const val = (value === null || value === undefined) ? '' : String(value);
            
            // Handle both {{key}} and {key}
            output = output.split(`{{${key}}}`).join(val);
            output = output.split(`{{${key.toUpperCase()}}}`).join(val);
            output = output.split(`{${key}}`).join(val);
            output = output.split(`{${key.toUpperCase()}}`).join(val);
        }
        return output;
    }

    _formatEstado(estado) {
        const estadoMap = {
            'EN_REVISION': 'En revisión',
            'PENDIENTE': 'Pendiente',
            'ACEPTADA': 'Aceptada',
            'RECHAZADA': 'Rechazada',
            'REALIZADA': 'Realizada',
        };
        const upper = String(estado).trim().toUpperCase();
        return estadoMap[upper] || String(estado).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Resuelve los correos electrónicos de una lista de IDs de usuario
     */
    async _resolveEmails(pool, userIds) {
        if (!userIds || userIds.length === 0) return [];
        try {
            const req = pool.request();
            const placeholders = userIds.map((uid, i) => {
                req.input(`uid${i}`, sql.Int, uid);
                return `@uid${i}`;
            }).join(',');
            const result = await req.query(`
                    SELECT correo_electronico
                    FROM mae_usuario
                    WHERE id_usuario IN (${placeholders})
                    AND habilitado = 'S'
                    AND correo_electronico IS NOT NULL
                    AND correo_electronico <> ''
                `);
            return result.recordset.map(r => r.correo_electronico);
        } catch (error) {
            logger.error('Error resolving emails in UnsService:', error);
            return [];
        }
    }

    /**
     * Envía una notificación web persistente a la base de datos
     */
    async sendWebNotification(idUsuario, titulo, mensaje, tipo = 'INFO', idReferencia = null, area = null) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('idUsr', sql.Numeric(10, 0), idUsuario)
                .input('titulo', sql.VarChar(200), titulo)
                .input('msg', sql.NVarChar(sql.MAX), mensaje)
                .input('tipo', sql.VarChar(20), tipo)
                .input('ref', sql.Numeric(10, 0), idReferencia)
                .input('area', sql.VarChar(50), area)
                .query(`
                    INSERT INTO mae_notificacion (id_usuario, titulo, mensaje, tipo, id_referencia, leido, area, fecha_creacion)
                    VALUES (@idUsr, @titulo, @msg, @tipo, @ref, 0, @area, GETUTCDATE());
                    SELECT SCOPE_IDENTITY() as id;
                `);
            
            const newId = result.recordset[0].id;

            // EMIT SOCKET FOR REALTIME TOAST (Improved with rooms and ID)
            try {
                const io = getIo();
                const room = `user_${idUsuario}`;
                logger.info(`[UNS] Emitting to ${room}: ${titulo}`);
                io.to(room).emit('nuevaNotificacion', {
                    id_notificacion: newId,
                    id_usuario: idUsuario,
                    titulo: titulo,
                    mensaje: mensaje,
                    tipo: tipo,
                    id_referencia: idReferencia,
                    area: area,
                    fecha_creacion: new Date()
                });
            } catch (_) {
                logger.warn('[UNS] Socket.io not initialized, toast skipped.');
            }
        } catch (error) {
            logger.error('Error in UnsService.sendWebNotification:', error);
            throw error;
        }
    }

    /**
     * Obtiene notificaciones de un usuario
     */
    async getUserNotifications(idUsuario, soloNoLeidas = true) {
        try {
            const pool = await getConnection();
            let query = 'SELECT ';
            if (!soloNoLeidas) query += 'TOP 25 ';
            query += '* FROM mae_notificacion WHERE id_usuario = @idUsr';
            if (soloNoLeidas) query += ' AND leido = 0';
            query += ' ORDER BY fecha_creacion DESC';

            const result = await pool.request()
                .input('idUsr', sql.Numeric(10, 0), idUsuario)
                .query(query);
            return result.recordset;
        } catch (error) {
            logger.error('Error in UnsService.getUserNotifications:', error);
            throw error;
        }
    }

    /**
     * Marca una notificación como leída
     */
    async markAsRead(idNotificacion) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('id', sql.Numeric(10, 0), idNotificacion)
                .query('UPDATE mae_notificacion SET leido = 1 WHERE id_notificacion = @id');
            return { success: true };
        } catch (error) {
            logger.error('Error in UnsService.markAsRead:', error);
            throw error;
        }
    }

    /**
     * Marca todas las notificaciones de una referencia como leídas para un usuario
     */
    async markAsReadByReference(idUsuario, idReferencia) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('idUsr', sql.Numeric(10, 0), idUsuario)
                .input('ref', sql.Numeric(10, 0), idReferencia)
                .query('UPDATE mae_notificacion SET leido = 1 WHERE id_usuario = @idUsr AND id_referencia = @ref AND leido = 0');
            return { success: true };
        } catch (error) {
            logger.error('Error in UnsService.markAsReadByReference:', error);
            throw error;
        }
    }

    /**
     * Obtiene las reglas para un evento específico
     */
    async getRulesByEvent(eventCode) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('code', sql.VarChar(50), eventCode)
                .query(`
                    SELECT nr.*, r.nombre_rol, u.nombre_usuario 
                    FROM mae_notificacion_regla nr
                    LEFT JOIN mae_rol r ON nr.id_rol_destino = r.id_rol
                    LEFT JOIN mae_usuario u ON nr.id_usuario_destino = u.id_usuario
                    WHERE nr.codigo_evento = @code
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error in UnsService.getRulesByEvent:', error);
            throw error;
        }
    }

    /**
     * Crea o actualiza una regla de notificación
     */
    async saveRule(data) {
        try {
            const pool = await getConnection();
            const request = pool.request()
                .input('id', sql.Numeric(10, 0), data.id_regla || null)
                .input('code', sql.VarChar(50), data.codigo_evento)
                .input('tipoSol', sql.Numeric(10, 0), data.id_tipo_solicitud || null)
                .input('idRol', sql.Numeric(10, 0), data.id_rol_destino || null)
                .input('idUsr', sql.Numeric(10, 0), data.id_usuario_destino || null)
                .input('area', sql.VarChar(50), data.area_destino || null)
                .input('email', sql.Bit, data.envia_email ?? 1)
                .input('web', sql.Bit, data.envia_web ?? 0)
                .input('templateWebTitle', sql.NVarChar(200), data.plantilla_web_titulo || null)
                .input('templateWebMsg', sql.NVarChar(sql.MAX), data.plantilla_web || null);

            if (data.id_regla) {
                await request.query(`
                    UPDATE mae_notificacion_regla 
                    SET id_rol_destino = @idRol,
                        id_usuario_destino = @idUsr,
                        area_destino = @area,
                        envia_email = @email,
                        envia_web = @web,
                        plantilla_web_titulo = @templateWebTitle,
                        plantilla_web = @templateWebMsg,
                        id_tipo_solicitud = @tipoSol
                    WHERE id_regla = @id
                `);
                return { id_regla: data.id_regla, ...data };
            } else {
                const result = await request.query(`
                    INSERT INTO mae_notificacion_regla (codigo_evento, id_rol_destino, id_usuario_destino, area_destino, envia_email, envia_web, plantilla_web_titulo, plantilla_web, id_tipo_solicitud)
                    OUTPUT INSERTED.id_regla
                    VALUES (@code, @idRol, @idUsr, @area, @email, @web, @templateWebTitle, @templateWebMsg, @tipoSol)
                `);
                return { id_regla: result.recordset[0].id_regla, ...data };
            }
        } catch (error) {
            logger.error('Error in UnsService.saveRule:', error);
            throw error;
        }
    }

    async deleteRule(id) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .query('DELETE FROM mae_notificacion_regla WHERE id_regla = @id');
            return { success: true };
        } catch (error) {
            logger.error('Error in UnsService.deleteRule:', error);
            throw error;
        }
    }
}

export default new UnsService();
