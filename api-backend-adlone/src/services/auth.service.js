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

                // --- RBAC Implementation ---
                // Fetch User Permissions from DB
                // Join: Usuario -> rel_usuario_rol -> rel_rol_permiso -> mae_permiso
                const permissionsQuery = await pool.request()
                    .input('userId', sql.Numeric(10, 0), user.id_usuario)
                    .query(`
                        SELECT DISTINCT p.codigo
                        FROM mae_permiso p
                        INNER JOIN rel_rol_permiso rp ON p.id_permiso = rp.id_permiso
                        INNER JOIN rel_usuario_rol ur ON rp.id_rol = ur.id_rol
                        WHERE ur.id_usuario = @userId
                    `);

                const permissions = permissionsQuery.recordset.map(row => row.codigo);
                // ---------------------------

                // Generate Token
                const token = jwt.sign(
                    {
                        id: user.id_usuario,
                        username: user.nombre_usuario,
                        name: user.usuario,
                        role: user.mam_cargo,
                        permissions: permissions // Add permissions to token (Optional, good for client-side checks)
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
                        role: user.mam_cargo,
                        permissions: permissions // Return to client for Context
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
