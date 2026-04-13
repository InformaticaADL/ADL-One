import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { equipoService } from './equipo.service.js';

class UrsService {
    /**
     * Obtiene los tipos de solicitud configurados
     */
    async getTypes(soloActivos = true, userId = null, isAdmin = false) {
        try {
            const pool = await getConnection();
            
            let query = `
                SELECT DISTINCT t.id_tipo, t.nombre, t.area_destino, 
                       t.cod_permiso_crear as permiso_acceso, 
                       t.cod_permiso_resolver as permiso_resolucion, 
                       t.estado, t.formulario_config, t.modulo_destino 
                FROM mae_solicitud_tipo t
            `;
 
            if (userId) {
                // Filter by granular 'ENVIO' permissions (Universal Permissions Phase 22)
                query += `
                    LEFT JOIN rel_solicitud_tipo_permiso p ON t.id_tipo = p.id_tipo AND p.tipo_acceso = 'ENVIO'
                    LEFT JOIN rel_usuario_rol ur ON (p.id_rol = ur.id_rol AND ur.id_usuario = @userId)
                    WHERE (t.estado = 1 OR @soloActivos = 0)
                    AND (
                        -- Admin bypass
                        @isAdmin = 1
                        -- OR the user is explicitly assigned
                        OR p.id_usuario = @userId
                        -- OR one of the user's roles is assigned
                        OR ur.id_rol IS NOT NULL
                    )
                `;
            } else {
                if (soloActivos) query += ' WHERE estado = 1';
            }
            
            const request = pool.request();
            if (userId) request.input('userId', sql.Numeric(10, 0), userId);
            request.input('soloActivos', sql.Bit, soloActivos);
            request.input('isAdmin', sql.Bit, isAdmin ? 1 : 0);

            const result = await request.query(query);
            return result.recordset;
        } catch (error) {
            logger.error('Error in UrsService.getTypes:', error);
            throw error;
        }
    }

    /**
     * Crea o actualiza un tipo de solicitud (Admin)
     */
    async createUpdateType(idType, data) {
        try {
            const pool = await getConnection();
            const request = pool.request()
                .input('nombre', sql.VarChar(100), data.nombre)
                .input('area', sql.VarChar(50), data.area_destino)
                .input('permiso', sql.VarChar(50), data.permiso_acceso || null)
                .input('resolucion', sql.VarChar(50), data.permiso_resolucion || null)
                .input('formulario', sql.NVarChar(sql.MAX), data.formulario_config ? JSON.stringify(data.formulario_config) : null)
                .input('modulo', sql.VarChar(50), data.modulo_destino || null)
                .input('estado', sql.Bit, data.estado ?? 1);

            if (idType) {
                // Update
                await request
                    .input('id', sql.Numeric(10, 0), idType)
                    .query(`
                        UPDATE mae_solicitud_tipo 
                        SET nombre = @nombre, 
                            area_destino = @area, 
                            cod_permiso_crear = @permiso,
                            cod_permiso_resolver = @resolucion,
                            formulario_config = @formulario,
                            modulo_destino = @modulo,
                            estado = @estado,
                            fecha_actualizacion = SYSUTCDATETIME()
                        WHERE id_tipo = @id
                    `);
                return { id_tipo: idType, ...data };
            } else {
                // Create
                const result = await request.query(`
                    INSERT INTO mae_solicitud_tipo (nombre, area_destino, cod_permiso_crear, cod_permiso_resolver, formulario_config, modulo_destino, estado)
                    OUTPUT INSERTED.id_tipo
                    VALUES (@nombre, @area, @permiso, @resolucion, @formulario, @modulo, @estado)
                `);
                return { id_tipo: result.recordset[0].id_tipo, ...data };
            }
        } catch (error) {
            logger.error('Error in UrsService.createUpdateType:', error);
            throw error;
        }
    }

