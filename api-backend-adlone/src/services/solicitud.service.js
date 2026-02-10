import sql from '../config/database.js';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';

class SolicitudService {
    async create(data) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('tipo', sql.VarChar(20), data.tipo_solicitud)
                .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(data.datos_json))
                .input('usuario', sql.Numeric(10, 0), data.usuario_solicita)
                .query(`
                    INSERT INTO mae_solicitud_equipo (tipo_solicitud, estado, datos_json, usuario_solicita, fecha_solicitud)
                    VALUES (@tipo, 'PENDIENTE', @datos, @usuario, GETDATE());
                    SELECT SCOPE_IDENTITY() AS id;
                `);
            return { success: true, id: result.recordset[0].id };
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
                       u_sol.nombre_usuario as nombre_solicitante,
                       u_rev.nombre_usuario as nombre_revisor
                FROM mae_solicitud_equipo s
                LEFT JOIN mae_usuario u_sol ON s.usuario_solicita = u_sol.id_usuario
                LEFT JOIN mae_usuario u_rev ON s.usuario_revisa = u_rev.id_usuario
            `;

            const request = pool.request();
            const whereConditions = [];

            if (filters.estado) {
                whereConditions.push('s.estado = @estado');
                request.input('estado', sql.VarChar(20), filters.estado);
            }
            if (filters.usuario_solicita) {
                whereConditions.push('s.usuario_solicita = @usuario');
                request.input('usuario', sql.Numeric(10, 0), filters.usuario_solicita);
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

    async updateStatus(id, status, feedback, adminId, datos_json = null) {
        try {
            const pool = await getConnection();
            let query = `
                UPDATE mae_solicitud_equipo 
                SET estado = @status, 
                    feedback_admin = @feedback, 
                    usuario_revisa = @adminId, 
                    fecha_revision = GETDATE()
            `;

            const request = pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .input('status', sql.VarChar(20), status)
                .input('feedback', sql.VarChar(1000), feedback)
                .input('adminId', sql.Numeric(10, 0), adminId);

            if (datos_json) {
                query += `, datos_json = @datos`;
                request.input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datos_json));
            }

            query += ` WHERE id_solicitud = @id`;

            await request.query(query);
            return { success: true };
        } catch (error) {
            logger.error('Error updating solicitud status:', error);
            throw error;
        }
    }
}

export default new SolicitudService();
