import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';
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

        // 2. Obtener el detalle (Fichas)
        const detalleResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT d.*, 
                       e.id_fichaingresoservicio as num_ficha,
                       cen.nombre_centro as centro,
                       emp.nombre_empresa as empresa_servicio,
                       obj.nombre_objetivomuestreo_ma as objetivo
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

            // Insertar Detalle
            for (let i = 0; i < fichas.length; i++) {
                const f = fichas[i];
                const reqDetalle = new sql.Request(transaction);
                reqDetalle.input('id_ruta', sql.Int, idRuta);
                reqDetalle.input('id_ficha', sql.Numeric(10,0), f.id_fichaingresoservicio || f.id);
                reqDetalle.input('orden', sql.Int, f.orden || (i + 1));
                reqDetalle.input('correlativo', sql.VarChar(100), f.frecuencia_correlativo || null);
                
                await reqDetalle.query(`
                    INSERT INTO mae_rutas_planificadas_detalle (id_ruta_planificada, id_fichaingresoservicio, orden, frecuencia_correlativo)
                    VALUES (@id_ruta, @id_ficha, @orden, @correlativo)
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
        // Delete detail first (safe even if CASCADE exists)
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM mae_rutas_planificadas_detalle WHERE id_ruta_planificada = @id');
        // Then delete the header
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM mae_rutas_planificadas WHERE id_ruta_planificada = @id');
    }

    async asignar(id, assignmentParams, user) {
        // Obtenemos los detalles de la ruta
        const ruta = await this.getById(id);
        if (!ruta) throw new Error('Ruta no encontrada');
        
        // Extraer los ids de las fichas para pasarlos a getAssignmentDetail
        const selectedIds = ruta.fichas.map(f => f.id_fichaingresoservicio);
        
        const { assignDate, assignMuestreadorInst, assignMuestreadorRet } = assignmentParams;
        
        // Logica idéntica al frontend: Buscar los pendientes y enviarlos a batchUpdateAgenda
        const assignmentPromises = selectedIds.map(fichaId => fichaService.getForAssignmentDetail(fichaId, 1));
        const allDetails = await Promise.all(assignmentPromises);

        const assignments = [];
        for (let i = 0; i < selectedIds.length; i++) {
            const fichaId = selectedIds[i];
            const rows = allDetails[i];

            if (!Array.isArray(rows) || rows.length === 0) continue;

            const pendingRow = rows.find(r => {
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

        // Ejecutar asignación masiva reutilizando fichaService
        const response = await fichaService.batchUpdateAgenda({
            assignments,
            user: user ? { id: user.id } : { id: 0 },
            observaciones: `Asignación por Ruta Guardada #${id}: ${ruta.nombre_ruta}`
        });

        // Cambiar estado de la ruta a ASIGNADA
        const pool = await getConnection();
        await pool.request()
            .input('id', sql.Int, id)
            .query("UPDATE mae_rutas_planificadas SET estado = 'ASIGNADA' WHERE id_ruta_planificada = @id");

        return response;
    }
}

export default new RutasPlanificadasService();