    /**
     * Alterna el estado de un tipo de solicitud
     */
    async toggleTypeStatus(idType, estado) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('id', sql.Numeric(10, 0), idType)
                .input('estado', sql.Bit, estado)
                .query('UPDATE mae_solicitud_tipo SET estado = @estado WHERE id_tipo = @id');
            return { success: true };
        } catch (error) {
            logger.error('Error in UrsService.toggleTypeStatus:', error);
            throw error;
        }
    }

    // --- Granular Permissions (Phase 22: Migration to rel_solicitud_tipo_permiso) ---

    async getPermissions(idTipo) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('id', sql.Numeric(10, 0), idTipo)
                .query(`
                    SELECT p.*, r.nombre_rol, u.nombre_usuario, u.usuario as nombre_real
                    FROM rel_solicitud_tipo_permiso p
                    LEFT JOIN mae_rol r ON p.id_rol = r.id_rol
                    LEFT JOIN mae_usuario u ON p.id_usuario = u.id_usuario
                    WHERE p.id_tipo = @id
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error in UrsService.getPermissions:', error);
            throw error;
        }
    }

    async addPermission(idTipo, data) {
        try {
            const pool = await getConnection();
            // Data mapping for compatibility with frontend that might send idRol/idUsuario
            const idRol = data.id_rol || data.idRol || null;
            const idUsr = data.id_usuario || data.idUsuario || null;
            const tipoAcceso = data.tipo_acceso || data.accion || 'ENVIO';

            const result = await pool.request()
                .input('idTipo', sql.Numeric(10, 0), idTipo)
                .input('idRol', sql.Numeric(10, 0), idRol)
                .input('idUsr', sql.Numeric(10, 0), idUsr)
                .input('tipo', sql.VarChar(20), tipoAcceso)
                .query(`
                    INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, id_usuario, tipo_acceso)
                    OUTPUT INSERTED.id_permiso_sol
                    VALUES (@idTipo, @idRol, @idUsr, @tipo)
                `);
            return { id_permiso_sol: result.recordset[0].id_permiso_sol, ...data };
        } catch (error) {
            logger.error('Error in UrsService.addPermission:', error);
            throw error;
        }
    }

    async removePermission(idRelacion) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('id', sql.Numeric(10, 0), idRelacion)
                .query('DELETE FROM rel_solicitud_tipo_permiso WHERE id_permiso_sol = @id');
            return { success: true };
        } catch (error) {
            logger.error('Error in UrsService.removePermission:', error);
            throw error;
        }
    }

    async getDerivationTargets(idTipo) {
        try {
            const pool = await getConnection();
            // Phase 41: Get all configured targets (explicit users or whole roles) 
            // from the permissions table instead of trying to expand roles manually.
            const result = await pool.request()
                .input('id', sql.Numeric(10, 0), idTipo)
                .query(`
                    SELECT DISTINCT
                           p.id_rol, r.nombre_rol,
                           p.id_usuario, u.nombre_usuario, u.usuario as nombre_real
                    FROM rel_solicitud_tipo_permiso p
                    LEFT JOIN mae_rol r ON p.id_rol = r.id_rol
                    LEFT JOIN mae_usuario u ON p.id_usuario = u.id_usuario
                    WHERE p.id_tipo = @id AND p.tipo_acceso = 'DESTINO_DERIVACION'
                    AND (u.habilitado = 'S' OR u.id_usuario IS NULL)
                `);
            
            return result.recordset;
        } catch (error) {
            logger.error('Error in UrsService.getDerivationTargets:', error);
            throw error;
        }
    }

    // --- Notification Config (Phase 22) ---

    async getNotificationConfig(idTipo) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('id', sql.Numeric(10, 0), idTipo)
                .query(`
                    SELECT * FROM rel_solicitud_tipo_notificacion WHERE id_tipo = @id
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error in UrsService.getNotificationConfig:', error);
            throw error;
        }
    }

    async saveNotificationConfig(idTipo, configs) {
        try {
            const pool = await getConnection();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                // Remove existing
                await new sql.Request(transaction)
                    .input('id', sql.Numeric(10, 0), idTipo)
                    .query('DELETE FROM rel_solicitud_tipo_notificacion WHERE id_tipo = @id');

                // Insert new ones
                for (const cfg of configs) {
                    await new sql.Request(transaction)
                        .input('id', sql.Numeric(10, 0), idTipo)
                        .input('accion', sql.VarChar(50), cfg.accion)
                        .input('web', sql.Bit, cfg.notifica_web ? 1 : 0)
                        .input('email', sql.Bit, cfg.notifica_email ? 1 : 0)
                        .query(`
                            INSERT INTO rel_solicitud_tipo_notificacion (id_tipo, accion, notifica_web, notifica_email)
                            VALUES (@id, @accion, @web, @email)
                        `);
                }

                await transaction.commit();
                return { success: true };
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } catch (error) {
            logger.error('Error in UrsService.saveNotificationConfig:', error);
            throw error;
        }
    }

    /**
     * Crea una nueva solicitud unificada
     */
    async createRequest(idTipo, idSolicitante, datos, prioridad = 'NORMAL', areaActual = null, observaciones = '', files = []) {
        logger.info('URS: createRequest called', { idTipo, idSolicitante, datos });
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            // --- ROBUST RESOLUTION LAYER (ID 466 Resiliency & Equipment Auto-fetch) ---
            
            // 1. Resolve Sampler Identity (Fixed for ID 466 Generic User)
            if (Number(idSolicitante) === 466) {
                const samplerId = datos.id_muestreador || datos.muestreador_id || datos.idMuestreador;
                if (samplerId) {
                    try {
                        const samplerRes = await pool.request()
                            .input('sid', sql.Int, Number(samplerId))
                            .query("SELECT nombre_muestreador, correo_electronico FROM mae_muestreador WHERE id_muestreador = @sid");
                        if (samplerRes.recordset.length > 0) {
                            const sampler = samplerRes.recordset[0];
                            datos.nombre_tecnico = sampler.nombre_muestreador;
                            datos.correo_tecnico = sampler.correo_electronico;
                            logger.info(`URS: Identified sampler ${sampler.nombre_muestreador} for generic request 466`);
                        }
                    } catch (idErr) {
                        logger.error('URS: Error resolving emergency sampler identity:', idErr);
                    }
                }
            }

            // 2. Resolve Equipment (Ensure brackets [CODE] are always present)
            const eqIdResolved = datos?.id_equipo || datos?.equipo_id || datos?.idEquipo || datos?.equipo;
            if (eqIdResolved) {
                const hasValidFullName = datos.nombre_equipo_full && datos.nombre_equipo_full.includes('[') && datos.nombre_equipo_full !== 'N/A';
                
                if (!hasValidFullName || !datos.codigo_equipo) {
                    try {
                        const eqRes = await pool.request()
                            .input('eqId', sql.Int, Number(eqIdResolved))
                            .query("SELECT nombre, codigo, LTRIM(RTRIM(nombre)) + ' [' + LTRIM(RTRIM(codigo)) + ']' as full_name FROM mae_equipo WHERE id_equipo = @eqId");
                        if (eqRes.recordset.length > 0) {
                            const eqData = eqRes.recordset[0];
                            datos.nombre_equipo_full = eqData.full_name;
                            datos.nombre_equipo = eqData.nombre;
                            datos.codigo_equipo = eqData.codigo;
                            logger.info(`URS: Resolved equipment ${eqData.full_name} for request`);
                        }
                    } catch (eqErr) {
                        logger.error('URS: Error auto-fetching equipment code:', eqErr);
                    }
                }
            }

            // Standardize Date Formatting (DD-MM-YYYY) for DB and Notifications
            const dateFields = ['fecha_suceso', 'fecha_extravio', 'fecha_ocurrencia', 'fecha_solicitud', 'fecha_anulacion', 'fecha_baja'];
            dateFields.forEach(field => {
                let val = datos[field];
                if (val && !String(val).match(/^\d{2}-\d{2}-\d{4}$/)) {
                    try {
                        let d = null;
                        if (typeof val === 'string' && val.includes('-')) {
                            // Split ISO date manually to avoid timezone shifts
                            const parts = val.split('T')[0].split('-');
                            if (parts.length === 3) {
                                if (parts[0].length === 4) d = { day: parts[2], month: parts[1], year: parts[0] };
                                else if (parts[2].length === 4) d = { day: parts[0], month: parts[1], year: parts[2] };
                            }
                        }
                        
                        if (!d) {
                            const dateObj = new Date(val);
                            if (!isNaN(dateObj.getTime())) {
                                d = {
                                    day: String(dateObj.getUTCDate()).padStart(2, '0'),
                                    month: String(dateObj.getUTCMonth() + 1).padStart(2, '0'),
                                    year: dateObj.getUTCFullYear()
                                };
                            }
                        }

                        if (d) {
                            datos[field] = `${String(d.day).padStart(2, '0')}-${String(d.month).padStart(2, '0')}-${d.year}`;
                        }
                    } catch (err) {
                        logger.error(`URS: Error formatting date for field ${field}:`, err);
                    }
                }
            });

            // Ensure we have a date for the suceso/report even if app didn't send it specifically
            if (!datos.fecha_suceso && !datos.fecha_extravio && !datos.fecha_ocurrencia) {
                const now = new Date();
                datos.fecha_suceso = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
            }

            // Aliasing for template placeholders
            if (datos.fecha_extravio && !datos.fecha_suceso) datos.fecha_suceso = datos.fecha_extravio;
            if (datos.fecha_suceso && !datos.fecha_extravio) datos.fecha_extravio = datos.fecha_suceso;
            if (datos.fecha_ocurrencia && !datos.fecha_suceso) datos.fecha_suceso = datos.fecha_ocurrencia;
            if (datos.nombre_equipo_full && !datos.equipo_nombre) datos.equipo_nombre = datos.nombre_equipo_full;
            if (datos.nombre_equipo_full && !datos.nombre_equipo) datos.nombre_equipo = datos.nombre_equipo_full;
            // -----------------------------------------------------------------

            if (!areaActual) {
                const tipoRes = await new sql.Request(transaction)
                    .input('idTipo', sql.Numeric(10, 0), idTipo)
                    .query('SELECT area_destino FROM mae_solicitud_tipo WHERE id_tipo = @idTipo');
                if (tipoRes.recordset.length > 0) {
                    areaActual = tipoRes.recordset[0].area_destino;
                }
            }


            const result = await new sql.Request(transaction)
                .input('idTipo', sql.Numeric(10, 0), idTipo)
                .input('idSol', sql.Numeric(10, 0), idSolicitante)
                .input('prioridad', sql.VarChar(20), prioridad)
                .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datos))
                .input('areaD', sql.VarChar(50), areaActual)
                .input('obs', sql.NVarChar(sql.MAX), observaciones)
                .query(`
                    INSERT INTO mae_solicitud (id_tipo, id_solicitante, estado, area_actual, datos_json, fecha_creacion, observaciones, prioridad)
                    OUTPUT INSERTED.id_solicitud
                    VALUES (@idTipo, @idSol, 'PENDIENTE', @areaD, @datos, GETUTCDATE(), @obs, @prioridad)
                `);

            const idSolicitud = result.recordset[0].id_solicitud;

            // Process Attachments (Phase 27) - Passing transaction
            if (files && files.length > 0) {
                await this.processAttachments(idSolicitud, null, files, transaction);
            }

            await transaction.commit();

            // Mobile Sub-type Specialization (V18 Robustness)
            let currentIdTipo = Number(idTipo);
            if (currentIdTipo === 13) {
                const relTipo = (datos.relacion_tipo || '').toUpperCase();
                const hasEq = !!(datos.id_equipo || datos.idEquipo || datos.equipo);
                const hasFi = !!(datos.id_ficha || datos.num_ficha || datos.id_muestreo);

                let newId = 13;
                if (relTipo === 'EQUIPO' || (relTipo === '' && hasEq)) {
                    newId = 14;
                } else if (relTipo === 'SERVICIO' || relTipo === 'FICHA' || (relTipo === '' && hasFi)) {
                    newId = 15;
                }

                if (newId && newId !== 13) {
                    currentIdTipo = newId;
                    logger.info(`URS: Specializing request #${idSolicitud} from 13 to ${currentIdTipo} (Rel: ${relTipo || 'DETECCIÓN POR ID'})`);
                    // Persist specialized type to DB immediately
                    await pool.request()
                        .input('id', sql.Numeric(10, 0), idSolicitud)
                        .input('newId', sql.Int, currentIdTipo)
                        .query('UPDATE mae_solicitud SET id_tipo = @newId WHERE id_solicitud = @id');
                }
            }

            // Enhanced identity and equipment resolution (V9 Robustness)
            const idActualMuesRaw = Number(idSolicitante) === 466 || Number(idSolicitante) === 229
                ? (datos.id_muestreador || datos.id_tecnico || datos.idTecnico || idSolicitante)
                : idSolicitante;
            const idActualMues = isNaN(Number(idActualMuesRaw)) ? 0 : Number(idActualMuesRaw);

            const idEquipoRefRaw = solicitud.id_equipo || datos.id_equipo || datos.idEquipo || datos.equipo;
            const idEquipoRefNum = isNaN(Number(idEquipoRefRaw)) ? 0 : Number(idEquipoRefRaw);
            const equipoNombreFallback = isNaN(Number(idEquipoRefRaw)) ? String(idEquipoRefRaw) : '';

            // After successful commit, get data for UNS and return
            const solicitudRes = await pool.request()
                .input('id', sql.Numeric(10, 0), idSolicitud)
                .input('idActualMues', sql.Int, idActualMues)
                .input('idEquipoRef', sql.Int, idEquipoRefNum)
                .input('idTipoFinal', sql.Int, currentIdTipo)
                .input('eqNombreFallback', sql.VarChar, equipoNombreFallback)
                .query(`
                    SELECT s.*, t.nombre as nombre_tipo, 
                           COALESCE(m_actual.nombre_muestreador, m.nombre_muestreador, u.nombre_usuario, u.usuario, 'Desconocido') as nombre_solicitante,
                           COALESCE(
                               e.nombre + ' [' + e.codigo + ']', 
                               (SELECT TOP 1 nombre + ' [' + codigo + ']' FROM mae_equipo WHERE nombre = @eqNombreFallback),
                               @eqNombreFallback, 
                               CAST(@idEquipoRef as VARCHAR)
                           ) as nombre_equipo_full,
                           COALESCE(e.codigo, (SELECT TOP 1 codigo FROM mae_equipo WHERE nombre = @eqNombreFallback)) as codigo_equipo_db,
                           CONVERT(VARCHAR(33), s.fecha_creacion, 126) + 'Z' as fecha_solicitud
                    FROM mae_solicitud s
                    JOIN mae_solicitud_tipo t ON t.id_tipo = @idTipoFinal
                    LEFT JOIN mae_muestreador m ON s.id_solicitante = m.id_muestreador
                    LEFT JOIN mae_usuario u ON s.id_solicitante = u.id_usuario
                    LEFT JOIN mae_muestreador m_actual ON @idActualMues = m_actual.id_muestreador
                    LEFT JOIN mae_equipo e ON (s.id_equipo = e.id_equipo OR (@idEquipoRef > 0 AND @idEquipoRef = e.id_equipo))
                    WHERE s.id_solicitud = @id
                `);

            const solicitud = solicitudRes.recordset[0];
            solicitud.datos_json = JSON.parse(solicitud.datos_json || '{}');
            
            // Trigger UNS (Phase 13/32 moved to end of flow)
            try {
                logger.info(`URS: Disparando UNS para solicitud #${idSolicitud} (Tipo Orig: ${idTipo}, Final: ${currentIdTipo})`);
                const uns = await import('./uns.service.js');
                // Detalle extendido para placeholders específicos por tipo
                let eventOverride = 'SOLICITUD_NUEVA';
                const idTipoFinal = Number(currentIdTipo);
                const nombreTipoUpper = (solicitud.nombre_tipo || '').toUpperCase();

                if (nombreTipoUpper.includes('TRASPASO')) {
                    const traspasoDe = datos.traspaso_de || [];
                    const hasSede = traspasoDe.includes('UBICACION');
                    const hasMues = traspasoDe.includes('RESPONSABLE');
                    
                    if (hasSede && hasMues) eventOverride = 'SOL_TRASPASO_AMBOS_NUEVA';
                    else if (hasSede) eventOverride = 'SOL_TRASPASO_SEDE_NUEVA';
                    else eventOverride = 'SOL_TRASPASO_MUESTREADOR_NUEVA';
                    
                    // Extraer data actual a primer nivel para los correos comparativos
                    if (datos.info_actual) {
                        datos.sede_actual = datos.info_actual.ubicacion || 'No asignada';
                        datos.responsable_actual = datos.info_actual.responsable || 'No asignado';
                    }
                } else if (nombreTipoUpper.includes('BAJA')) {
                    eventOverride = 'SOL_EQUIPO_BAJA_NUEVA';
                } else if (nombreTipoUpper.includes('DESHABILITAR')) {
                    eventOverride = 'SOL_DESHABILITAR_MUESTREADOR_NUEVA';
                } else if (nombreTipoUpper.includes('ACTIVACI')) {
                    eventOverride = 'SOL_EQUIPO_ALTA_NUEVA';
                } else if (nombreTipoUpper.includes('NUEVO EQUIPO')) {
                    eventOverride = 'SOL_EQUIPO_NUEVO_EQUIPO_NUEVA';
                } else if (idTipoFinal === 10 || nombreTipoUpper.includes('REPORTE')) {
                    eventOverride = idTipoFinal === 10 ? 'AVISO_PROBLEMA_NUEVO' : 'SOL_EQUIPO_REPORTE_PROBLEMA_NUEVA';
                } else if (idTipoFinal === 11) {
                    eventOverride = 'AVISO_PERDIDO_NUEVO';
                } else if (idTipoFinal === 12) {
                    eventOverride = 'AVISO_CANCELACION_NUEVA';
                } else if (idTipoFinal === 13) {
                    eventOverride = 'AVISO_CONSULTA_NUEVA';
                } else if (idTipoFinal === 14) {
                    eventOverride = 'AVISO_CONSULTA_EQUIPO_NUEVA';
                } else if (idTipoFinal === 15) {
                    eventOverride = 'AVISO_CONSULTA_FICHA_NUEVA';
                }
                
                // Aliases for unified notification format
                const TITULO_CORREO = `Nueva Solicitud de ${solicitud.nombre_tipo}`;
                let USUARIO_NOMBRE = solicitud.nombre_solicitante || 'Técnico en Terreno (App)'; 
                if (USUARIO_NOMBRE === 'Desconocido' || !USUARIO_NOMBRE) USUARIO_NOMBRE = 'Técnico en Terreno (App)';
                
                // Prioritize business correlative for some types (V19.1)
                const CORRELATIVO = datos.correlativo || datos.num_ficha || datos.id_muestreo || String(idSolicitud);

                // Consolidated Observation logic
                const finalObs = datos.motivo || datos.descripcion_problema || datos.observaciones || observaciones || 'Sin observaciones';

                logger.info(`URS: Triggering UNS event: ${eventOverride} for #${idSolicitud}`);
                await uns.default.trigger(eventOverride, {
                    ...datos, // Expandir todos los campos del formulario para placeholders directos
                    datos_json: datos, // Requerido por la lógica de NotificationService especializada
                    id_solicitud: idSolicitud,
                    id_tipo: idTipo,
                    id_solicitante: idSolicitante,
                    id_usuario_accion: idSolicitante,
                    id_usuario_propietario: idSolicitante,
                    TITULO_CORREO: TITULO_CORREO,
                    TIPO_SOLICITUD: solicitud.nombre_tipo,
                    CORRELATIVO: CORRELATIVO,
                    usuario_accion: USUARIO_NOMBRE,
                    USUARIO: USUARIO_NOMBRE,
                    SOLICITANTE: USUARIO_NOMBRE,
                    nombre_solicitante: USUARIO_NOMBRE,
                    FECHA: new Date().toLocaleDateString('es-CL'),
                    HORA: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: true }),
                    FECHA_SOLICITUD: new Date().toLocaleString('es-CL'),
                    equipo_nombre: solicitud.nombre_equipo_full || datos.nombre_equipo_full || datos.equipo_nombre || 'N/A',
                    codigo_equipo: datos.codigo_equipo || 'N/A',
                    fecha_suceso: datos.fecha_suceso || datos.fecha_extravio || 'N/A',
                    prioridad: prioridad,
                    area_destino: areaActual,
                    nombre_tipo: solicitud.nombre_tipo,
                    FECHA_SOLICITUD: new Date().toLocaleString('es-CL', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', ' a las'),
                    OBSERVACION: finalObs,
                    observaciones: finalObs,
                    etiqueta_observacion: nombreTipoUpper.includes('BAJA') ? 'Observaciones Técnicas' : (nombreTipoUpper.includes('REPORTE') ? 'Descripción detallada del Problema' : (datos.motivo ? 'Motivo de la Solicitud' : 'Observaciones'))
                });

                // Mark as notified in DB (Resilience)
                await pool.request()
                    .input('id', sql.Numeric(10, 0), idSolicitud)
                    .query('UPDATE mae_solicitud SET notificado_uns = 1 WHERE id_solicitud = @id');
                
            } catch (e) {
                logger.error('Error triggering UNS for new request:', e);
            }

            return solicitud;
        } catch (error) {
            if (transaction._acquiredConnection) await transaction.rollback();
            logger.error('Error in UrsService.createRequest:', error);
            throw error;
        }
    }

    /**
     * Obtiene detalle de una solicitud incluyendo mensajes e historial
     */
    async getRequestById(id, reqUserId = null) {
        try {
            const pool = await getConnection();
            
            const requestQueryResult = await pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .query(`
                    SELECT s.*, t.nombre as nombre_tipo, t.area_destino as area_tipo, 
                           t.formulario_config as config_formulario, t.workflow_config,
                           COALESCE(m.nombre_muestreador, u.nombre_usuario, u.usuario, 'Desconocido') as nombre_solicitante, 
                           s.fecha_creacion as fecha_solicitud
                    FROM mae_solicitud s
                    JOIN mae_solicitud_tipo t ON s.id_tipo = t.id_tipo
                    LEFT JOIN mae_muestreador m ON s.id_solicitante = m.id_muestreador
                    LEFT JOIN mae_usuario u ON s.id_solicitante = u.id_usuario
                    WHERE s.id_solicitud = @id
                `);

            if (requestQueryResult.recordset.length === 0) return null;

            const solicitud = requestQueryResult.recordset[0];
            solicitud.datos_json = JSON.parse(solicitud.datos_json || '{}');
            solicitud.workflow_config = JSON.parse(solicitud.workflow_config || 'null');

            // Extraer origen_solicitud del JSON si no viene de la DB (Mobile Indicator Fix)
            if (!solicitud.origen_solicitud && solicitud.datos_json?.origen_solicitud) {
                solicitud.origen_solicitud = solicitud.datos_json.origen_solicitud;
            }

            // Cargar Comentarios/Conversación (Phase 13: Include Role/Area)
            const comentarios = await pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .query(`
                    SELECT c.id_comentario, c.mensaje, 
                           CONVERT(VARCHAR(33), c.fecha, 126) + 'Z' as fecha, 
                           c.es_privado, c.id_usuario, c.es_sistema,
                           u.usuario as nombre_usuario,
                           STRING_AGG(r.nombre_rol, ', ') as nombre_rol
                    FROM mae_solicitud_comentario c
                    JOIN mae_usuario u ON c.id_usuario = u.id_usuario
                    LEFT JOIN rel_usuario_rol ur ON u.id_usuario = ur.id_usuario
                    LEFT JOIN mae_rol r ON ur.id_rol = r.id_rol
                    WHERE c.id_solicitud = @id 
                    GROUP BY c.id_comentario, c.mensaje, c.fecha, c.es_privado, c.id_usuario, u.usuario, c.es_sistema
                    ORDER BY c.fecha ASC
                `);
            solicitud.conversacion = comentarios.recordset;

            // Determinar permisos dinámicos (Universal Permissions Phase 22)
            if (reqUserId) {
                const permsQuery = await pool.request()
                    .input('idTipo', sql.Numeric(10, 0), solicitud.id_tipo)
                    .input('idSol', sql.Numeric(10, 0), id)
                    .input('userId', sql.Numeric(10, 0), reqUserId)
                    .query(`
                        SELECT tipo_acceso FROM rel_solicitud_tipo_permiso p
                        LEFT JOIN rel_usuario_rol ur ON (p.id_rol = ur.id_rol AND ur.id_usuario = @userId)
                        WHERE p.id_tipo = @idTipo 
                        AND (p.id_usuario = @userId OR ur.id_rol IS NOT NULL)
                        
                        UNION
                        
                        -- Permiso explícito 'GESTION' si la solicitud está derivada actualmente al usuario o su rol
                        SELECT 'GESTION' as tipo_acceso
                        FROM mae_solicitud_derivacion d
                        LEFT JOIN rel_usuario_rol ur_d ON (d.id_rol_destino = ur_d.id_rol AND ur_d.id_usuario = @userId)
                        WHERE d.id_solicitud = @idSol
                        AND (d.usuario_destino = @userId OR ur_d.id_rol IS NOT NULL)
                        AND d.fecha = (SELECT MAX(fecha) FROM mae_solicitud_derivacion WHERE id_solicitud = @idSol)
                    `);
                
                const userAccessTypes = permsQuery.recordset.map(r => r.tipo_acceso);
                solicitud.can_manage = userAccessTypes.includes('GESTION');
                solicitud.can_view = userAccessTypes.includes('VISTA') || solicitud.can_manage;
                solicitud.can_derive = userAccessTypes.includes('DERIVACION') || solicitud.can_manage;
                
                // Compatibility fallback
                solicitud.can_resolve = solicitud.can_manage;
            }

            // Cargar Historial de Derivaciones
            const derivaciones = await pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .query(`
                    SELECT d.id_derivacion, d.id_solicitud, d.area_origen, d.area_destino, d.motivo, 
                           CONVERT(VARCHAR(33), d.fecha, 126) + 'Z' as fecha,
                           uor.usuario as usuario_origen, udt.usuario as usuario_destino,
                           rdt.nombre_rol as rol_destino
                    FROM mae_solicitud_derivacion d
                    LEFT JOIN mae_usuario uor ON d.usuario_origen = uor.id_usuario
                    LEFT JOIN mae_usuario udt ON d.usuario_destino = udt.id_usuario
                    LEFT JOIN mae_rol rdt ON d.id_rol_destino = rdt.id_rol
                    WHERE d.id_solicitud = @id 
                    ORDER BY d.fecha ASC
                `);
            solicitud.historial_derivaciones = derivaciones.recordset;

            // Cargar Archivos Adjuntos (Phase 13/33: Improved Chat grouping)
            const adjuntosRes = await pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .query(`
                    SELECT id_adjunto, id_solicitud, id_comentario, nombre_archivo, ruta_archivo, tipo_archivo,
                           CONVERT(VARCHAR(33), fecha, 126) + 'Z' as fecha
                    FROM mae_solicitud_adjunto 
                    WHERE id_solicitud = @id 
                    ORDER BY fecha ASC
                `);
            const todosLosAdjuntos = adjuntosRes.recordset;

            // Separar adjuntos globales de los de comentarios
            solicitud.archivos_adjuntos = todosLosAdjuntos.filter(a => !a.id_comentario);
            
            // Asignar adjuntos a cada comentario de la conversación
            solicitud.conversacion = solicitud.conversacion.map(msg => ({
                ...msg,
                adjuntos: todosLosAdjuntos.filter(a => Number(a.id_comentario) === Number(msg.id_comentario))
            }));

            return solicitud;
        } catch (error) {
            logger.error('Error in UrsService.getRequestById:', error);
            throw error;
        }
    }

    async getRequests(filtros = {}, userId = null, isAdmin = false) {
        try {
            const pool = await getConnection();
            const request = pool.request();
            request.input('isAdmin', sql.Bit, isAdmin ? 1 : 0);
 
            let query = `
                SELECT DISTINCT s.*, t.nombre as nombre_tipo, u.usuario as nombre_solicitante, 
                       CONVERT(VARCHAR(33), s.fecha_creacion, 126) + 'Z' as fecha_solicitud, 
                       t.area_destino, t.modulo_destino,
                       (SELECT COUNT(*) FROM mae_notificacion n 
                        WHERE n.id_referencia = s.id_solicitud 
                        AND n.id_usuario = @requesterId 
                        AND n.leido = 0) as unread_count
                FROM mae_solicitud s
                JOIN mae_solicitud_tipo t ON s.id_tipo = t.id_tipo
                LEFT JOIN mae_usuario u ON s.id_solicitante = u.id_usuario
                LEFT JOIN mae_muestreador m ON s.id_solicitante = m.id_muestreador
            `;
 
            if (userId) {
                query += `
                    LEFT JOIN rel_solicitud_tipo_permiso p ON s.id_tipo = p.id_tipo AND p.tipo_acceso IN ('GESTION', 'VISTA')
                    LEFT JOIN rel_usuario_rol ur ON (p.id_rol = ur.id_rol AND ur.id_usuario = @requesterId)
                    WHERE (
                        -- Admin bypass
                        @isAdmin = 1
                        -- OR User created it
                        OR s.id_solicitante = @requesterId
                        -- OR User has 'GESTION' or 'VISTA' permission (explicitly or via role)
                        OR p.id_usuario = @requesterId
                        OR ur.id_rol IS NOT NULL
                        -- OR It was derived to me (and it's the current derivation)
                        OR EXISTS (
                            SELECT 1 FROM mae_solicitud_derivacion d
                            LEFT JOIN rel_usuario_rol ur_d ON (d.id_rol_destino = ur_d.id_rol AND ur_d.id_usuario = @requesterId)
                            WHERE d.id_solicitud = s.id_solicitud
                            AND (d.usuario_destino = @requesterId OR ur_d.id_rol IS NOT NULL)
                            AND d.fecha = (SELECT MAX(fecha) FROM mae_solicitud_derivacion WHERE id_solicitud = s.id_solicitud)
                        )
                    )
                `;
                request.input('requesterId', sql.Numeric(10, 0), userId);
            } else {
                query += ' WHERE 1=1 ';
            }

            if (filtros.estado) {
                query += ' AND s.estado = @estado';
                request.input('estado', sql.VarChar(50), filtros.estado);
            }

            if (filtros.area_actual) {
                query += ' AND s.area_actual = @areaActual';
                request.input('areaActual', sql.VarChar(50), filtros.area_actual);
            }

            if (filtros.id_solicitante) {
                query += ' AND s.id_solicitante = @idSolicitanteFilter';
                request.input('idSolicitanteFilter', sql.Numeric(10, 0), filtros.id_solicitante);
            }

            query += ' ORDER BY s.fecha_creacion DESC';
            
            const result = await request.query(query);
            return result.recordset.map(s => {
                let parsedDatos = {};
                try {
                    parsedDatos = JSON.parse(s.datos_json || '{}');
                } catch(e) {}
                
                return {
                    ...s,
                    nombre_solicitante: s.nombre_solicitante,
                    datos_json: parsedDatos,
                    origen_solicitud: s.origen_solicitud || parsedDatos.origen_solicitud
                };
            });
        } catch (error) {
            logger.error('Error in UrsService.getRequests:', error);
            throw error;
        }
    }

    /**
     * Actualiza el estado de una solicitud
     */
    async updateStatus(id, nuevoEstado, idUsuario, observaciones = '') {
        try {
            const pool = await getConnection();
            
            const result = await pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .input('estadoName', sql.VarChar(50), nuevoEstado)
                .query(`
                    UPDATE mae_solicitud 
                    SET estado = @estadoName,
                        fecha_actualizacion = GETUTCDATE()
                    OUTPUT INSERTED.*
                    WHERE id_solicitud = @id
                `);

            const solicitud = result.recordset[0];

            // 3. Registrar cambio en el hilo de la conversación con flag de sistema
            await this.addComment(id, idUsuario, `Cambio de estado a ${nuevoEstado}${observaciones ? ': ' + observaciones : ''}`, true, [], null, true);

            // Trigger UNS (Phase 22: Enhanced Multi-channel)
            import('./uns.service.js').then(async uns => {
                const reqData = await pool.request()
                    .input('id', sql.Numeric(10, 0), id)
                    .input('idUsr', sql.Numeric(10, 0), idUsuario)
                    .query(`
                        SELECT s.*, t.nombre as nombre_tipo, 
                               COALESCE(u_sol.usuario, m_sol.nombre_muestreador, 'Desconocido') as nombre_solicitante, 
                               u_act.usuario as nombre_autor
                        FROM mae_solicitud s
                        JOIN mae_solicitud_tipo t ON s.id_tipo = t.id_tipo
                        LEFT JOIN mae_usuario u_sol ON u_sol.id_usuario = s.id_solicitante
                        LEFT JOIN mae_muestreador m_sol ON m_sol.id_muestreador = s.id_solicitante
                        JOIN mae_usuario u_act ON u_act.id_usuario = @idUsr
                        WHERE s.id_solicitud = @id
                    `);
                
                if (reqData.recordset.length > 0) {
                    const fullSol = reqData.recordset[0];
                    // Fix 5a: Parse datos_json if it's a string to avoid char-by-char rendering in emails
                    let parsedDatosJson = {};
                    try {
                        parsedDatosJson = typeof fullSol.datos_json === 'string' ? JSON.parse(fullSol.datos_json) : (fullSol.datos_json || {});
                    } catch (e) { parsedDatosJson = {}; }
                    
                    uns.default.trigger('SOLICITUD_ESTADO_CAMBIO', {
                        ...fullSol,
                        datos_json: parsedDatosJson,
                        id_solicitud: id,
                        id_usuario_accion: idUsuario,
                        id_usuario_propietario: fullSol.id_solicitante,
                        usuario_accion: fullSol.nombre_autor,
                        solicitante: fullSol.nombre_solicitante,
                        nombre_tipo: fullSol.nombre_tipo,
                        estado: nuevoEstado,
                        observaciones,
                        accion: nuevoEstado === 'ACEPTADA' ? 'APROBACION' : (nuevoEstado === 'RECHAZADA' ? 'RECHAZO' : (nuevoEstado === 'REALIZADA' ? 'REALIZACION' : (nuevoEstado === 'EN_REVISION' ? 'REVISION' : 'ACTUALIZACION')))
                    });
                }
            });

            // --- Automated Execution Context (Phase 41) ---
            if (nuevoEstado === 'REALIZADA') {
                try {
                    const reqData = await pool.request()
                        .input('id', sql.Numeric(10, 0), id)
                        .query(`
                            SELECT s.*, t.nombre as nombre_tipo 
                            FROM mae_solicitud s
                            JOIN mae_solicitud_tipo t ON s.id_tipo = t.id_tipo
                            WHERE s.id_solicitud = @id
                        `);
                    
                    if (reqData.recordset.length > 0) {
                        const fullSol = reqData.recordset[0];
                        const type = fullSol.nombre_tipo;
                        const currentSolDatos = JSON.parse(fullSol.datos_json || '{}');

                        if (type === 'Deshabilitar muestreador' || type === 'DESHABILITAR_MUESTREADOR') {
                            const idMuestreador = currentSolDatos.muestreador_origen_id || currentSolDatos.id_muestreador;
                            if (idMuestreador) {
                                // 1. Disable Sampler
                                const { adminService } = await import('./admin.service.js');
                                await adminService.disableMuestreador(idMuestreador);
                                logger.info(`URS EXECUTION: Sampler ${idMuestreador} disabled.`);

                                // 2. Reassign Equipment using shared service
                                const { equipoService } = await import('./equipo.service.js');
                                await equipoService.executeEquipmentReassignment(idMuestreador, {
                                    tipoTraspaso: currentSolDatos.tipo_traspaso,
                                    baseDestino: currentSolDatos.base_destino,
                                    idDestino: currentSolDatos.muestreador_destino_id,
                                    reasignacionManual: currentSolDatos.reasignacion_manual
                                }, id);
                            }
                        }
                    }
                } catch (execErr) {
                    logger.error(`Error executing automation for URS solicitud ${id}:`, execErr);
                }
            }

            return solicitud;
        } catch (error) {
            logger.error('Error in UrsService.updateStatus:', error);
            throw error;
        }
    }

    /**
     * Agrega un comentario al hilo
     */
    async addComment(idSolicitud, idUsuario, mensaje, esPrivado = false, files = [], transaction = null, esSistema = false) {
        try {
            const pool = await getConnection();
            const request = transaction ? new sql.Request(transaction) : pool.request();
            
            const result = await request
                .input('idSol', sql.Numeric(10, 0), idSolicitud)
                .input('idUsr', sql.Numeric(10, 0), idUsuario)
                .input('msg', sql.NVarChar(sql.MAX), mensaje)
                .input('privado', sql.Bit, esPrivado)
                .input('sistema', sql.Bit, esSistema)
                .query(`
                    INSERT INTO mae_solicitud_comentario (id_solicitud, id_usuario, mensaje, es_privado, fecha, es_sistema)
                    OUTPUT INSERTED.id_comentario, INSERTED.id_solicitud, INSERTED.id_usuario, INSERTED.mensaje, INSERTED.es_privado, INSERTED.es_sistema,
                           CONVERT(VARCHAR(33), INSERTED.fecha, 126) + 'Z' as fecha
                    VALUES (@idSol, @idUsr, @msg, @privado, GETUTCDATE(), @sistema)
                `);
            const comentario = result.recordset[0];

            // Process Attachments if any (Phase 27)
            if (files && files.length > 0) {
                await this.processAttachments(idSolicitud, comentario.id_comentario, files);
            }

            // Trigger UNS — Fix 4: Only for real user comments, NOT system-generated ones
            if (!esSistema) {
                import('./uns.service.js').then(async uns => {
                        const reqData = await pool.request()
                            .input('id', sql.Numeric(10, 0), idSolicitud)
                            .input('idUsr', sql.Numeric(10, 0), idUsuario)
                            .query(`
                                SELECT s.id_tipo, s.id_solicitante, t.nombre as nombre_tipo, u.usuario as nombre_autor
                                FROM mae_solicitud s
                                JOIN mae_solicitud_tipo t ON s.id_tipo = t.id_tipo
                                JOIN mae_usuario u ON u.id_usuario = @idUsr
                                WHERE s.id_solicitud = @id
                            `);
                    
                    if (reqData.recordset.length > 0) {
                        const req = reqData.recordset[0];
                        uns.default.trigger('SOLICITUD_COMENTARIO_NUEVO', {
                            id_solicitud: idSolicitud,
                            id_tipo: req.id_tipo,
                            id_solicitante: req.id_solicitante,
                            id_usuario: idUsuario,
                            id_usuario_accion: idUsuario,
                            id_usuario_propietario: req.id_solicitante,
                            usuario_accion: req.nombre_autor,
                            nombre_tipo: req.nombre_tipo,
                            mensaje,
                            es_privado: esPrivado
                        });
                    }
                });
            }

            return comentario;
        } catch (error) {
            logger.error('Error in UrsService.addComment:', error);
            throw error;
        }
    }

    /**
     * Deriva una solicitud a otra área, rol o usuario
     */
    async derive(idSolicitud, idUsuarioOrigen, areaDestino, idUsuarioDestino = null, motivo = '', idRolDestino = null) {
        try {
            const pool = await getConnection();
            
            // Obtener area origen actual
            const currentRes = await pool.request()
                .input('id', sql.Numeric(10, 0), idSolicitud)
                .query('SELECT area_actual FROM mae_solicitud WHERE id_solicitud = @id');
            
            const areaOrigen = currentRes.recordset[0]?.area_actual || 'S/A';

            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                // 1. Registrar Derivación
                await new sql.Request(transaction)
                    .input('idSol', sql.Numeric(10, 0), idSolicitud)
                    .input('usrOr', sql.Numeric(10, 0), idUsuarioOrigen)
                    .input('areaOr', sql.VarChar(50), areaOrigen)
                    .input('usrDs', sql.Numeric(10, 0), idUsuarioDestino)
                    .input('rolDs', sql.Numeric(10, 0), idRolDestino)
                    .input('areaDs', sql.VarChar(50), areaDestino)
                    .input('motivo', sql.NVarChar(sql.MAX), motivo)
                    .query(`
                        INSERT INTO mae_solicitud_derivacion (id_solicitud, usuario_origen, area_origen, usuario_destino, id_rol_destino, area_destino, motivo, fecha)
                        VALUES (@idSol, @usrOr, @areaOr, @usrDs, @rolDs, @areaDs, @motivo, GETUTCDATE())
                    `);

                // 2. Actualizar solicitud
                const updateRes = await new sql.Request(transaction)
                    .input('id', sql.Numeric(10, 0), idSolicitud)
                    .input('area', sql.VarChar(50), areaDestino)
                    .query(`
                        UPDATE mae_solicitud 
                        SET area_actual = @area, fecha_actualizacion = GETUTCDATE()
                        OUTPUT INSERTED.*
                        WHERE id_solicitud = @id
                    `);

                await transaction.commit();
                
                const solicitudActualizada = updateRes.recordset[0];

                // Trigger UNS Alert
                import('./uns.service.js').then(async uns => {
                    const reqData = await pool.request()
                        .input('id', sql.Numeric(10, 0), idSolicitud)
                        .input('idUsrAct', sql.Numeric(10, 0), idUsuarioOrigen)
                        .input('idUsrDst', sql.Numeric(10, 0), idUsuarioDestino)
                        .query(`
                            SELECT s.*, t.nombre as nombre_tipo, u_sol.usuario as nombre_solicitante, 
                                   u_act.usuario as nombre_autor, u_dst.usuario as nombre_destino
                            FROM mae_solicitud s
                            JOIN mae_solicitud_tipo t ON s.id_tipo = t.id_tipo
                            JOIN mae_usuario u_sol ON u_sol.id_usuario = s.id_solicitante
                            JOIN mae_usuario u_act ON u_act.id_usuario = @idUsrAct
                            LEFT JOIN mae_usuario u_dst ON u_dst.id_usuario = @idUsrDst
                            WHERE s.id_solicitud = @id
                        `);

                    if (reqData.recordset.length > 0) {
                        const fullSol = reqData.recordset[0];
                        uns.default.trigger('SOLICITUD_DERIVACION', {
                            ...fullSol,
                            id_solicitud: idSolicitud,
                            id_tipo: fullSol.id_tipo,
                            id_solicitante: fullSol.id_solicitante,
                            id_usuario_accion: idUsuarioOrigen,
                            id_usuario_propietario: fullSol.id_solicitante,
                            solicitante: fullSol.nombre_solicitante,
                            usuario_accion: fullSol.nombre_autor,
                            nombre_tipo: fullSol.nombre_tipo,
                            nombre_destino: fullSol.nombre_destino,
                            area_origen: areaOrigen,
                            area_destino: areaDestino,
                            usuario_origen_id: idUsuarioOrigen,
                            usuario_destino_id: idUsuarioDestino,
                            id_rol_destino: idRolDestino,
                            motivo
                        });
                    }
                });
                
                return solicitudActualizada;
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } catch (error) {
            logger.error('Error in UrsService.derive:', error);
            throw error;
        }
    }

    /**
     * Procesa y guarda archivos adjuntos
     */
    async processAttachments(idSolicitud, idComentario, files, transaction = null) {
        try {
            const pool = await getConnection();
            const baseDir = process.env.UPLOAD_PATH || path.resolve('uploads');
            const uploadDir = path.join(baseDir, 'solicitudes');
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            for (const file of files) {
                // Generar nombre único para evitar colisiones
                const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
                const filePath = path.join(uploadDir, fileName);
                const relativePath = `uploads/solicitudes/${fileName}`;

                // Guardar archivo físico
                fs.writeFileSync(filePath, file.buffer);

                // Registrar en DB - Using transaction if provided
                const request = transaction ? new sql.Request(transaction) : pool.request();
                
                await request
                    .input('idSol', sql.Numeric(10, 0), idSolicitud)
                    .input('idCom', sql.Numeric(10, 0), idComentario || null)
                    .input('name', sql.NVarChar(255), file.originalname)
                    .input('path', sql.NVarChar(500), relativePath)
                    .input('type', sql.NVarChar(100), file.mimetype || 'application/octet-stream')
                    .query(`
                        INSERT INTO mae_solicitud_adjunto (id_solicitud, id_comentario, nombre_archivo, ruta_archivo, tipo_archivo, fecha)
                        VALUES (@idSol, @idCom, @name, @path, @type, GETUTCDATE())
                    `);
            }
        } catch (error) {
            logger.error('Error in processAttachments:', error);
            throw error;
        }
    }
    async getAttachmentById(id) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .query(`SELECT TOP 1 * FROM mae_solicitud_adjunto WHERE id_adjunto = @id`);
            return result.recordset[0];
        } catch (error) {
            logger.error('Error in getAttachmentById:', error);
            throw error;
        }
    }
}

export default new UrsService();
