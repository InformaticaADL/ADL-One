import { equipoService } from '../services/equipo.service.js';
import { getConnection } from '../config/database.js';
import sql from 'mssql';
import unsService from '../services/uns.service.js';
import logger from './logger.js';

export const initScheduler = () => {
    logger.info('Initializing Scheduler (ADL ONE V3.0)...');

    // --- 1. Daily Equipment Expiration Check ---
    const runDailyCheck = async () => {
        logger.info('Running Daily Expiration Check...');
        try {
            const result = await equipoService.inactivateExpiredEquipos();
            if (result.processed > 0) {
                logger.info(`Daily Check Complete: Inactivated ${result.processed} equipment(s).`);
            } else {
                logger.info('Daily Check Complete: No expired equipment found.');
            }
        } catch (error) {
            logger.error('Error verifying expired equipment:', error);
        }
    };

    // --- 2. URS Notification Watcher (Vigilante) ---
    // Polls database for new requests that hasn't been notified yet (Mobile Resilience)
    const pollNewRequests = async () => {
        try {
            const pool = await getConnection();
            
            // Find requests with notification flag = 0
            const pending = await pool.request()
                .query(`
                    SELECT TOP 10 s.*, t.nombre as nombre_tipo, u.nombre_usuario as solicitante
                    FROM mae_solicitud s
                    JOIN mae_solicitud_tipo t ON s.id_tipo = t.id_tipo
                    LEFT JOIN mae_usuario u ON s.id_solicitante = u.id_usuario
                    WHERE (s.notificado_uns = 0 OR s.notificado_uns IS NULL)
                    ORDER BY s.fecha_creacion ASC
                `);

            for (const req of pending.recordset) {
                let currentIdTipo = req.id_tipo;
                let datosJSONObj = {};
                try {
                    datosJSONObj = typeof req.datos_json === 'string' ? JSON.parse(req.datos_json) : (req.datos_json || {});
                } catch(e) {}

                // Mobile Sub-type Remapping (Architecture 3.1)
                // If the app sends 13 (General), we check relacion_tipo to specialize it
                if (currentIdTipo === 13 && datosJSONObj.relacion_tipo) {
                    const mapping = { 'EQUIPO': 14, 'SERVICIO': 15, 'OTRO': 13 };
                    const newId = mapping[datosJSONObj.relacion_tipo.toUpperCase()];
                    if (newId && newId !== 13) {
                        currentIdTipo = newId;
                        logger.info(`[Vigilante] Remapeando solicitud #${req.id_solicitud} de tipo 13 a ${currentIdTipo} (${datosJSONObj.relacion_tipo})`);
                        // Persist the specialized type back to DB
                        await pool.request()
                            .input('id', sql.Numeric(10, 0), req.id_solicitud)
                            .input('newId', sql.Int, currentIdTipo)
                            .query('UPDATE mae_solicitud SET id_tipo = @newId WHERE id_solicitud = @id');
                    }
                }

                const eventMap = {
                    10: 'AVISO_PROBLEMA_NUEVO',
                    11: 'AVISO_PERDIDO_NUEVO',
                    12: 'AVISO_CANCELACION_NUEVA',
                    13: 'AVISO_CONSULTA_NUEVA',
                    14: 'AVISO_CONSULTA_EQUIPO_NUEVA',
                    15: 'AVISO_CONSULTA_FICHA_NUEVA'
                };
                const eventCode = eventMap[currentIdTipo] || `AVISO_CONSULTA_NUEVA`;
                
                logger.info(`[Vigilante] Procesando notificación para solicitud #${req.id_solicitud} (Tipo Final: ${currentIdTipo})`);

                try {
                    const nombreTecnico = (datosJSONObj && datosJSONObj.nombre_tecnico) ? datosJSONObj.nombre_tecnico : req.solicitante;
                    let displayReferencia = 'en terreno';

                    // 1. Resolve Equipment (Types 10, 11, 14)
                    if ([10, 11, 14].includes(currentIdTipo)) {
                        let equipoNombre = datosJSONObj.nombre_equipo_full || datosJSONObj.nombre_equipo || datosJSONObj.equipo_nombre || '';
                        const eqId = datosJSONObj.id_equipo || datosJSONObj.equipo_id || datosJSONObj.idEquipo;
                        if (eqId && !equipoNombre) {
                            try {
                                const eqRes = await pool.request()
                                    .input('eqId', sql.Int, Number(eqId))
                                    .query("SELECT LTRIM(RTRIM(nombre)) + ' [' + LTRIM(RTRIM(codigo)) + ']' as full_name FROM mae_equipo WHERE id_equipo = @eqId");
                                if (eqRes.recordset.length > 0) {
                                    equipoNombre = eqRes.recordset[0].full_name;
                                    datosJSONObj.nombre_equipo_full = equipoNombre;
                                    logger.info(`[Vigilante] Equipo resuelto para #${req.id_solicitud}: ${equipoNombre}`);
                                }
                            } catch (eqErr) { logger.error(`[Vigilante] Error resolviendo equipo:`, eqErr); }
                        }
                        displayReferencia = equipoNombre || 'equipo';
                    }

                    // 2. Resolve Ficha/Servicio (Type 12 and 15)
                    else if ([12, 15].includes(currentIdTipo)) {
                        const correlativo = datosJSONObj.correlativo || datosJSONObj.caso_adlab || datosJSONObj.numero_ficha || datosJSONObj.id_muestreo || '';
                        
                        // Favor correlativo for display as requested by user
                        if (correlativo) {
                            displayReferencia = correlativo;
                            logger.info(`[Vigilante] Usando correlativo ${correlativo} para solicitud #${req.id_solicitud} (Tipo ${currentIdTipo})`);
                        } else {
                            // Fallback to name resolution if no correlativo (unlikely but safe)
                            let fichaNombre = datosJSONObj.nombre_ficha_full || '';
                            const fId = datosJSONObj.id_ficha || datosJSONObj.idFicha;
                            if (fId && !fichaNombre) {
                                try {
                                    const fRes = await pool.request()
                                        .input('fid', sql.VarChar(50), String(fId))
                                        .query(`
                                            SELECT TOP 1 nombre_tabla_largo as ref 
                                            FROM App_Ma_FichaIngresoServicio_ENC 
                                            WHERE id_fichaingresoservicio = TRY_CAST(@fid AS INT) 
                                            OR fichaingresoservicio LIKE '%' + @fid + '%'
                                        `);
                                    if (fRes.recordset.length > 0) {
                                        fichaNombre = fRes.recordset[0].ref;
                                        datosJSONObj.nombre_ficha_full = fichaNombre;
                                    }
                                } catch (fErr) { logger.error(`[Vigilante] Error resolviendo ficha:`, fErr); }
                            }
                            displayReferencia = fichaNombre || 'servicio';
                        }
                    }

                    // 3. Update DB with resolved names if changed
                    await pool.request()
                        .input('id', sql.Numeric(10, 0), req.id_solicitud)
                        .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datosJSONObj))
                        .query('UPDATE mae_solicitud SET datos_json = @datos WHERE id_solicitud = @id');

                    // Trigger UNS Trigger Logic
                    await unsService.trigger(eventCode, {
                        id_solicitud: req.id_solicitud,
                        id_tipo: currentIdTipo,
                        nombre_tipo: req.nombre_tipo, 
                        solicitante: nombreTecnico,
                        nombre_autor: nombreTecnico,
                        usuario_accion: nombreTecnico,
                        equipo_nombre: displayReferencia,
                        ficha_nombre: displayReferencia,
                        correlativo_ref: [12, 15].includes(currentIdTipo) ? displayReferencia : '',
                        fecha_suceso: datosJSONObj.fecha_extravio || datosJSONObj.fecha_suceso || '',
                        observaciones: req.observaciones,
                        id_usuario_accion: req.id_solicitante,
                        id_usuario_propietario: null
                    });

                    // Mark as notified so we don't repeat
                    await pool.request()
                        .input('id', sql.Numeric(10, 0), req.id_solicitud)
                        .query('UPDATE mae_solicitud SET notificado_uns = 1 WHERE id_solicitud = @id');
                    
                    logger.info(`[Vigilante] ✅ Notificación enviada para #${req.id_solicitud}`);
                } catch (triggerError) {
                    logger.error(`[Vigilante] ❌ Error notificando #${req.id_solicitud}:`, triggerError);
                }
            }
        } catch (pollError) {
            // Silently log or ignore if DB is down
            if (pollError.message.includes('ConnectionError') || pollError.message.includes('deadlock')) {
                 logger.debug('[Vigilante] DB unreachable or busy, skipping poll');
            } else {
                 logger.error('[Vigilante] Error during polling:', pollError);
            }
        }
    };

    // --- Startup Execution ---
    setTimeout(() => {
        runDailyCheck();
        pollNewRequests();
    }, 10000); 

    // --- Active Loops ---
    // Every 24 hours
    setInterval(runDailyCheck, 24 * 60 * 60 * 1000);

    // Every 20 seconds (Vigilante poll)
    setInterval(pollNewRequests, 20 * 1000);

    logger.info('Scheduler initialized: Daily check and URS Watcher active.');
};
