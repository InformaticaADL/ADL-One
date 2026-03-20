import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';

class ChatService {
    async getRecentChats(userId) {
        try {
            const pool = await getConnection();
            // Get users with whom the current user has chatted
            const result = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .query(`
                    WITH LastMessages AS (
                        SELECT 
                            CASE WHEN id_emisor = @userId THEN id_receptor ELSE id_emisor END as partner_id,
                            mensaje,
                            fecha,
                            leido,
                            id_emisor,
                            ROW_NUMBER() OVER (PARTITION BY CASE WHEN id_emisor = @userId THEN id_receptor ELSE id_emisor END ORDER BY fecha DESC) as rn
                        FROM mae_chat_mensaje
                        WHERE id_emisor = @userId OR id_receptor = @userId
                    ),
                    UnreadCounts AS (
                        SELECT id_emisor as partner_id, COUNT(*) as unread
                        FROM mae_chat_mensaje
                        WHERE id_receptor = @userId AND leido = 0
                        GROUP BY id_emisor
                    )
                    SELECT 
                        u.id_usuario,
                        u.usuario as nombre,
                        u.foto,
                        m.mensaje as ultimo_mensaje,
                        m.fecha as fecha_ultimo,
                        ISNULL(uc.unread, 0) as unread_count
                    FROM mae_usuario u
                    INNER JOIN LastMessages m ON u.id_usuario = m.partner_id
                    LEFT JOIN UnreadCounts uc ON u.id_usuario = uc.partner_id
                    WHERE m.rn = 1
                    ORDER BY m.fecha DESC
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error in getRecentChats service:', error);
            throw error;
        }
    }

    async getConversation(userId, targetUserId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('targetUserId', sql.Numeric(10, 0), targetUserId)
                .query(`
                    SELECT id_mensaje, id_emisor, id_receptor, mensaje, fecha, leido
                    FROM mae_chat_mensaje
                    WHERE (id_emisor = @userId AND id_receptor = @targetUserId)
                       OR (id_emisor = @targetUserId AND id_receptor = @userId)
                    ORDER BY fecha ASC
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error in getConversation service:', error);
            throw error;
        }
    }

    async sendMessage(userId, targetUserId, mensaje) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('emisor', sql.Numeric(10, 0), userId)
                .input('receptor', sql.Numeric(10, 0), targetUserId)
                .input('mensaje', sql.VarChar(sql.MAX), mensaje)
                .query(`
                    INSERT INTO mae_chat_mensaje (id_emisor, id_receptor, mensaje, fecha, leido)
                    OUTPUT INSERTED.*
                    VALUES (@emisor, @receptor, @mensaje, GETDATE(), 0)
                `);
            return result.recordset[0];
        } catch (error) {
            logger.error('Error in sendMessage service:', error);
            throw error;
        }
    }

    async markAsRead(userId, targetUserId) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('targetUserId', sql.Numeric(10, 0), targetUserId)
                .query(`
                    UPDATE mae_chat_mensaje
                    SET leido = 1
                    WHERE id_receptor = @userId AND id_emisor = @targetUserId AND leido = 0
                `);
        } catch (error) {
            logger.error('Error in markAsRead service:', error);
            throw error;
        }
    }

    async searchUsers(query, limit = 10) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('query', sql.VarChar, `%${query}%`)
                .input('limit', sql.Int, limit)
                .query(`
                    SELECT TOP (@limit) id_usuario, usuario as nombre, foto
                    FROM mae_usuario
                    WHERE (usuario LIKE @query OR nombre_usuario LIKE @query)
                      AND habilitado = 'S'
                    ORDER BY usuario ASC
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error in searchUsers chat service:', error);
            throw error;
        }
    }
}

export default new ChatService();
