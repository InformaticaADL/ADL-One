import { getConnection } from '../config/database.js';
import sql from 'mssql';
import fichaService from './ficha.service.js';

const calcInstDate = (retiroDate, duracionHoras) => {
    const dayOffset = Math.floor((Number(duracionHoras) || 0) / 24);
    if (dayOffset === 0) return retiroDate;
    const d = new Date(retiroDate + 'T00:00:00');
    d.setDate(d.getDate() - dayOffset);
    return d.toISOString().split('T')[0];
};

class RutasPlanificadasService {

    // ─── GRUPOS ────────────────────────────────────────────────────────────────

    async getGrupos() {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT g.*,
                   (SELECT COUNT(*) FROM mae_rutas_planificadas WHERE id_grupo = g.id_grupo) as cantidad_rutas
            FROM mae_grupos_rutas g
            WHERE g.activo = 1
            ORDER BY g.nombre_grupo ASC
        `);
        return result.recordset;
    }

    async createGrupo(data) {
        const { nombre_grupo, descripcion } = data;
        const pool = await getConnection();
        const result = await pool.request()
            .input('nombre', sql.NVarChar(250), nombre_grupo)
            .input('desc', sql.NVarChar(1000), descripcion || null)
            .query(`
                INSERT INTO mae_grupos_rutas (nombre_grupo, descripcion)
                OUTPUT INSERTED.*
                VALUES (@nombre, @desc)
            `);
        return result.recordset[0];
    }

    async updateGrupo(id, data) {
        const { nombre_grupo, descripcion } = data;
        const pool = await getConnection();
        await pool.request()
            .input('id', sql.Int, id)
            .input('nombre', sql.NVarChar(250), nombre_grupo)
            .input('desc', sql.NVarChar(1000), descripcion || null)
            .query(`UPDATE mae_grupos_rutas SET nombre_grupo = @nombre, descripcion = @desc WHERE id_grupo = @id`);
        return { id_grupo: id, nombre_grupo, descripcion };
    }

    async deleteGrupo(id) {
        const pool = await getConnection();
        // Desasociar rutas del grupo antes de eliminar
        await pool.request()
            .input('id', sql.Int, id)
            .query(`UPDATE mae_rutas_planificadas SET id_grupo = NULL WHERE id_grupo = @id`);
        await pool.request()
            .input('id', sql.Int, id)
            .query(`UPDATE mae_grupos_rutas SET activo = 0 WHERE id_grupo = @id`);
    }

    // ─── RUTAS ─────────────────────────────────────────────────────────────────

    async getAll() {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT
                r.*,
                u.nombre_usuario as creador,
                g.nombre_grupo,
                g.descripcion as grupo_descripcion,
                (SELECT COUNT(*) FROM mae_rutas_planificadas_detalle WHERE id_ruta_planificada = r.id_ruta_planificada) as cantidad_fichas,
                (SELECT COUNT(*) FROM mae_rutas_ejecuciones WHERE id_ruta_planificada = r.id_ruta_planificada) as total_ejecuciones,
                (SELECT MAX(fecha_creacion) FROM mae_rutas_ejecuciones WHERE id_ruta_planificada = r.id_ruta_planificada) as ultima_ejecucion
            FROM mae_rutas_planificadas r
            LEFT JOIN mae_usuario u ON r.id_usuario_creador = u.id_usuario
            LEFT JOIN mae_grupos_rutas g ON r.id_grupo = g.id_grupo
            ORDER BY g.nombre_grupo ASC, r.fecha_creacion DESC
        `);
        return result.recordset;
    }

    async getById(id) {
        const pool = await getConnection();

        const cabeceraResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT r.*, u.nombre_usuario as creador, g.nombre_grupo
                FROM mae_rutas_planificadas r
                LEFT JOIN mae_usuario u ON r.id_usuario_creador = u.id_usuario
                LEFT JOIN mae_grupos_rutas g ON r.id_grupo = g.id_grupo
                WHERE r.id_ruta_planificada = @id
            `);

        if (cabeceraResult.recordset.length === 0) return null;
        const ruta = cabeceraResult.recordset[0];

        const detalleResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT d.*,
                       e.id_fichaingresoservicio as num_ficha,
                       cen.nombre_centro as centro,
                       emp.nombre_empresa as empresa_servicio,
                       obj.nombre_objetivomuestreo_ma as objetivo,
                       e.referencia_googlemaps as ref_google,
                       e.ma_coordenadas,
                       cen.latitud,
                       cen.longitud
                FROM mae_rutas_planificadas_detalle d
                JOIN App_Ma_FichaIngresoServicio_ENC e ON d.id_fichaingresoservicio = e.id_fichaingresoservicio
                LEFT JOIN mae_centro cen ON e.id_centro = cen.id_centro
                LEFT JOIN mae_empresa emp ON e.id_empresa = emp.id_empresa
                LEFT JOIN mae_objetivomuestreo_ma obj ON e.id_objetivomuestreo_ma = obj.id_objetivomuestreo_ma
                WHERE d.id_ruta_planificada = @id
                ORDER BY d.orden ASC
            `);

        ruta.fichas = detalleResult.recordset;
        return ruta;
    }

    async create(data, user) {
        const { nombre_ruta, fichas, id_grupo, descripcion } = data;
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();

            const reqCabecera = new sql.Request(transaction);
            reqCabecera.input('nombre', sql.NVarChar(250), nombre_ruta);
            reqCabecera.input('creador', sql.Int, user ? user.id : null);
            reqCabecera.input('grupo', sql.Int, id_grupo || null);
            reqCabecera.input('desc', sql.NVarChar(1000), descripcion || null);

            const insertResult = await reqCabecera.query(`
                INSERT INTO mae_rutas_planificadas (nombre_ruta, id_usuario_creador, estado, id_grupo, descripcion)
                OUTPUT INSERTED.id_ruta_planificada
                VALUES (@nombre, @creador, 'PENDIENTE', @grupo, @desc)
            `);

            const idRuta = insertResult.recordset[0].id_ruta_planificada;

            if (fichas && fichas.length > 0) {
                const reqDetalle = new sql.Request(transaction);
                reqDetalle.input('id_ruta', sql.Int, idRuta);
                const valueRows = fichas.map((f, i) => {
                    reqDetalle.input(`id_ficha_${i}`, sql.Numeric(10, 0), f.id_fichaingresoservicio || f.id);
                    reqDetalle.input(`orden_${i}`, sql.Int, f.orden || (i + 1));
                    reqDetalle.input(`correlativo_${i}`, sql.VarChar(100), f.frecuencia_correlativo || null);
                    return `(@id_ruta, @id_ficha_${i}, @orden_${i}, @correlativo_${i})`;
                });
                await reqDetalle.query(`
                    INSERT INTO mae_rutas_planificadas_detalle (id_ruta_planificada, id_fichaingresoservicio, orden, frecuencia_correlativo)
                    VALUES ${valueRows.join(', ')}
                `);
            }

            await transaction.commit();
            return { id_ruta_planificada: idRuta, nombre_ruta };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async updateGrupo(id, id_grupo) {
        const pool = await getConnection();
        await pool.request()
            .input('id', sql.Int, id)
            .input('grupo', sql.Int, id_grupo || null)
            .query(`UPDATE mae_rutas_planificadas SET id_grupo = @grupo WHERE id_ruta_planificada = @id`);
        return { id_ruta_planificada: Number(id), id_grupo: id_grupo || null };
    }

    async update(id, data, user) {
        const { nombre_ruta, fichas, id_grupo, descripcion } = data;
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();

            const reqHeader = new sql.Request(transaction);
            await reqHeader
                .input('id', sql.Int, id)
                .input('nombre', sql.NVarChar(250), nombre_ruta)
                .input('grupo', sql.Int, id_grupo !== undefined ? (id_grupo || null) : undefined)
                .input('desc', sql.NVarChar(1000), descripcion !== undefined ? (descripcion || null) : undefined)
                .query(`
                    UPDATE mae_rutas_planificadas
                    SET nombre_ruta = @nombre,
                        id_grupo = @grupo,
                        descripcion = @desc
                    WHERE id_ruta_planificada = @id
                `);

            const reqDel = new sql.Request(transaction);
            await reqDel
                .input('id', sql.Int, id)
                .query(`DELETE FROM mae_rutas_planificadas_detalle WHERE id_ruta_planificada = @id`);

            if (fichas && fichas.length > 0) {
                const reqDetalle = new sql.Request(transaction);
                reqDetalle.input('id_ruta', sql.Int, id);
                const valueRows = fichas.map((f, i) => {
                    reqDetalle.input(`id_ficha_${i}`, sql.Numeric(10, 0), f.id_fichaingresoservicio || f.id);
                    reqDetalle.input(`orden_${i}`, sql.Int, f.orden || (i + 1));
                    reqDetalle.input(`correlativo_${i}`, sql.VarChar(100), f.frecuencia_correlativo || null);
                    return `(@id_ruta, @id_ficha_${i}, @orden_${i}, @correlativo_${i})`;
                });
                await reqDetalle.query(`
                    INSERT INTO mae_rutas_planificadas_detalle (id_ruta_planificada, id_fichaingresoservicio, orden, frecuencia_correlativo)
                    VALUES ${valueRows.join(', ')}
                `);
            }

            await transaction.commit();
            return { id_ruta_planificada: Number(id), nombre_ruta };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async clone(id, user, options = {}) {
        const original = await this.getById(id);
        if (!original) throw new Error('Ruta no encontrada');

        const nombre = options.nombre_ruta?.trim() || `${original.nombre_ruta} (copia)`;
        // id_grupo: if explicitly passed (even null = sin grupo), use it; otherwise inherit
        const id_grupo = Object.prototype.hasOwnProperty.call(options, 'id_grupo')
            ? (options.id_grupo || null)
            : (original.id_grupo || null);

        return this.create({
            nombre_ruta: nombre,
            fichas: original.fichas,
            id_grupo,
            descripcion: original.descripcion || null,
        }, user);
    }

    async delete(id) {
        const pool = await getConnection();

        const checkRes = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT COUNT(*) AS cnt FROM mae_rutas_ejecuciones
                    WHERE id_ruta_planificada = @id AND estado NOT IN ('COMPLETADA','CANCELADA','ANULADA')`);
        if (checkRes.recordset[0].cnt > 0) {
            throw new Error('No se puede eliminar la ruta porque tiene ejecuciones activas asociadas.');
        }

        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM mae_rutas_planificadas_detalle WHERE id_ruta_planificada = @id');
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM mae_rutas_planificadas WHERE id_ruta_planificada = @id');
    }

    async asignar(id, assignmentParams, user) {
        const ruta = await this.getById(id);
        if (!ruta) throw new Error('Ruta no encontrada');

        const { assignDate, assignMuestreadorInst, assignMuestreadorRet, observaciones: obsParam } = assignmentParams;

        const correlativoMap = new Map(
            ruta.fichas.map(f => [f.id_fichaingresoservicio, f.frecuencia_correlativo])
        );

        const selectedIds = ruta.fichas.map(f => f.id_fichaingresoservicio);
        const allDetails = await Promise.all(
            selectedIds.map(fichaId => fichaService.getForAssignmentDetail(fichaId, 1))
        );

        const assignments = [];
        for (let i = 0; i < selectedIds.length; i++) {
            const fichaId = selectedIds[i];
            const rows = allDetails[i];
            if (!Array.isArray(rows) || rows.length === 0) continue;

            const storedCorrelativo = correlativoMap.get(fichaId);
            const matchedRow = storedCorrelativo
                ? rows.find(r => r.frecuencia_correlativo === storedCorrelativo)
                : null;

            const pendingRow = matchedRow || rows.find(r => {
                const estado = (r.nombre_estadomuestreo || '').toUpperCase();
                return !estado.includes('EJECUTADO') && !estado.includes('CANCELADO') && !estado.includes('ANULADO');
            }) || rows[0];

            assignments.push({
                id: pendingRow.id_agendamam,
                fecha: calcInstDate(assignDate, pendingRow.ma_duracion_muestreo),
                fechaRetiro: assignDate,
                idMuestreadorInstalacion: Number(assignMuestreadorInst),
                idMuestreadorRetiro: Number(assignMuestreadorRet || assignMuestreadorInst),
                idFichaIngresoServicio: pendingRow.id_fichaingresoservicio || fichaId,
                frecuenciaCorrelativo: pendingRow.frecuencia_correlativo || 'PorAsignar'
            });
        }

        if (assignments.length === 0) {
            throw new Error('No hay registros pendientes para asignar en las fichas de esta ruta');
        }

        const obsText = obsParam?.trim() || `Asignación por Ruta Guardada #${id}: ${ruta.nombre_ruta}`;
        const batchResult = await fichaService.batchUpdateAgenda({
            assignments,
            user: user ? { id: user.id } : { id: 0 },
            observaciones: obsText
        });

        // Registrar en historial de ejecuciones
        try {
            const pool = await getConnection();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            const reqHeader = new sql.Request(transaction);
            reqHeader.input('id_ruta', sql.Int, id);
            reqHeader.input('fecha', sql.Date, new Date(assignDate));
            reqHeader.input('inst', sql.Int, Number(assignMuestreadorInst));
            reqHeader.input('ret', sql.Int, assignMuestreadorRet ? Number(assignMuestreadorRet) : null);
            reqHeader.input('obs', sql.VarChar(500), obsText);
            reqHeader.input('uid', sql.Int, user ? user.id : null);

            const insertResult = await reqHeader.query(`
                INSERT INTO mae_rutas_ejecuciones
                    (id_ruta_planificada, fecha_ejecucion, id_muestreador_inst, id_muestreador_ret, observaciones, id_usuario_creador)
                OUTPUT INSERTED.id_ejecucion
                VALUES (@id_ruta, @fecha, @inst, @ret, @obs, @uid)
            `);

            const idEjecucion = insertResult.recordset[0].id_ejecucion;

            const reqDetalle = new sql.Request(transaction);
            reqDetalle.input('id_ejec', sql.Int, idEjecucion);
            const valueRows = assignments.map((a, i) => {
                reqDetalle.input(`fid_${i}`, sql.Numeric(10, 0), a.idFichaIngresoServicio);
                reqDetalle.input(`ord_${i}`, sql.Int, i + 1);
                reqDetalle.input(`corr_${i}`, sql.VarChar(100), a.frecuenciaCorrelativo || null);
                reqDetalle.input(`agd_${i}`, sql.Int, a.id);
                return `(@id_ejec, @fid_${i}, @ord_${i}, @corr_${i}, @agd_${i})`;
            });

            await reqDetalle.query(`
                INSERT INTO mae_rutas_ejecuciones_detalle
                    (id_ejecucion, id_fichaingresoservicio, orden, frecuencia_correlativo, id_agendamam)
                VALUES ${valueRows.join(', ')}
            `);

            await transaction.commit();
            return { ...batchResult, id_ejecucion: idEjecucion };
        } catch (ejecError) {
            // No fallamos la operación completa si solo falla el registro en historial
            logger.warn('No se pudo registrar la ejecución en historial:', ejecError);
            return batchResult;
        }
    }
}

export default new RutasPlanificadasService();
