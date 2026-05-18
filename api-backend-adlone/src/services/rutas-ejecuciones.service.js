import { getConnection } from '../config/database.js';
import sql from 'mssql';
import fichaService from './ficha.service.js';
import rutasPlanificadasService from './rutas-planificadas.service.js';
import logger from '../utils/logger.js';

class RutasEjecucionesService {
    /**
     * Returns the template's fichas enriched with their correlativo options.
     * Each ficha includes:
     *   - All correlativos with status (DISPONIBLE / AGENDADO / EN_RUTA)
     *   - suggested_correlativo: first DISPONIBLE correlativo, or first overall if none available
     */
    async getFichasDisponibles(idPlantilla) {
        const plantilla = await rutasPlanificadasService.getById(idPlantilla);
        if (!plantilla) throw new Error('Plantilla de ruta no encontrada');

        const fichas = plantilla.fichas || [];
        if (fichas.length === 0) return { plantilla, fichas: [] };

        const detalles = await Promise.all(
            fichas.map(f => fichaService.getForAssignmentDetail(f.id_fichaingresoservicio, 1).catch(() => []))
        );

        const enriched = fichas.map((f, i) => {
            const rows = detalles[i] || [];

            const correlativos = rows.map(r => {
                const estadoRaw = (r.nombre_estadomuestreo || '').toUpperCase();
                let status = 'DISPONIBLE';
                const dateObj = r.fecha_muestreo ? new Date(r.fecha_muestreo) : null;
                const hasDate = dateObj && dateObj.getFullYear() > 1900;

                if (estadoRaw.includes('EJECUTADO')) {
                    status = 'EJECUTADO';
                } else if (estadoRaw.includes('CANCELADO') || estadoRaw.includes('ANULADO')) {
                    status = 'CANCELADO';
                } else if (estadoRaw.includes('EN_RUTA') || estadoRaw.includes('EN RUTA')) {
                    status = 'EN_RUTA';
                } else if (hasDate) {
                    status = 'AGENDADO';
                }

                return {
                    id_agendamam: r.id_agendamam,
                    frecuencia_correlativo: r.frecuencia_correlativo,
                    nombre_estadomuestreo: r.nombre_estadomuestreo,
                    fecha_muestreo: r.fecha_muestreo || null,
                    status
                };
            });

            const firstDisponible = correlativos.find(c => c.status === 'DISPONIBLE');
            const suggested = firstDisponible || correlativos[0] || null;

            return {
                id_fichaingresoservicio: f.id_fichaingresoservicio,
                orden: f.orden,
                centro: f.centro,
                empresa_servicio: f.empresa_servicio,
                objetivo: f.objetivo,
                ref_google: f.ref_google,
                ma_coordenadas: f.ma_coordenadas,
                latitud: f.latitud,
                longitud: f.longitud,
                correlativos,
                suggested_correlativo: suggested?.frecuencia_correlativo || null,
                suggested_id_agendamam: suggested?.id_agendamam || null,
                disponibles: correlativos.filter(c => c.status === 'DISPONIBLE').length,
                total: correlativos.length
            };
        });

        return { plantilla, fichas: enriched };
    }

