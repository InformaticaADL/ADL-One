import { getConnection } from '../config/database.js';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';
import auditService from './audit.service.js';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

class AuthService {
    async login(username, password, rememberMe) {
        const secret = process.env.JWT_SECRET;
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
                .query(`
                    SELECT
                        u.id_usuario,
                        u.nombre_usuario,
                        u.usuario,
                        u.mam_cargo,
                        u.correo_electronico,
                        u.habilitado,
                        u.seccion,
                        u.foto,
                        u.clave_usuario,
                        c.nombre_cargo,
                        (
                            SELECT r.nombre_rol + ','
                            FROM mae_rol r
                            INNER JOIN rel_usuario_rol ur ON r.id_rol = ur.id_rol
                            WHERE ur.id_usuario = u.id_usuario
                            FOR XML PATH('')
                        ) as roles_list
                    FROM mae_usuario u
                    LEFT JOIN mae_cargo c ON u.id_cargo = c.id_cargo
                    WHERE u.nombre_usuario = @username
                `);
            logger.info(`AuthService: User Lookup Query executed in ${Date.now() - startUserQuery}ms`);

            if (result.recordset.length > 0) {
                const user = result.recordset[0];

                // Verify password — supports bcrypt hashes and legacy plain-text (auto-migrates on login)
                const storedPassword = user.clave_usuario;
                let passwordValid = false;
                if (storedPassword && storedPassword.startsWith('$2')) {
                    passwordValid = await bcrypt.compare(password, storedPassword);
                } else {
                    passwordValid = storedPassword === password;
                    if (passwordValid) {
                        // Migrate plain-text password to bcrypt on successful login
                        const hash = await bcrypt.hash(password, 12);
                        await pool.request()
                            .input('hash', sql.VarChar(255), hash)
                            .input('userId', sql.Numeric(10, 0), user.id_usuario)
                            .query(`UPDATE mae_usuario SET clave_usuario = @hash WHERE id_usuario = @userId`);
                    }
                }

                if (!passwordValid) {
                    auditService.log({
                        usuario_id: 0,
                        area_key: 'it',
                        modulo_nombre: 'Seguridad',
                        evento_tipo: 'LOGIN_FAILURE',
                        entidad_nombre: 'mae_usuario',
                        entidad_id: '0',
                        descripcion_humana: `Intento de login fallido: credenciales inválidas para '${username}'`,
                        metadatos_extra: { username },
                        severidad: 2
                    });
                    return null;
                }

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
                const rolesArray = user.roles_list ? user.roles_list.split(',').filter(r => r.trim()) : [];
                const token = jwt.sign(
                    {
                        id: user.id_usuario,
                        username: user.nombre_usuario,
                        name: user.usuario,
                        role: user.mam_cargo,
                        roles: rolesArray,
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
                        cargo: user.nombre_cargo,
                        roles: user.roles_list ? user.roles_list.split(',').filter(r => r) : [],
                        foto: user.foto,
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

    async changePassword(userId, currentPassword, newPassword) {
        try {
            const pool = await getConnection();

            // Fetch stored password to compare (supports bcrypt and legacy plain-text)
            const userResult = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .query(`SELECT clave_usuario FROM mae_usuario WHERE id_usuario = @userId`);

            if (userResult.recordset.length === 0) {
                throw new Error('Usuario no encontrado');
            }

            const storedPassword = userResult.recordset[0].clave_usuario;
            let passwordValid = false;
            if (storedPassword && storedPassword.startsWith('$2')) {
                passwordValid = await bcrypt.compare(currentPassword, storedPassword);
            } else {
                passwordValid = storedPassword === currentPassword;
            }

            if (!passwordValid) {
                throw new Error('La contraseña actual es incorrecta');
            }

            const newHash = await bcrypt.hash(newPassword, 12);

            // Update password
            await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('newPassword', sql.VarChar(255), newHash)
                .query(`
                    UPDATE mae_usuario
                    SET clave_usuario = @newPassword
                    WHERE id_usuario = @userId
                `);

            auditService.log({
                usuario_id: userId,
                area_key: 'it',
                modulo_nombre: 'Seguridad',
                evento_tipo: 'PASSWORD_CHANGE',
                entidad_nombre: 'mae_usuario',
                entidad_id: userId,
                descripcion_humana: `El usuario con ID ${userId} ha cambiado su contraseña`,
                severidad: 1
            });

            return true;
        } catch (error) {
            logger.error('Error changing password:', error);
            throw error;
        }
    }
}

export default new AuthService();
