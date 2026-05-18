import { getConnection } from '../config/database.js';
import sql from 'mssql';
import fichaService from './ficha.service.js';

class RutasPlanificadasService {
    async getAll() {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT r.*, u.nombre_usuario as creador,
                   (SELECT COUNT(*) FROM mae_rutas_planificadas_detalle WHERE id_ruta_planificada = r.id_ruta_planificada) as cantidad_fichas
            FROM mae_rutas_planificadas r
            LEFT JOIN mae_usuario u ON r.id_usuario_creador = u.id_usuario
            ORDER BY r.fecha_creacion DESC
        `);
        return result.recordset;
    }

    async getById(id) {
        const pool = await getConnection();
        
        // 1. Obtener la cabecera
        const cabeceraResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT r.*, u.nombre_usuario as creador
                FROM mae_rutas_planificadas r
                LEFT JOIN mae_usuario u ON r.id_usuario_creador = u.id_usuario
                WHERE r.id_ruta_planificada = @id
            `);
            
        if (cabeceraResult.recordset.length === 0) return null;
        const ruta = cabeceraResult.recordset[0];

        // 2. Obtener el detalle (Fichas) incluyendo ref_google para el mapa
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
        const { nombre_ruta, fichas } = data; // fichas: [{ id_fichaingresoservicio, orden, frecuencia_correlativo? }]
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();

            // Insertar Cabecera
            const reqCabecera = new sql.Request(transaction);
            reqCabecera.input('nombre', sql.VarChar(250), nombre_ruta);
            reqCabecera.input('creador', sql.Int, user ? user.id : null);
            
            const insertResult = await reqCabecera.query(`
                INSERT INTO mae_rutas_planificadas (nombre_ruta, id_usuario_creador, estado)
                OUTPUT INSERTED.id_ruta_planificada
                VALUES (@nombre, @creador, 'PENDIENTE')
            `);
            
            const idRuta = insertResult.recordset[0].id_ruta_planificada;

            // Insertar Detalle — bulk VALUES to avoid N round-trips
            if (fichas.length > 0) {
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

    async delete(id) {
        const pool = await getConnection();

        // Guard: prevent deletion if there are active executions linked to this route
        const checkRes = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT COUNT(*) AS cnt FROM mae_rutas_ejecuciones
                    WHERE id_ruta_planificada = @id AND estado NOT IN ('COMPLETADA','CANCELADA','ANULADA')`);
        if (checkRes.recordset[0].cnt > 0) {
            throw new Error('No se puede eliminar la ruta porque tiene ejecuciones activas asociadas.');
        }

        // Delete detail first, then header
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM mae_rutas_planificadas_detalle WHERE id_ruta_planificada = @id');
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM mae_rutas_planificadas WHERE id_ruta_planificada = @id');
    }

    async update(id, data, user) {
        const { nombre_ruta, fichas } = data;
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();

            // Update header
            const reqHeader = new sql.Request(transaction);
            await reqHeader
                .input('id', sql.Int, id)
                .input('nombre', sql.VarChar(250), nombre_ruta)
                .query(`UPDATE mae_rutas_planificadas SET nombre_ruta = @nombre WHERE id_ruta_planificada = @id`);

            // Replace detail atomically
            const reqDel = new sql.Request(transaction);
            await reqDel
                .input('id', sql.Int, id)
                .query(`DELETE FROM mae_rutas_planificadas_detalle WHERE id_ruta_planificada = @id`);

            if (fichas.length > 0) {
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

    async asignar(id, assignmentParams, user) {
        const ruta = await this.getById(id);
        if (!ruta) throw new Error('Ruta no encontrada');

        const { assignDate, assignMuestreadorInst, assignMuestreadorRet } = assignmentParams;

        // Build a map of fichaId → stored frecuencia_correlativo from the saved route
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

            // Prefer the row matching the stored correlativo; fall back to first pending
            const matchedRow = storedCorrelativo
                ? rows.find(r => r.frecuencia_correlativo === storedCorrelativo)
                : null;

            const pendingRow = matchedRow || rows.find(r => {
                const estado = (r.nombre_estadomuestreo || '').toUpperCase();
                return !estado.includes('EJECUTADO') && !estado.includes('CANCELADO') && !estado.includes('ANULADO');
            }) || rows[0];

            assignments.push({
                id: pendingRow.id_agendamam,
                fecha: assignDate,
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

        const response = await fichaService.batchUpdateAgenda({
            assignments,
            user: user ? { id: user.id } : { id: 0 },
            observaciones: `Asignación por Ruta Guardada #${id}: ${ruta.nombre_ruta}`
        });

        const pool = await getConnection();
        await pool.request()
            .input('id', sql.Int, id)
            .query("UPDATE mae_rutas_planificadas SET estado = 'ASIGNADA' WHERE id_ruta_planificada = @id");

        return response;
    }
}

export default new RutasPlanificadasService();
