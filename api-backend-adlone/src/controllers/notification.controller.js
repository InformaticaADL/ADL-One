import { getConnection } from '../config/database.js';
import sql from '../config/database.js';
import logger from '../utils/logger.js';

export const getEvents = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT * FROM mae_evento_notificacion ORDER BY id_evento');
        res.json(result.recordset);
    } catch (error) {
        logger.error('Error fetching notification events:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

export const getRecipients = async (req, res) => {
    const { eventId } = req.params;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('eventId', sql.Numeric(10, 0), eventId)
            .query(`
                SELECT r.id_relacion, r.id_evento, r.tipo_envio,
                       r.id_usuario, u.nombre_usuario, u.correo_electronico as user_email,
                       r.id_rol, rol.nombre_rol
                FROM rel_evento_destinatario r
                LEFT JOIN mae_usuario u ON r.id_usuario = u.id_usuario AND u.habilitado = 'S'
                LEFT JOIN mae_rol rol ON r.id_rol = rol.id_rol
                WHERE r.id_evento = @eventId
                ORDER BY r.tipo_envio, u.nombre_usuario, rol.nombre_rol
            `);
        res.json(result.recordset);
    } catch (error) {
        logger.error('Error fetching recipients:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

export const addRecipient = async (req, res) => {
    const { eventId } = req.params;
    const { idUsuario, idRol, tipoEnvio } = req.body; // Expect either idUsuario OR idRol

    if (!eventId || (!idUsuario && !idRol)) {
        return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    try {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);
            request.input('idEvento', sql.Numeric(10, 0), eventId);
            request.input('idUsuario', sql.Numeric(10, 0), idUsuario || null);
            request.input('idRol', sql.Numeric(10, 0), idRol || null);
            request.input('tipoEnvio', sql.VarChar(10), tipoEnvio || 'TO');

            // Check duplicate
            const checkQuery = `
                SELECT COUNT(*) as count 
                FROM rel_evento_destinatario 
                WHERE id_evento = @idEvento 
                  AND ((id_usuario = @idUsuario AND id_usuario IS NOT NULL) 
                    OR (id_rol = @idRol AND id_rol IS NOT NULL))
            `;

            const check = await request.query(checkQuery);
            if (check.recordset[0].count > 0) {
                await transaction.rollback();
                return res.status(400).json({ message: 'El destinatario ya existe para este evento' });
            }

            await request.query(`
                INSERT INTO rel_evento_destinatario (id_evento, id_usuario, id_rol, tipo_envio)
                VALUES (@idEvento, @idUsuario, @idRol, @tipoEnvio)
            `);

            await transaction.commit();
            res.json({ success: true, message: 'Destinatario agregado correctamente' });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        logger.error('Error adding recipient:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

export const removeRecipient = async (req, res) => {
    const { id } = req.params; // id_relacion
    try {
        const pool = await getConnection();
        const request = pool.request();
        request.input('id', sql.Numeric(10, 0), id);
        await request.query('DELETE FROM rel_evento_destinatario WHERE id_relacion = @id');
        res.json({ success: true, message: 'Destinatario eliminado' });
    } catch (error) {
        logger.error('Error removing recipient:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