    async getEjecucionesByPlantilla(idPlantilla) {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Int, idPlantilla)
            .query(`
                SELECT e.*,
                       mi.nombre_muestreador as muestreador_inst,
                       mr.nombre_muestreador as muestreador_ret,
                       u.nombre_usuario as creador,
                       (SELECT COUNT(*) FROM mae_rutas_ejecuciones_detalle WHERE id_ejecucion = e.id_ejecucion) as cantidad_fichas
                FROM mae_rutas_ejecuciones e
                LEFT JOIN mae_muestreador mi ON e.id_muestreador_inst = mi.id_muestreador
                LEFT JOIN mae_muestreador mr ON e.id_muestreador_ret  = mr.id_muestreador
                LEFT JOIN mae_usuario u ON e.id_usuario_creador = u.id_usuario
                WHERE e.id_ruta_planificada = @id
                ORDER BY e.fecha_creacion DESC
            `);
        return result.recordset;
    }

    async getEjecucionById(id) {
        const pool = await getConnection();

        const headerResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT e.*,
                       mi.nombre_muestreador as muestreador_inst,
                       mr.nombre_muestreador as muestreador_ret,
                       u.nombre_usuario as creador,
                       r.nombre_ruta
                FROM mae_rutas_ejecuciones e
                LEFT JOIN mae_muestreador mi ON e.id_muestreador_inst = mi.id_muestreador
                LEFT JOIN mae_muestreador mr ON e.id_muestreador_ret  = mr.id_muestreador
                LEFT JOIN mae_usuario u ON e.id_usuario_creador = u.id_usuario
                LEFT JOIN mae_rutas_planificadas r ON e.id_ruta_planificada = r.id_ruta_planificada
                WHERE e.id_ejecucion = @id
            `);

        if (headerResult.recordset.length === 0) return null;
        const ejec = headerResult.recordset[0];

        const detalleResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT d.*,
                       cen.nombre_centro as centro,
                       emp.nombre_empresa as empresa_servicio
                FROM mae_rutas_ejecuciones_detalle d
                LEFT JOIN App_Ma_FichaIngresoServicio_ENC e ON d.id_fichaingresoservicio = e.id_fichaingresoservicio
                LEFT JOIN mae_centro cen ON e.id_centro = cen.id_centro
                LEFT JOIN mae_empresa emp ON e.id_empresa = emp.id_empresa
                WHERE d.id_ejecucion = @id
                ORDER BY d.orden ASC
            `);

        ejec.fichas = detalleResult.recordset;
        return ejec;
    }

    async createEjecucion(data, user) {
        const { id_ruta_planificada, fecha_ejecucion, id_muestreador_inst, id_muestreador_ret, fichas, observaciones } = data;

        // Resolve id_agendamam for each selected ficha+correlativo
        const resolvedAssignments = await Promise.all(
            fichas.map(async (f) => {
                // If the caller already knows the id_agendamam, use it directly
                if (f.id_agendamam) {
                    return {
                        id: f.id_agendamam,
                        fecha: fecha_ejecucion,
                        fechaRetiro: fecha_ejecucion,
                        idMuestreadorInstalacion: Number(id_muestreador_inst),
                        idMuestreadorRetiro: Number(id_muestreador_ret || id_muestreador_inst),
                        idFichaIngresoServicio: f.id_fichaingresoservicio,
                        frecuenciaCorrelativo: f.frecuencia_correlativo || 'PorAsignar',
                        _orden: f.orden
                    };
                }

                // Otherwise look up the agenda row matching the selected correlativo
                const rows = await fichaService.getForAssignmentDetail(f.id_fichaingresoservicio, 1).catch(() => []);
                const matched = rows.find(r => r.frecuencia_correlativo === f.frecuencia_correlativo);
                const row = matched || rows.find(r => {
                    const estado = (r.nombre_estadomuestreo || '').toUpperCase();
                    return !estado.includes('EJECUTADO') && !estado.includes('CANCELADO') && !estado.includes('ANULADO');
                }) || rows[0];

                if (!row) {
                    logger.warn(`No agenda row found for ficha ${f.id_fichaingresoservicio} correlativo ${f.frecuencia_correlativo}`);
                    return null;
                }

                return {
                    id: row.id_agendamam,
                    fecha: fecha_ejecucion,
                    fechaRetiro: fecha_ejecucion,
                    idMuestreadorInstalacion: Number(id_muestreador_inst),
                    idMuestreadorRetiro: Number(id_muestreador_ret || id_muestreador_inst),
                    idFichaIngresoServicio: f.id_fichaingresoservicio,
                    frecuenciaCorrelativo: row.frecuencia_correlativo || f.frecuencia_correlativo || 'PorAsignar',
                    _orden: f.orden
                };
            })
        );

        const assignments = resolvedAssignments.filter(Boolean);

        if (assignments.length === 0) {
            throw new Error('No se encontraron registros de agenda para las fichas seleccionadas');
        }

        // Run the bulk agenda update
        const batchResult = await fichaService.batchUpdateAgenda({
            assignments,
            user: user ? { id: user.id } : { id: 0 },
            observaciones: observaciones || `Ejecución de Ruta #${id_ruta_planificada}`
        });

        // Build a map of fichaId → id_agendamam actually used
        const agendaMap = new Map(assignments.map(a => [a.idFichaIngresoServicio, a.id]));

        // Persist the ejecucion record + detail
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();

            const reqHeader = new sql.Request(transaction);
            reqHeader.input('id_ruta', sql.Int, id_ruta_planificada);
            reqHeader.input('fecha', sql.Date, new Date(fecha_ejecucion));
            reqHeader.input('inst', sql.Int, Number(id_muestreador_inst));
            reqHeader.input('ret', sql.Int, id_muestreador_ret ? Number(id_muestreador_ret) : null);
            reqHeader.input('obs', sql.VarChar(500), observaciones || null);
            reqHeader.input('uid', sql.Int, user ? user.id : null);

            const insertResult = await reqHeader.query(`
                INSERT INTO mae_rutas_ejecuciones
                    (id_ruta_planificada, fecha_ejecucion, id_muestreador_inst, id_muestreador_ret, observaciones, id_usuario_creador)
                OUTPUT INSERTED.id_ejecucion
                VALUES (@id_ruta, @fecha, @inst, @ret, @obs, @uid)
            `);

            const idEjecucion = insertResult.recordset[0].id_ejecucion;

            // Insert detail rows
            const reqDetalle = new sql.Request(transaction);
            reqDetalle.input('id_ejec', sql.Int, idEjecucion);
            const valueRows = fichas.map((f, i) => {
                reqDetalle.input(`fid_${i}`, sql.Numeric(10, 0), f.id_fichaingresoservicio);
                reqDetalle.input(`ord_${i}`, sql.Int, f.orden || (i + 1));
                reqDetalle.input(`corr_${i}`, sql.VarChar(100), f.frecuencia_correlativo || null);
                reqDetalle.input(`agd_${i}`, sql.Int, agendaMap.get(f.id_fichaingresoservicio) || null);
                return `(@id_ejec, @fid_${i}, @ord_${i}, @corr_${i}, @agd_${i})`;
            });

            await reqDetalle.query(`
                INSERT INTO mae_rutas_ejecuciones_detalle
                    (id_ejecucion, id_fichaingresoservicio, orden, frecuencia_correlativo, id_agendamam)
                VALUES ${valueRows.join(', ')}
            `);

            await transaction.commit();

            return {
                id_ejecucion: idEjecucion,
                id_ruta_planificada,
                fecha_ejecucion,
                fichas_asignadas: assignments.length,
                batch_result: batchResult
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}

export default new RutasEjecucionesService();
