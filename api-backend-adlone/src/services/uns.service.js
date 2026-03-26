import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';
import notificationService from './notification.service.js';

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
            const dispatchRes = await pool.request()
                .input('codigo_evento', sql.VarChar(50), codigoEvento)
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

            // 4. Despacho Web
            for (const recipient of recipients) {
                if (recipient.web) {
                    const { id_usuario } = recipient;
                    const ctxParaWeb = { 
                        ...context, 
                        id_solicitud: context.id_solicitud || context.id_referencia || context.correlativo || 'N/A',
                        usuario_accion: context.usuario_accion || context.nombre_autor || 'Un usuario',
                        correlativo: context.correlativo || context.id_solicitud || context.id_referencia || 'N/A',
                        estado_legible: context.estado ? this._formatEstado(context.estado) : 'Desconocido',
                        // Fix 2: Alias equipo_nombre from datos_json fields
                        equipo_nombre: context.equipo_nombre || context.nombre_equipo_full || context.nombre_equipo || ''
                    };

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
                        // URS Especificos
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
                        'FICHA_CREADA': {
                            titulo: 'Nueva Ficha Comercial #{{correlativo}}',
                            asunto_template: 'Nueva Ficha Comercial #{{correlativo}}',
                            mensaje: '{{usuario_accion}} ha creado una nueva ficha para {{cliente}}',
                            cuerpo_mensaje: '{{usuario_accion}} ha creado una nueva ficha para {{cliente}}'
                        },
                        'FICHA_APROBADA_TECNICA': {
                            titulo: 'Ficha #{{correlativo}} Aprobada (Técnica)',
                            asunto_template: 'Ficha Aprobada por Área Técnica - #{{correlativo}}',
                            mensaje: 'La ficha #{{correlativo}} ha sido aprobada por el Área Técnica ({{usuario_accion}}).',
                            cuerpo_mensaje: 'La ficha #{{correlativo}} ha sido aprobada por el Área Técnica ({{usuario_accion}}).'
                        },
                        'FICHA_RECHAZADA_TECNICA': {
                            titulo: 'Ficha #{{correlativo}} Rechazada (Técnica)',
                            asunto_template: 'Ficha Rechazada por Área Técnica - #{{correlativo}}',
                            mensaje: 'La ficha #{{correlativo}} ha sido rechazada por el Área Técnica ({{usuario_accion}}).',
                            cuerpo_mensaje: 'La ficha #{{correlativo}} ha sido rechazada por el Área Técnica ({{usuario_accion}}).'
                        },
                        'FICHA_APROBADA_COORDINACION': {
                            titulo: 'Ficha #{{correlativo}} Aprobada (Coordinación)',
                            asunto_template: 'Ficha Aprobada por Área Coordinación - #{{correlativo}}',
                            mensaje: 'La ficha #{{correlativo}} ha sido aprobada por Coordinación ({{usuario_accion}}) y está lista para programación.',
                            cuerpo_mensaje: 'La ficha #{{correlativo}} ha sido aprobada por Coordinación ({{usuario_accion}}) y está lista para programación.'
                        },
                        'FICHA_RECHAZADA_COORDINACION': {
                            titulo: 'Ficha #{{correlativo}} Devuelta (Coordinación)',
                            asunto_template: 'Ficha Devuelta por Área Coordinación - #{{correlativo}}',
                            mensaje: 'La ficha #{{correlativo}} ha sido devuelta a revisión técnica por Coordinación ({{usuario_accion}}).',
                            cuerpo_mensaje: 'La ficha #{{correlativo}} ha sido devuelta a revisión técnica por Coordinación ({{usuario_accion}}).'
                        },
                        'FICHA_ASIGNADA': {
                            titulo: 'Programación Muestreo #{{correlativo}}',
                            asunto_template: 'Programación Muestreo - Ficha #{{correlativo}}',
                            mensaje: 'Se han asignado fechas y muestreadores para la ficha #{{correlativo}} por {{usuario_accion}}.',
                            cuerpo_mensaje: 'Se han asignado fechas y muestreadores para la ficha #{{correlativo}} por {{usuario_accion}}.'
                        },
                        'SOL_EQUIPO_REPORTE_PROBLEMA_NUEVA': {
                            titulo: 'Nueva Solicitud: Reporte de Problema',
                            asunto_template: 'Nueva Solicitud: Reporte de Problema',
                            mensaje: '{{usuario_accion}} ha reportado un problema con el equipo {{equipo_nombre}}',
                            cuerpo_mensaje: '{{usuario_accion}} ha reportado un problema con el equipo {{equipo_nombre}}'
                        },
                        'GCHAT_NUEVO_MENSAJE': {
                            titulo: '{{titulo_notificacion}}',
                            asunto_template: '{{titulo_notificacion}}',
                            mensaje: '{{mensaje_notificacion}}',
                            cuerpo_mensaje: '{{mensaje_notificacion}}'
                        },
                        'GCHAT_GRUPO_CREADO': {
                            titulo: 'Nuevo Grupo',
                            asunto_template: 'Nuevo Grupo',
                            mensaje: 'Has sido agregado al grupo {{nombre_grupo}}',
                            cuerpo_mensaje: 'Has sido agregado al grupo {{nombre_grupo}}'
                        },
                        'GCHAT_GRUPO_EXPULSADO': {
                            titulo: 'Aviso de Grupo',
                            asunto_template: 'Aviso de Grupo',
                            mensaje: 'Has sido removido del grupo {{nombre_grupo}}',
                            cuerpo_mensaje: 'Has sido removido del grupo {{nombre_grupo}}'
                        },
                        'GCHAT_GRUPO_MIEMBRO_NUEVO': {
                            titulo: 'Miembro Nuevo',
                            asunto_template: 'Miembro Nuevo',
                            mensaje: '{{usuario_accion}} se ha unido al grupo {{nombre_grupo}}',
                            cuerpo_mensaje: '{{usuario_accion}} se ha unido al grupo {{nombre_grupo}}'
                        }
                    };

                    // Try to find rule with web template
                    const ruleWithTemplate = rules.find(ru => ru.envia_web && ru.plantilla_web && ru.plantilla_web.trim() !== '');
                    
                    // User Issue 3: If the DB rule just says "EN_REVISION", it overriding our nice formatted text.
                    // Let's force use of default templates if the DB template is too short/generic, or just use ours.
                    const isGenericLocalRule = ruleWithTemplate && ruleWithTemplate.plantilla_web.length < 20 && !ruleWithTemplate.plantilla_web.includes('{{');
                    
                    const template = (ruleWithTemplate && !isGenericLocalRule) ? {
                        titulo: ruleWithTemplate.plantilla_web_titulo || `Aviso: ${codigoEvento}`,
                        mensaje: ruleWithTemplate.plantilla_web
                    } : (defaultWebTemplates[codigoEvento] || { titulo: `Aviso: ${codigoEvento}`, mensaje: 'Nuevo evento en el sistema' });
                    
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
                    let colorPrincipal = '#0062a8'; 
                    let colorFondo = '#ffffff'; 

                    if (codigoEvento.includes('NUEVA') || codigoEvento.includes('CREADA')) {
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
                        CORRELATIVO: context.correlativo || context.id_solicitud || context.id_referencia || 'N/A',
                        USUARIO: context.usuario_accion || context.nombre_solicitante || context.nombre_autor || 'Sistema',
                        SOLICITANTE: context.nombre_solicitante || context.solicitante || context.usuario_accion || context.nombre_autor || 'Usuario',
                        FECHA: now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
                        HORA: now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
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
                                
                                const checkRes = await pool.request()
                                    .query(`SELECT codigo_evento FROM mae_evento_notificacion WHERE codigo_evento IN (${uniqueCandidates.map(c => `'${c}'`).join(',')})`);
                                
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

        // A. Procesar Reglas 3.0 (mae_notificacion_regla)
        for (const regla of reglas) {
            const userIdsInRule = new Map(); // id -> email

            // 1. Por Usuario Específico
            if (regla.id_usuario_destino) {
                const uid = Number(regla.id_usuario_destino);
                // Necesitamos el email para el filtro
                let email = null;
                const uRes = await pool.request()
                    .input('uid', sql.Numeric(10, 0), uid)
                    .query("SELECT correo_electronico FROM mae_usuario WHERE id_usuario = @uid");
                if (uRes.recordset.length > 0) email = uRes.recordset[0].correo_electronico;
                userIdsInRule.set(uid, email);
            }

            // 2. Por Rol
            if (regla.id_rol_destino) {
                const res = await pool.request()
                    .input('idRol', sql.Numeric(10, 0), regla.id_rol_destino)
                    .query("SELECT u.id_usuario, u.correo_electronico FROM rel_usuario_rol rur JOIN mae_usuario u ON rur.id_usuario = u.id_usuario WHERE id_rol = @idRol AND u.habilitado = 'S'");
                res.recordset.forEach(r => userIdsInRule.set(Number(r.id_usuario), r.correo_electronico));
            }

            // Merge con mapa global
            userIdsInRule.forEach((email, uid) => {
                if (!isNotActor(uid, email)) return; // Omitir actor
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
        for (const [key, value] of Object.entries(context)) {
            const val = value || '';
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
            const result = await pool.request()
                .input('ids', sql.NVarChar(sql.MAX), userIds.join(','))
                .query(`
                    SELECT correo_electronico 
                    FROM mae_usuario 
                    WHERE id_usuario IN (SELECT value FROM STRING_SPLIT(@ids, ','))
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
            if (global.io) {
                global.io.to(`user_${idUsuario}`).emit('nuevaNotificacion', {
                    id_notificacion: newId,
                    id_usuario: idUsuario,
                    titulo: titulo,
                    mensaje: mensaje,
                    tipo: tipo,
                    id_referencia: idReferencia,
                    area: area,
                    fecha_creacion: new Date()
                });
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
