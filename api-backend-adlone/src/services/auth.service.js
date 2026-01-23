import { getConnection } from '../config/database.js';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

// Secret key should be in .env, using default for now
const JWT_SECRET = process.env.JWT_SECRET || 'adl-secret-key-2024';

class AuthService {
    async login(username, password) {
        try {
            const pool = await getConnection();

            // Case insensitive comparison for username (SQL Server default collation usually handles this, 
            // but we can enforce it if needed. For now trusting DB collation)
            // Password checked as plain text per requirements/legacy state.

            const result = await pool.request()
                .input('username', sql.VarChar, username)
                .input('password', sql.VarChar, password)
                .query(`
                    SELECT id_usuario, nombre_usuario, usuario, mam_cargo, correo_electronico, habilitado
                    FROM mae_usuario 
                    WHERE nombre_usuario = @username AND clave_usuario = @password
                `);

            if (result.recordset.length > 0) {
                const user = result.recordset[0];

                // Check habilitado (assuming 'S'/'N' or true/false)
                if (user.habilitado === 'N' || user.habilitado === false) {
                    throw new Error('Usuario deshabilitado'); // Handler controller will catch
                }

                // Generate Token
                const token = jwt.sign(
                    {
                        id: user.id_usuario,
                        username: user.nombre_usuario,
                        name: user.usuario,
                        role: user.mam_cargo
                    },
                    JWT_SECRET,
                    { expiresIn: '12h' }
                );

                return {
                    token,
                    user: {
                        id: user.id_usuario,
                        username: user.nombre_usuario,
                        name: user.usuario,
                        email: user.correo_electronico,
                        role: user.mam_cargo
                    }
                };
            }

            return null; // User not found or invalid password
        } catch (error) {
            logger.error('Login error:', error);
            throw error;
        }
    }
}

export default new AuthService();
