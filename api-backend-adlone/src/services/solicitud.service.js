import sql from '../config/database.js';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import notificationService from './notification.service.js';
import { equipoService } from './equipo.service.js';

class SolicitudService {
    async create(data) {
        try {
            const pool = await getConnection();

            // Determine initial status based on origin
            let estadoInicial = 'PENDIENTE'; // Default fallback
            let estadoTecnica = null; // Default for technical review (Matches CK_estado_tecnica: NULL allowed)

            if (data.origen_solicitud === 'MUESTREADOR') {
                estadoInicial = 'PENDIENTE_TECNICA';
            } else if (data.origen_solicitud === 'TECNICA') {
                estadoInicial = 'PENDIENTE_CALIDAD';
                estadoTecnica = 'DERIVADO'; // Auto-approved by tech since they created it
            }

            const result = await pool.request()
                .input('tipo', sql.VarChar(20), data.tipo_solicitud)
                .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(data.datos_json))
                .input('usuario', sql.Numeric(10, 0), data.usuario_solicita)
                .input('origen', sql.VarChar(20), data.origen_solicitud || 'TECNICA') // Default to TECNICA if not provided for backward compat
                .input('estado', sql.VarChar(20), estadoInicial)
                .input('estado_tecnica', sql.VarChar(20), estadoTecnica)
                .query(`
                    INSERT INTO mae_solicitud_equipo (
                        tipo_solicitud, estado, datos_json, usuario_solicita, fecha_solicitud, 
                        origen_solicitud, estado_tecnica
                    )
                    VALUES (
                        @tipo, @estado, @datos, @usuario, GETDATE(), 
                        @origen, @estado_tecnica
                    );
                    SELECT SCOPE_IDENTITY() AS id;
                `);

            const newId = result.recordset[0].id;

            // Enviar notificación a administradores
            // Only send if it goes to Quality (PENDIENTE_CALIDAD) or if specific logic requires it for Technical
            // For now, keeping existing notification logic but we might want to tune it based on status
            try {
                const userResult = await pool.request()
                    .input('id', sql.Numeric(10, 0), data.usuario_solicita)
                    .query("SELECT nombre_usuario FROM mae_usuario WHERE id_usuario = @id");

                // Get requester email fallback from DB if not provided in payload
                const dbUser = userResult.recordset[0];
                const directEmails = data.correo_solicitante || dbUser?.correo_electronico;

                const tipoLabel = this._getTipoLabel(data.tipo_solicitud, data.datos_json);

                // Determine target permission based on origin
                let targetPermission = null;
                if (estadoInicial === 'PENDIENTE_TECNICA') {
                    targetPermission = 'AI_MA_SOLICITUDES'; // Notify Technical Area (aligned with new RBAC)
                } else if (estadoInicial === 'PENDIENTE_CALIDAD') {
                    targetPermission = 'GC_EQUIPOS'; // Notify Quality
                }

                // NOVEDAD: Notificar también al muestreador (solicitante) que su solicitud fue recibida
                // NOVEDAD: Notificar según el tipo específico de solicitud
                const eventCodeNueva = `SOL_EQUIPO_${data.tipo_solicitud}_NUEVA`;
                notificationService.send(eventCodeNueva, {
                    CORRELATIVO: newId,
                    TIPO_SOLICITUD: tipoLabel,
                    USUARIO: 'Sistema ADL One',
                    FECHA: new Date().toLocaleDateString('es-CL'),
                    HORA: new Date().toLocaleTimeString('es-CL'),
                    OBSERVACION: `Tu solicitud ha sido recibida y será validada por el Área Técnica.`,
                    equipos: this._getEquiposList(data.tipo_solicitud, data.datos_json),
                    directEmails: directEmails // El NotificationService ahora filtrará esto si hay config en BD
                });
            } catch (notifyError) {
                logger.error('Error sending new solicitud notification:', notifyError);
            }

            return { success: true, id: newId };
        } catch (error) {
            logger.error('Error creating solicitud:', error);
            throw error;
        }
    }

    async getSolicitudes(filters = {}) {
        try {
            const pool = await getConnection();
            let query = `
                SELECT s.*, 
                       CASE 
                           WHEN s.origen_solicitud = 'MUESTREADOR' THEN m_sol.nombre_muestreador
                           ELSE u_sol.nombre_usuario
                       END as nombre_solicitante,
                       u_sol.correo_electronico as email_solicitante,
                       m_sol.correo_electronico as email_muestreador,
                       u_sol.seccion as seccion_solicitante,
                       u_rev.nombre_usuario as nombre_revisor,
                       u_tec.nombre_usuario as nombre_revisor_tecnico,
                       u_tec.correo_electronico as email_tecnica,
                       u_apr.nombre_usuario as nombre_aprobador
                FROM mae_solicitud_equipo s
                LEFT JOIN mae_usuario u_sol ON s.usuario_solicita = u_sol.id_usuario
                LEFT JOIN mae_muestreador m_sol ON s.usuario_solicita = m_sol.id_muestreador
                LEFT JOIN mae_usuario u_rev ON s.usuario_revisa = u_rev.id_usuario
                LEFT JOIN mae_usuario u_tec ON s.usuario_tecnica = u_tec.id_usuario
                LEFT JOIN mae_usuario u_apr ON s.usuario_aprueba = u_apr.id_usuario
            `;

            const request = pool.request();
            const whereConditions = [];

            if (filters.estado) {
                // Support multiple states if separated by comma
                if (filters.estado.includes(',')) {
                    const states = filters.estado.split(',');
                    const stateParams = states.map((_, i) => `@estado${i}`);

                    // Special handling: If PENDIENTE_TECNICA is requested, we must also include 
                    // requests that are technically APROBADO (by Quality) but have estado_tecnica = 'PENDIENTE'
                    // This creates a composite condition.

                    let condition = `s.estado IN (${stateParams.join(',')})`;

                    if (states.includes('PENDIENTE_TECNICA')) {
                        condition = `(${condition} OR (s.estado = 'APROBADO' AND s.estado_tecnica = 'PENDIENTE'))`;
                    }

                    whereConditions.push(condition);
                    states.forEach((st, i) => request.input(`estado${i}`, sql.VarChar(20), st.trim()));
                } else {
                    if (filters.estado === 'PENDIENTE_TECNICA') {
                        // Extended logic for single state
                        whereConditions.push("(s.estado = @estado OR (s.estado = 'APROBADO' AND s.estado_tecnica = 'PENDIENTE'))");
                    } else {
                        whereConditions.push('s.estado = @estado');
                    }
                    request.input('estado', sql.VarChar(20), filters.estado);
                }
            }

            if (filters.origen_solicitud) {
                whereConditions.push('s.origen_solicitud = @origen');
                request.input('origen', sql.VarChar(20), filters.origen_solicitud);
            }

            if (filters.estado_tecnica) {
                // Support multiple states
                if (filters.estado_tecnica.includes(',')) {
                    const states = filters.estado_tecnica.split(',');
                    const stateParams = states.map((_, i) => `@estTec${i}`);
                    whereConditions.push(`s.estado_tecnica IN (${stateParams.join(',')})`);
                    states.forEach((st, i) => request.input(`estTec${i}`, sql.VarChar(20), st.trim()));
                } else {
                    whereConditions.push('s.estado_tecnica = @estado_tecnica');
                    request.input('estado_tecnica', sql.VarChar(20), filters.estado_tecnica);
                }
            }

            if (filters.usuario_solicita) {
                whereConditions.push('s.usuario_solicita = @usuario');
                request.input('usuario', sql.Numeric(10, 0), filters.usuario_solicita);
            }
            if (filters.usuario_excluir) {
                whereConditions.push('s.usuario_solicita != @usuarioExcluir');
                request.input('usuarioExcluir', sql.Numeric(10, 0), filters.usuario_excluir);
            }
            if (filters.secciones && filters.secciones.length > 0) {
                const sectionParams = filters.secciones.map((s, i) => `@sec${i}`).join(',');
                let sectionClause = `u_sol.seccion IN (${sectionParams})`;

                if (filters.siempre_incluir_usuario) {
                    sectionClause = `(${sectionClause} OR s.usuario_solicita = @incluirUsuario)`;
                    request.input('incluirUsuario', sql.Numeric(10, 0), filters.siempre_incluir_usuario);
                }

                // CRITICAL: Allow MUESTREADOR requests regardless of section
                // Mobile app users may not have sections or may not exist in mae_usuario
                sectionClause = `(${sectionClause} OR s.origen_solicitud = 'MUESTREADOR')`;

                whereConditions.push(sectionClause);
                filters.secciones.forEach((s, i) => {
                    request.input(`sec${i}`, sql.VarChar(20), s);
                });
            }

            // NEW: Role-based visibility restriction for linear flow
            if (filters.restrictTechnicalPending) {
                // Restricted users (Quality only) cannot see requests in PENDIENTE_TECNICA from MUESTREADOR
                whereConditions.push(`NOT (s.origen_solicitud = 'MUESTREADOR' AND s.estado = 'PENDIENTE_TECNICA')`);
            }


            if (whereConditions.length > 0) {
                query += ' WHERE ' + whereConditions.join(' AND ');
            }

            query += ' ORDER BY s.fecha_solicitud DESC';

            const result = await request.query(query);
            return result.recordset.map(row => ({
                ...row,
                datos_json: JSON.parse(row.datos_json)
            }));
        } catch (error) {
            logger.error('Error fetching solicitudes:', error);
            throw error;
        }
    }

    _getTipoLabel(tipo, solDatos) {
        if (tipo === 'ALTA') {
            return solDatos?.isReactivation ? 'Activación de Equipo' : 'Solicitud de Creación de Equipo';
        } else if (tipo === 'BAJA') {
            return 'Baja de Equipo';
        } else if (tipo === 'TRASPASO') {
            return 'Traspaso de Equipo';
        } else if (tipo === 'REPORTE_PROBLEMA') {
            return 'Reporte de Problema con Equipo';
        } else if (tipo === 'REVISION') {
            return 'Solicitud de Revisión de Equipo';
        } else if (tipo === 'VIGENCIA_PROXIMA') {
            return 'Aviso de Vigencia Próxima';
        } else if (tipo === 'EQUIPO_PERDIDO') {
            return 'Baja por Pérdida';
        } else if (tipo === 'NUEVO_EQUIPO') {
            return 'Solicitud de Nuevo Equipo';
        } else if (tipo === 'EQUIPO_DESHABILITADO') {
            return 'Inhabilitación de Equipo';
        }
        return tipo;
    }


    async acceptForReview(id, usuario_tecnica, feedback = '') {
        try {
            const pool = await getConnection();

            // Move from PENDIENTE_TECNICA to EN_REVISION_TECNICA
            const queryUpdate = `
                UPDATE mae_solicitud_equipo 
                SET estado = 'EN_REVISION_TECNICA',
                    feedback_tecnica = @feedback
                WHERE id_solicitud = @id AND estado = 'PENDIENTE_TECNICA'
            `;

            await pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .input('feedback', sql.NVarChar(sql.MAX), feedback)
                .query(queryUpdate);

            // Notify requester that request was accepted for review
            try {
                const solResult = await pool.request()
                    .input('id', sql.Numeric(10, 0), id)
                    .query(`
                        SELECT s.usuario_solicita, s.tipo_solicitud, s.datos_json, s.origen_solicitud,
                               u.correo_electronico as correo_usuario, u.nombre_usuario,
                               m.nombre_muestreador
                        FROM mae_solicitud_equipo s
                        LEFT JOIN mae_usuario u ON s.usuario_solicita = u.id_usuario
                        LEFT JOIN mae_muestreador m ON s.usuario_solicita = m.id_muestreador AND s.origen_solicitud = 'MUESTREADOR'
                        WHERE s.id_solicitud = @id
                    `);

                if (solResult.recordset.length > 0) {
                    const sol = solResult.recordset[0];
                    const solDatos = typeof sol.datos_json === 'string' ? JSON.parse(sol.datos_json) : sol.datos_json;
                    const correo_destinatario = sol.correo_usuario || solDatos.correo_solicitante;
                    const nombre_muestreador = sol.nombre_usuario || sol.nombre_muestreador || 'Muestreador';

                    const tipoLabel = this._getTipoLabel(sol.tipo_solicitud, solDatos);
                    const context = {
                        CORRELATIVO: id,
                        TIPO_SOLICITUD: tipoLabel,
                        USUARIO: 'Área Técnica',
                        FECHA: new Date().toLocaleDateString('es-CL'),
                        HORA: new Date().toLocaleTimeString('es-CL'),
                        OBSERVACION: `Tu solicitud ha sido aceptada y está siendo revisada por el Área Técnica. ${feedback ? '\nNota: ' + feedback : ''}`,
                        equipos: this._getEquiposList(sol.tipo_solicitud, solDatos)
                    };

                    notificationService.send('SOL_EQUIPO_NUEVA', {
                        ...context,
                        directEmails: correo_destinatario
                    });
                }
            } catch (notifyError) {
                logger.error('Error sending accept notification:', notifyError);
            }

            return { success: true };
        } catch (error) {
            logger.error('Error accepting for review:', error);
            throw error;
        }
    }

    async reviewTechnical(id, { estado_tecnica, feedback, usuario_tecnica, datos_json }) {
        try {
            const pool = await getConnection();

            // Determine global status based on technical status
            let nuevoEstadoGlobal = 'PENDIENTE';
            if (estado_tecnica === 'DERIVADO') {
                nuevoEstadoGlobal = 'PENDIENTE_CALIDAD';
            } else if (estado_tecnica === 'RECHAZADO') {
                nuevoEstadoGlobal = 'RECHAZADO_TECNICA';
            }

            const queryUpdate = `
                UPDATE mae_solicitud_equipo 
                SET estado = @estadoGlobal,
                    estado_tecnica = @estadoTecnica,
                    usuario_revisa = @usuarioTecnica,
                    fecha_revision = GETDATE(),
                    feedback_admin = @feedback,
                    -- Legacy columns (optional to keep for now)
                    usuario_tecnica = @usuarioTecnica,
                    fecha_revision_tecnica = GETDATE(),
                    feedback_tecnica = @feedback
                WHERE id_solicitud = @id
            `;

            const request = pool.request();
            request.input('id', sql.Numeric(10, 0), id)
                .input('estadoGlobal', sql.VarChar(20), nuevoEstadoGlobal)
                .input('estadoTecnica', sql.VarChar(20), estado_tecnica)
                .input('feedback', sql.NVarChar(sql.MAX), feedback)
                .input('usuarioTecnica', sql.Numeric(10, 0), usuario_tecnica);

            let finalQuery = queryUpdate;
            if (datos_json) {
                finalQuery = finalQuery.replace('WHERE id_solicitud = @id', `, datos_json = @datos WHERE id_solicitud = @id`);
                request.input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datos_json));
            }

            await request.query(finalQuery);

            // 2. Fetch details for notification
            try {
                const solResult = await pool.request()
                    .input('id', sql.Numeric(10, 0), id)
                    .query(`
                        SELECT s.usuario_solicita, s.tipo_solicitud, s.datos_json, s.origen_solicitud,
                               u.correo_electronico as correo_usuario, u.nombre_usuario,
                               m.nombre_muestreador
                        FROM mae_solicitud_equipo s
                        LEFT JOIN mae_usuario u ON s.usuario_solicita = u.id_usuario
                        LEFT JOIN mae_muestreador m ON s.usuario_solicita = m.id_muestreador AND s.origen_solicitud = 'MUESTREADOR'
                        WHERE s.id_solicitud = @id
                    `);

                if (solResult.recordset.length > 0) {
                    const sol = solResult.recordset[0];
                    const solDatos = typeof sol.datos_json === 'string' ? JSON.parse(sol.datos_json) : sol.datos_json;
                    const correo_destinatario = sol.correo_usuario || solDatos.correo_solicitante;
                    const nombre_muestreador = sol.nombre_usuario || sol.nombre_muestreador || 'Muestreador';

                    const tipoLabel = this._getTipoLabel(sol.tipo_solicitud, solDatos);
                    const context = {
                        CORRELATIVO: id,
                        TIPO_SOLICITUD: tipoLabel,
                        USUARIO: nombre_muestreador,
                        FECHA: new Date().toLocaleDateString('es-CL'),
                        HORA: new Date().toLocaleTimeString('es-CL'),
                        equipos: this._getEquiposList(sol.tipo_solicitud, solDatos)
                    };

                    if (estado_tecnica === 'DERIVADO') {
                        const eventCodeNueva = `SOL_EQUIPO_${sol.tipo_solicitud}_NUEVA`;
                        // 1. Notify Target (Administrators/Quality according to event config)
                        notificationService.send(eventCodeNueva, {
                            ...context,
                            OBSERVACION: `Derivado por Área Técnica. ${feedback || ''}`
                        });
                    } else if (estado_tecnica === 'RECHAZADO') {
                        // Notify Muestreador (Requester)
                        // Construct specific code for all types
                        eventCode = `SOL_EQUIPO_${sol.tipo_solicitud}_${statusSuffix}`;
                        if (sol.tipo_solicitud === 'ALTA' && solDatos.isReactivation) eventCode = `SOL_EQUIPO_REAC_${statusSuffix}`;

                        notificationService.send(eventCode, {
                            ...context,
                            OBSERVACION: `Rechazado por Área Técnica: ${feedback}`,
                            directEmails: correo_destinatario
                        });
                    }
                }
            } catch (notifyError) {
                logger.error('Error sending technical review notification:', notifyError);
            }

            return { success: true };
        } catch (error) {
            logger.error('Error reviewing solicitud technical:', error);
            throw error;
        }
    }

    async updateStatus(id, status, feedback, adminId, datos_json = null, id_equipo_procesado = null, accion_item = null) {
        try {
            const pool = await getConnection();

            // 1. Get Solicitante details and Request Type before updating
            const solResult = await pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .query(`
                    SELECT s.usuario_solicita, s.tipo_solicitud, s.datos_json, s.origen_solicitud,
                           u.correo_electronico as correo_usuario, u.nombre_usuario,
                           m.nombre_muestreador
                    FROM mae_solicitud_equipo s
                    LEFT JOIN mae_usuario u ON s.usuario_solicita = u.id_usuario
                    LEFT JOIN mae_muestreador m ON s.usuario_solicita = m.id_muestreador AND s.origen_solicitud = 'MUESTREADOR'
                    WHERE s.id_solicitud = @id
                `);

            if (solResult.recordset.length === 0) {
                logger.warn(`No se encontró la solicitud ${id} para actualizar estado.`);
                return { success: false, message: 'Solicitud no encontrada' };
            }

            const sol = solResult.recordset[0];
            const solDatos = typeof sol.datos_json === 'string' ? JSON.parse(sol.datos_json) : sol.datos_json;
            const correo_destinatario = sol.correo_usuario || solDatos.correo_solicitante;

            // Special override for "Derivación":
            // User requested that "Derivar a Revisión Técnica" sets the main status to 'APROBADO' (Quality finished)
            // but sets a technical flag to keep it active for Technical Area.
            let effectiveStatusDB = status;
            let effectiveEstadoTecnica = null;

            if (status === 'PENDIENTE_TECNICA') {
                effectiveStatusDB = 'APROBADO';
                effectiveEstadoTecnica = 'PENDIENTE';
            }

            let query = `
                UPDATE mae_solicitud_equipo 
                SET estado = @status, 
                    feedback_aprobacion = @feedback, 
                    usuario_aprueba = @adminId, 
                    fecha_aprobacion = GETDATE(),
                    -- Legacy fallback
                    feedback_admin = @feedback,
                    usuario_revisa = CASE WHEN usuario_revisa IS NULL THEN @adminId ELSE usuario_revisa END,
                    fecha_revision = CASE WHEN fecha_revision IS NULL THEN GETDATE() ELSE fecha_revision END
            `;

            if (effectiveEstadoTecnica) {
                query += `, estado_tecnica = '${effectiveEstadoTecnica}' `;
            }

            const request = pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .input('status', sql.VarChar(20), effectiveStatusDB)
                .input('feedback', sql.VarChar(1000), feedback)
                .input('adminId', sql.Numeric(10, 0), adminId);

            if (datos_json) {
                query += `, datos_json = @datos`;
                request.input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datos_json));
            }

            query += ` WHERE id_solicitud = @id`;

            await request.query(query);

            // Enviar notificación de resultado
            try {
                const adminResult = await pool.request()
                    .input('id', sql.Numeric(10, 0), adminId)
                    .query("SELECT nombre_usuario FROM mae_usuario WHERE id_usuario = @id");

                const adminName = adminResult.recordset[0]?.nombre_usuario || 'Administrador';
                const currentSolDatos = datos_json || solDatos;

                let eventCode = '';
                const effectiveStatus = (status === 'PENDIENTE' && id_equipo_procesado && accion_item)
                    ? accion_item
                    : status;

                if (effectiveStatus === 'PENDIENTE') {
                    return { success: true };
                }

                const statusSuffix = effectiveStatus === 'APROBADO' ? 'APR' : 'RECH';
                const type = sol.tipo_solicitud;
                const tipoLabel = this._getTipoLabel(type, currentSolDatos);

                if (type === 'TRASPASO') eventCode = `SOL_EQUIPO_TRASPASO_${statusSuffix}`;
                else if (type === 'BAJA') eventCode = `SOL_EQUIPO_BAJA_${statusSuffix}`;
                else if (type === 'ALTA') {
                    const isReac = currentSolDatos?.isReactivation || false;
                    eventCode = isReac ? `SOL_EQUIPO_REAC_${statusSuffix}` : `SOL_EQUIPO_ALTA_${statusSuffix}`;
                } else {
                    // Use specific code for all other types: REVISION, VIGENCIA_PROXIMA, EQUIPO_PERDIDO, REPORTE_PROBLEMA, NUEVO_EQUIPO, EQUIPO_DESHABILITADO
                    eventCode = `SOL_EQUIPO_${type}_${statusSuffix}`;
                }

                if (eventCode) {
                    const notificationContext = {
                        CORRELATIVO: id,
                        TIPO_SOLICITUD: tipoLabel,
                        USUARIO: adminName,
                        FECHA: new Date().toLocaleDateString('es-CL'),
                        HORA: new Date().toLocaleTimeString('es-CL'),
                        OBSERVACION: feedback || (status === 'APROBADO' ? 'Aprobado correctamente' : 'Sin motivo especificado'),
                        equipos: this._getEquiposList(type, currentSolDatos, id_equipo_procesado)
                    };

                    // For generic fallback, we prepend the Result to the observation to be clear
                    if (eventCode === 'SOL_EQUIPO_NUEVA') {
                        notificationContext.OBSERVACION = `RESULTADO: ${status}. ${notificationContext.OBSERVACION}`;
                    }

                    // Notificar al Solicitante
                    notificationService.send(eventCode, {
                        ...notificationContext,
                        directEmails: correo_destinatario
                    });

                    // Notificar al Área Técnica
                    notificationService.send(eventCode, {
                        ...notificationContext,
                        OBSERVACION: `Calidad ha procesado la solicitud. Resultado: ${status}. ${feedback || ''}`,
                        permissionRecibir: 'AI_MA_SOLICITUDES'
                    });
                }
            } catch (notifyError) {
                logger.error('Error sending result notification:', notifyError);
            }

            if (status === 'APROBADO') {
                try {
                    const type = sol.tipo_solicitud;
                    const currentSolDatos = datos_json || solDatos; // Use newest data if available

                    if (type === 'VIGENCIA_PROXIMA') {
                        // Logic: Update equipment 'fecha_vigencia'
                        // Expects: id_equipo, nueva_vigencia_solicitada (or approved override)
                        const idEquipo = currentSolDatos.id_equipo;
                        const nuevaVigencia = currentSolDatos.nueva_vigencia_solicitada;

                        if (idEquipo && nuevaVigencia) {
                            await equipoService.updateEquipo(idEquipo, {
                                vigencia: nuevaVigencia,
                                observacion: `Vigencia actualizada por solicitud ${id}. ${feedback || ''}`
                            }, adminId);
                            logger.info(`VIGENCIA_PROXIMA approved: Updated equipo ${idEquipo} vigencia to ${nuevaVigencia}`);
                        } else {
                            logger.warn(`VIGENCIA_PROXIMA approved but missing id_equipo or nova_vigencia for solicitud ${id}`);
                        }

                    } else if (type === 'EQUIPO_PERDIDO') {
                        // Logic: Mark equipment as 'Inactivo' (or similar status)
                        const idEquipo = currentSolDatos.id_equipo;
                        if (idEquipo) {
                            // Option A: Soft Delete (disable)
                            // await equipoService.deleteEquipo(idEquipo, adminId);

                            // Option B: Update status and observation (Better for "Lost" tracking)
                            await equipoService.updateEquipo(idEquipo, {
                                estado: 'Inactivo', // Or 'Perdido', depending on enum
                                observacion: `EQUIPO DECLARADO PERDIDO (Solicitud ${id}). ${currentSolDatos.tipo_perdida} - ${currentSolDatos.circunstancias}. ${feedback || ''}`
                            }, adminId);

                            logger.info(`EQUIPO_PERDIDO approved: Marked equipo ${idEquipo} as Inactivo`);
                        }
                    } else if (type === 'EQUIPO_DESHABILITADO') {
                        // Logic: Mark equipment as 'Inactivo' (Temporary disabling) and update validity date
                        const idEquipo = currentSolDatos.id_equipo;
                        if (idEquipo) {
                            await equipoService.updateEquipo(idEquipo, {
                                estado: 'Inactivo', // Sets habilitado = 'N'
                                fecha_vigencia: currentSolDatos.nueva_vigencia_solicitada || null,
                                observacion: `EQUIPO FUERA DE SERVICIO TEMPORAL (Solicitud ${id}). Motivo: ${currentSolDatos.motivo || currentSolDatos.comentario || 'Inhabilitación temporal'}. ${feedback || ''}`
                            }, adminId);

                            logger.info(`EQUIPO_DESHABILITADO approved: Marked equipo ${idEquipo} as Inactivo with new validity date`);
                        }
                    } else if (type === 'REPORTE_PROBLEMA' && currentSolDatos.severidad === 'CRITICA') {
                        // Logic: Add observation log? Maybe disable if critical?
                        const idEquipo = currentSolDatos.id_equipo;
                        if (idEquipo) {
                            await equipoService.updateEquipo(idEquipo, {
                                observacion: `PROBLEMA CRÍTICO REPORTADO (Solicitud ${id}): ${currentSolDatos.tipo_problema}. ${currentSolDatos.descripcion}`
                            }, adminId);
                        }
                    }
                } catch (updateErr) {
                    logger.error(`Error updating equipment for solicitud ${id} approval:`, updateErr);
                    // Decide: Should we revert the approval? For now, just log error but allow approval to stand?
                    // Or maybe re-throw to rollback? Current logic doesn't have transaction wrapping both.
                    // For safety, let's keep approval but clearly log failure.
                }
            }

            return { success: true };
        } catch (error) {
            logger.error('Error updating solicitud status:', error);
            throw error;
        }
    }

    _getEquiposList(type, solDatos, id_equipo_procesado = null) {
        if (!solDatos) return [];

        if (type === 'ALTA' && !solDatos.isReactivation) {
            return [{
                nombre: solDatos.nombre,
                codigo: solDatos.codigo,
                tipo: solDatos.tipo,
                marca: solDatos.marca,
                modelo: solDatos.modelo,
                serie: solDatos.serie,
                ubicacion: solDatos.ubicacion,
                vigencia: solDatos.vigencia,
                responsable: solDatos.responsable || solDatos.responsable_nombre,
                status: 'SOLICITADO'
            }];
        } else if (type === 'BAJA' || (type === 'ALTA' && solDatos.isReactivation)) {
            const listRaw = type === 'BAJA' ? (solDatos.equipos_baja || []) : (solDatos.equipos_alta || []);
            let list = listRaw;
            if (id_equipo_procesado) {
                list = list.filter(e => String(e.id) === String(id_equipo_procesado));
            }
            return list.map(e => ({
                id: e.id,
                nombre: e.nombre || (e.datos_originales ? e.datos_originales.nombre : 'Equipo'),
                codigo: e.codigo || (e.datos_originales ? e.datos_originales.codigo : 'N/A'),
                tipo: e.tipo || (e.datos_originales ? e.datos_originales.tipo : 'N/A'),
                marca: e.marca || (e.datos_originales ? e.datos_originales.marca : ''),
                modelo: e.modelo || (e.datos_originales ? e.datos_originales.modelo : ''),
                serie: e.serie || (e.datos_originales ? e.datos_originales.serie : ''),
                ubicacion: e.ubicacion || (e.datos_originales ? e.datos_originales.ubicacion : 'N/A'),
                responsable: e.responsable || e.responsable_nombre || solDatos.responsable || solDatos.responsable_nombre || 'N/A',
                vigencia: e.vigencia,
                status: e.rechazado ? 'RECHAZADO' : (e.procesado ? 'APROBADO' : 'SOLICITADO')
            }));
        } else if (type === 'TRASPASO') {
            return [{
                nombre: solDatos.equipo_nombre || solDatos.nombre,
                codigo: solDatos.equipo_codigo || solDatos.codigo,
                tipo: solDatos.equipo_tipo || solDatos.tipo,
                isTransfer: true,
                datos_antiguos: {
                    ubicacion: solDatos.ubicacion_actual,
                    responsable: solDatos.responsable_actual || 'Sin Asignar'
                },
                datos_nuevos: {
                    ubicacion: solDatos.nueva_ubicacion,
                    responsable: solDatos.nuevo_responsable_nombre || solDatos.nuevo_responsable
                },
                vigencia: solDatos.vigencia
            }];
        } else if (type === 'NUEVO_EQUIPO') {
            return [{
                nombre: solDatos.nombre,
                codigo: solDatos.codigo,
                tipo: solDatos.tipo,
                marca: solDatos.marca,
                modelo: solDatos.modelo,
                serie: solDatos.serie,
                ubicacion: solDatos.ubicacion,
                vigencia: solDatos.vigencia,
                responsable: solDatos.responsable || solDatos.responsable_nombre,
                status: 'SOLICITADO'
            }];
        } else {
            // General support for REVISION, REPORTE_PROBLEMA, EQUIPO_PERDIDO, VIGENCIA_PROXIMA, EQUIPO_DESHABILITADO
            const eq = {
                nombre: solDatos.nombre || solDatos.equipo_nombre || solDatos.nombre_equipo || 'N/A',
                codigo: solDatos.codigo || solDatos.equipo_codigo || solDatos.codigo_equipo || 'N/A',
                tipo: solDatos.tipo || 'N/A',
                ubicacion: solDatos.ubicacion || solDatos.ubicacion_registrada || 'N/A',
                responsable: solDatos.responsable || solDatos.responsable_actual || 'N/A',
                vigencia: solDatos.vigencia || solDatos.vigencia_actual || 'N/A',
                status: 'SOLICITADO'
            };

            // Enrichment for Problem Report
            if (type === 'REPORTE_PROBLEMA') {
                eq.tipo_problema = solDatos.tipo_problema;
                eq.severidad = solDatos.severidad;
                eq.frecuencia = solDatos.frecuencia;
                eq.afecta_mediciones = solDatos.afecta_mediciones ? 'Sustancialmente (SI)' : 'No significativamente (NO)';
                eq.descripcion = solDatos.descripcion;
                eq.sintomas = solDatos.sintomas;
            }

            // Enrichment for Lost Equipment
            if (type === 'EQUIPO_PERDIDO') {
                eq.fecha_incidente = solDatos.fecha_incidente;
                eq.tipo_perdida = solDatos.tipo_perdida;
                eq.circunstancias = solDatos.circunstancias;
                eq.acciones_tomadas = solDatos.acciones_tomadas;
                eq.testigos = solDatos.testigos;
            }

            // Enrichment for Revision
            if (type === 'REVISION') {
                eq.motivo_revision = solDatos.motivo_revision;
                eq.descripcion = solDatos.descripcion;
                eq.urgencia = solDatos.urgencia;
            }

            // Enrichment for Vigencia Update
            if (type === 'VIGENCIA_PROXIMA') {
                eq.nueva_vigencia = solDatos.nueva_vigencia_solicitada;
                eq.justificacion = solDatos.justificacion;
            }

            // Enrichment for Equipment Disabled (Out of service)
            if (type === 'EQUIPO_DESHABILITADO') {
                eq.motivo = solDatos.motivo || solDatos.descripcion;
                eq.nueva_vigencia = solDatos.nueva_vigencia_solicitada;
            }

            return [eq];
        }
    }
}

export default new SolicitudService();

