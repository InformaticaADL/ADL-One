import { equipoService } from '../services/equipo.service.js';
import { getConnection } from '../config/database.js';
import sql from 'mssql';
import unsService from '../services/uns.service.js';
import { runAnalysis as runKpiAnalyst } from '../services/kpi-analyst.service.js';
import kpiAnalystConfig from '../config/kpi-analyst.config.js';
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
                // If the app sends 13 (General), we check relacion_tipo OR presence of IDs to specialize it
                if (currentIdTipo === 13) {
                    const relTipo = (datosJSONObj.relacion_tipo || '').toUpperCase();
                    const hasEq = !!(datosJSONObj.id_equipo || datosJSONObj.idEquipo || datosJSONObj.equipo);
                    const hasFi = !!(datosJSONObj.id_ficha || datosJSONObj.num_ficha || datosJSONObj.id_muestreo);

                    let newId = 13;
                    if (relTipo === 'EQUIPO' || (relTipo === '' && hasEq)) {
                        newId = 14;
                    } else if (relTipo === 'SERVICIO' || relTipo === 'FICHA' || (relTipo === '' && hasFi)) {
                        newId = 15;
                    }

                    if (newId && newId !== 13) {
                        currentIdTipo = newId;
                        logger.info(`[Vigilante] Remapeando solicitud #${req.id_solicitud} de tipo 13 a ${currentIdTipo} (Rel: ${relTipo || 'DETECCIÓN POR ID'})`);
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
                    // --- ROBUST RESOLUTION LAYER (Vigilante Edition) ---
                    
                    // 1. Resolve Technician Identity (Fix for ID 466/229 + Generic Sistema)
                    let nombreTecnico = req.solicitante;
                    const isGenericRequester = Number(req.id_solicitante) === 466 || Number(req.id_solicitante) === 229 || req.solicitante === 'Sistema';
                    
                    if (isGenericRequester) {
                        const samplerId = datosJSONObj.id_muestreador || datosJSONObj.muestreador_id || datosJSONObj.idMuestreador || datosJSONObj.id_tecnico || datosJSONObj.idTecnico;
                        if (samplerId) {
                            try {
                                const samplerRes = await pool.request()
                                    .input('sid', sql.Int, Number(samplerId))
                                    .query("SELECT nombre_muestreador FROM mae_muestreador WHERE id_muestreador = @sid");
                                if (samplerRes.recordset.length > 0) {
                                    nombreTecnico = samplerRes.recordset[0].nombre_muestreador;
                                    logger.info(`[Vigilante] Resolved technician name for ID ${samplerId}: ${nombreTecnico}`);
                                }
                            } catch (idErr) { logger.error('[Vigilante] Error resolving technician:', idErr); }
                        }
                        
                        if (nombreTecnico === 'Sistema' || !nombreTecnico) {
                            nombreTecnico = 'Técnico en Terreno (App)';
                        }
                    }

                    let displayReferencia = 'en terreno';

                    // 2. Resolve Equipment (Always force [CODE] format from DB)
                    // Types: 10 (Problema), 11 (Perdido), 13 (Consulta Otro), 14 (Consulta Equipo), 16 (Other hardware)
                    if ([10, 11, 13, 14, 16].includes(currentIdTipo)) {
                        const eqId = datosJSONObj.id_equipo || datosJSONObj.equipo_id || datosJSONObj.idEquipo || datosJSONObj.equipo;
                        if (eqId) {
                            try {
                                const eqRes = await pool.request()
                                    .input('eqId', sql.Int, Number(eqId))
                                    .query("SELECT LTRIM(RTRIM(nombre)) + ' [' + LTRIM(RTRIM(codigo)) + ']' as full_name FROM mae_equipo WHERE id_equipo = @eqId");
                                if (eqRes.recordset.length > 0) {
                                    const eqData = eqRes.recordset[0];
                                    datosJSONObj.nombre_equipo_full = eqData.full_name;
                                    displayReferencia = eqData.full_name;
                                    logger.info(`[Vigilante] Equipment full_name resolved: ${eqData.full_name}`);
                                }
                            } catch (eqErr) { logger.error(`[Vigilante] Error resolving equipment:`, eqErr); }
                        } else {
                            displayReferencia = datosJSONObj.nombre_equipo_full || datosJSONObj.nombre_equipo || 'equipo';
                        }
                    }

                    // 3. Resolve Ficha/Servicio
                    else if ([12, 15].includes(currentIdTipo)) {
                        const correlativo = datosJSONObj.correlativo || datosJSONObj.caso_adlab || datosJSONObj.numero_ficha || datosJSONObj.id_muestreo || '';
                        if (correlativo) {
                            displayReferencia = correlativo;
                        } else {
                            displayReferencia = datosJSONObj.nombre_ficha_full || 'servicio';
                        }
                    }

                    // 4. Standardize Dates (DD-MM-YYYY)
                    const rawDate = datosJSONObj.fecha_extravio || datosJSONObj.fecha_suceso || '';
                    let fechaSuceso = rawDate;
                    if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}(\D.*)?$/.test(rawDate)) {
                        const parts = rawDate.split(/\D/);
                        if (parts.length >= 3 && parts[0].length === 4) {
                            fechaSuceso = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        }
                    }

                    // Update DB with resolved data
                    await pool.request()
                        .input('id', sql.Numeric(10, 0), req.id_solicitud)
                        .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datosJSONObj))
                        .query('UPDATE mae_solicitud SET datos_json = @datos WHERE id_solicitud = @id');

                    // Prepare Date/Time for corporate template (V4)
                    const reqDate = req.fecha_creacion ? new Date(req.fecha_creacion) : new Date();
                    const fechaStr = reqDate.toLocaleDateString('es-CL');
                    const horaStr = reqDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: true });

                    // Trigger UNS Trigger Logic (V4: Synchronized placeholders)
                    await unsService.trigger(eventCode, {
                        ...datosJSONObj,
                        datos_json: datosJSONObj, 
                        id_solicitud: req.id_solicitud,
                        id_tipo: currentIdTipo,
                        nombre_tipo: req.nombre_tipo, 
                        TIPO_SOLICITUD: req.nombre_tipo,
                        CORRELATIVO: datosJSONObj.correlativo || datosJSONObj.num_ficha || datosJSONObj.id_muestreo || String(req.id_solicitud),
                        SOLICITANTE: nombreTecnico,
                        USUARIO: nombreTecnico,
                        solicitante: nombreTecnico,
                        nombre_autor: nombreTecnico,
                        usuario_accion: nombreTecnico,
                        FECHA: fechaStr,
                        HORA: horaStr,
                        FECHA_SOLICITUD: `${fechaStr} ${horaStr}`,
                        equipo_nombre: displayReferencia,
                        nombre_equipo_full: displayReferencia,
                        equipo: displayReferencia,
                        ficha_nombre: displayReferencia,
                        fecha_suceso: fechaSuceso,
                        fecha_extravio: fechaSuceso,
                        motivo: req.observaciones || datosJSONObj.motivo || 'N/A',
                        observaciones: req.observaciones,
                        id_usuario_accion: req.id_solicitante,
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

    // --- 3. KPI Analyst Dashboard Automation ---
    const runKpiAgent = async (mode = 'interval') => {
        try {
            await runKpiAnalyst({ mode });
        } catch (error) {
            logger.error(`[KPI Analyst] Error during ${mode} execution:`, error);
        }
    };

    // --- Startup Execution ---
    setTimeout(() => {
        runDailyCheck();
        pollNewRequests();
    }, 10000);

    setTimeout(() => {
        runKpiAgent('startup');
    }, kpiAnalystConfig.orchestration.startupDelayMs);

    // --- Active Loops ---
    // Every 24 hours
    setInterval(runDailyCheck, 24 * 60 * 60 * 1000);

    // Every 20 seconds (Vigilante poll)
    setInterval(pollNewRequests, 20 * 1000);

    // KPI analyst interval execution
    setInterval(() => {
        runKpiAgent('interval');
    }, kpiAnalystConfig.orchestration.refreshIntervalMs);

    logger.info('Scheduler initialized: Daily check, URS Watcher and KPI Analyst active.');
};
