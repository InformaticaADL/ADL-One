import { getConnection } from '../config/database.js';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import auditService from './audit.service.js';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

class AuthService {
    async login(username, password, rememberMe) {
        const secret = process.env.JWT_SECRET || 'adl-secret-key-2024';
        logger.info(`AuthService Debug: Signing with Secret First: ${secret[0]}, Last: ${secret[secret.length - 1]}, Len: ${secret.length}`);
        try {
            logger.info('AuthService: Getting DB connection...');
            const startConn = Date.now();
            const pool = await getConnection();
            logger.info(`AuthService: Connection obtained in ${Date.now() - startConn}ms`);

            // Case insensitive comparison for username (SQL Server default collation usually handles this, 
            // but we can enforce it if needed. For now trusting DB collation)
            // Password checked as plain text per requirements/legacy state.

            logger.info('AuthService: Executing User Lookup Query...');
            const startUserQuery = Date.now();
            const result = await pool.request()
                .input('username', sql.VarChar, username)
                .input('password', sql.VarChar, password)
                .query(`
                    SELECT id_usuario, nombre_usuario, usuario, mam_cargo, correo_electronico, habilitado, seccion
                    FROM mae_usuario 
                    WHERE nombre_usuario = @username AND clave_usuario = @password
                `);
            logger.info(`AuthService: User Lookup Query executed in ${Date.now() - startUserQuery}ms`);

            if (result.recordset.length > 0) {
                const user = result.recordset[0];

                // Check habilitado (assuming 'S'/'N' or true/false)
                if (user.habilitado === 'N' || user.habilitado === false) {
                    auditService.log({

                        usuario_id: user.id_usuario,
                        area_key: 'it',
                        modulo_nombre: 'Seguridad',
                        evento_tipo: 'LOGIN_DISABLED',
                        entidad_nombre: 'mae_usuario',
                        entidad_id: user.id_usuario,
                        descripcion_humana: `Intento de login fallido: usuario '${username}' deshabilitado`,
                        metadatos_extra: { username },
                        severidad: 2
                    });
                    throw new Error('Usuario deshabilitado'); // Handler controller will catch
                }

                // --- RBAC Implementation ---
                // Fetch User Permissions from DB
                // Join: Usuario -> rel_usuario_rol -> rel_rol_permiso -> mae_permiso
                logger.info('AuthService: Executing Permissions Query...');
                const startPermQuery = Date.now();
                const permissionsQuery = await pool.request()
                    .input('userId', sql.Numeric(10, 0), user.id_usuario)
                    .query(`
                        SELECT DISTINCT p.codigo
                        FROM mae_permiso p
                        INNER JOIN rel_rol_permiso rp ON p.id_permiso = rp.id_permiso
                        INNER JOIN rel_usuario_rol ur ON rp.id_rol = ur.id_rol
                        WHERE ur.id_usuario = @userId
                    `);
                logger.info(`AuthService: Permissions Query executed in ${Date.now() - startPermQuery}ms`);

                const permissions = permissionsQuery.recordset.map(row => row.codigo);

                // --- Section-based Automated Permissions (REMOVED) ---
                // We now rely solely on DB roles/permissions as per requirements.

                // Generate Token
                const token = jwt.sign(
                    {
                        id: user.id_usuario,
                        username: user.nombre_usuario,
                        name: user.usuario,
                        role: user.mam_cargo,
                        permissions: permissions // Add permissions to token (Optional, good for client-side checks)
                    },
                    secret,
                    { expiresIn: rememberMe ? '30d' : '12h' }
                );

                auditService.log({

                    usuario_id: user.id_usuario,
                    area_key: 'it',
                    modulo_nombre: 'Seguridad',
                    evento_tipo: 'LOGIN_SUCCESS',
                    entidad_nombre: 'mae_usuario',
                    entidad_id: user.id_usuario,
                    descripcion_humana: `Login exitoso para el usuario ${user.nombre_usuario}`,
                    metadatos_extra: { username },
                    severidad: 1
                });

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

            // If we are here, it's an invalid credential attempt
            auditService.log({

                usuario_id: 0, // Unknown user
                area_key: 'it',
                modulo_nombre: 'Seguridad',
                evento_tipo: 'LOGIN_FAILURE',
                entidad_nombre: 'mae_usuario',
                entidad_id: '0',
                descripcion_humana: `Intento de login fallido: credenciales inválidas para '${username}'`,
                metadatos_extra: { username },
                severidad: 2
            });

            return null; // User not found or invalid password
        } catch (error) {
            logger.error('Login error:', error);
            throw error;
        }
    }
}

export default new AuthService();
