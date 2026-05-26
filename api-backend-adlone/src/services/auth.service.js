import { getConnection } from '../config/database.js';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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

            // S-13: si hay bloqueo activo por intentos fallidos, rechazar antes de consultar.
            const lockStatus = await this.checkLoginLockout(username);
            if (lockStatus.locked) {
                const err = new Error(`Demasiados intentos fallidos. Inténtelo nuevamente en ${lockStatus.minutesRemaining} minuto(s).`);
                err.code = 'ACCOUNT_LOCKED';
                err.statusCode = 423;
                throw err;
            }

            // S-02 / S-03: dos pasos — primero buscar usuario por nombre, luego comparar clave case-sensitive.
            logger.info('AuthService: Executing User Lookup Query...');
            const startUserQuery = Date.now();
            const result = await pool.request()
                .input('username', sql.VarChar, username)
                .input('password', sql.VarChar, password)
                .query(`
                    SELECT
                        u.id_usuario,
                        u.nombre_usuario,
                        u.usuario,
                        u.clave_usuario,
                        u.mam_cargo,
                        u.correo_electronico,
                        u.habilitado,
                        u.seccion,
                        u.foto,
                        u.permisos_version,
                        c.nombre_cargo,
                        STRING_AGG(r.nombre_rol, ',') WITHIN GROUP (ORDER BY r.nombre_rol) AS roles_list
                    FROM mae_usuario u
                    LEFT JOIN mae_cargo c ON u.id_cargo = c.id_cargo
                    LEFT JOIN rel_usuario_rol ur ON ur.id_usuario = u.id_usuario
                    LEFT JOIN mae_rol r ON r.id_rol = ur.id_rol
                    WHERE u.nombre_usuario = @username
                    GROUP BY u.id_usuario, u.nombre_usuario, u.usuario, u.clave_usuario, u.mam_cargo,
                             u.correo_electronico, u.habilitado, u.seccion, u.foto,
                             u.permisos_version, c.nombre_cargo
                `);
            logger.info(`AuthService: User Lookup Query executed in ${Date.now() - startUserQuery}ms`);

            // S-03: usuario no encontrado en BD → mensaje distinto
            if (result.recordset.length === 0) {
                await this.recordFailedLoginAttempt(username, 'USER_NOT_FOUND');
                auditService.log({
                    usuario_id: 0,
                    area_key: 'it',
                    modulo_nombre: 'Seguridad',
                    evento_tipo: 'LOGIN_FAILURE',
                    entidad_nombre: 'mae_usuario',
                    entidad_id: '0',
                    descripcion_humana: `Intento de login fallido: usuario inexistente '${username}'`,
                    metadatos_extra: { username, reason: 'USER_NOT_FOUND' },
                    severidad: 2
                });
                const err = new Error('Usuario inexistente');
                err.code = 'USER_NOT_FOUND';
                err.statusCode = 404;
                throw err;
            }

            const candidate = result.recordset[0];

            // S-02: comparar clave en JS exigiendo coincidencia exacta de mayúsculas.
            if (String(candidate.clave_usuario ?? '') !== String(password ?? '')) {
                await this.recordFailedLoginAttempt(username, 'BAD_PASSWORD');
                auditService.log({
                    usuario_id: candidate.id_usuario,
                    area_key: 'it',
                    modulo_nombre: 'Seguridad',
                    evento_tipo: 'LOGIN_FAILURE',
                    entidad_nombre: 'mae_usuario',
                    entidad_id: candidate.id_usuario,
                    descripcion_humana: `Intento de login fallido: contraseña incorrecta para '${username}'`,
                    metadatos_extra: { username, reason: 'BAD_PASSWORD' },
                    severidad: 2
                });
                return null; // Controller traduce a "Credenciales inválidas"
            }

            // Credenciales válidas → limpiar contadores de intentos fallidos (S-13)
            await this.clearFailedLoginAttempts(username);

            const user = candidate;
            {
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
                        permissions: permissions,
                        permisos_version: user.permisos_version ?? 0
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
                        roles: user.roles_list ? user.roles_list.split(',').filter(r => r.trim()) : [],
                        foto: user.foto,
                        permissions: permissions // Return to client for Context
                    }
                };
            }
        } catch (error) {
            logger.error('Login error:', error);
            throw error;
        }
    }

    // S-13: Bloqueo por intentos fallidos. Usa tabla mae_login_attempts (ver scripts entregados).
    async checkLoginLockout(username) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('username', sql.VarChar(150), String(username || '').trim())
                .query(`
                    SELECT failed_count, locked_until
                    FROM mae_login_attempts
                    WHERE LOWER(nombre_usuario) = LOWER(@username)
                `);
            if (result.recordset.length === 0) return { locked: false };
            const row = result.recordset[0];
            if (row.locked_until && new Date(row.locked_until) > new Date()) {
                const minutesRemaining = Math.ceil((new Date(row.locked_until) - new Date()) / 60000);
                return { locked: true, minutesRemaining };
            }
            return { locked: false, failedCount: row.failed_count };
        } catch (err) {
            // Si la tabla no existe aún, no romper el flujo de login
            logger.warn('checkLoginLockout failed (tabla mae_login_attempts ausente?):', err.message);
            return { locked: false };
        }
    }

    async recordFailedLoginAttempt(username, reason) {
        try {
            const pool = await getConnection();
            const MAX_ATTEMPTS = 5;
            const LOCK_MINUTES = 15;
            await pool.request()
                .input('username', sql.VarChar(150), String(username || '').trim())
                .input('max', sql.Int, MAX_ATTEMPTS)
                .input('lockMin', sql.Int, LOCK_MINUTES)
                .input('reason', sql.VarChar(100), reason || '')
                .query(`
                    MERGE mae_login_attempts AS target
                    USING (SELECT @username AS nombre_usuario) AS src
                       ON LOWER(target.nombre_usuario) = LOWER(src.nombre_usuario)
                    WHEN MATCHED THEN
                        UPDATE SET
                            failed_count = target.failed_count + 1,
                            last_attempt_at = SYSDATETIME(),
                            last_reason = @reason,
                            locked_until = CASE
                                WHEN target.failed_count + 1 >= @max
                                THEN DATEADD(MINUTE, @lockMin, SYSDATETIME())
                                ELSE target.locked_until
                            END
                    WHEN NOT MATCHED THEN
                        INSERT (nombre_usuario, failed_count, last_attempt_at, last_reason)
                        VALUES (@username, 1, SYSDATETIME(), @reason);
                `);
        } catch (err) {
            logger.warn('recordFailedLoginAttempt failed:', err.message);
        }
    }

    async clearFailedLoginAttempts(username) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('username', sql.VarChar(150), String(username || '').trim())
                .query(`
                    UPDATE mae_login_attempts
                    SET failed_count = 0, locked_until = NULL, last_reason = NULL
                    WHERE LOWER(nombre_usuario) = LOWER(@username)
                `);
        } catch (err) {
            logger.warn('clearFailedLoginAttempts failed:', err.message);
        }
    }

    async changePassword(userId, currentPassword, newPassword) {
        try {
            const pool = await getConnection();

            // Verify current password
            const userResult = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('currentPassword', sql.VarChar, currentPassword)
                .query(`
                    SELECT id_usuario
                    FROM mae_usuario
                    WHERE id_usuario = @userId AND clave_usuario = @currentPassword
                `);

            if (userResult.recordset.length === 0) {
                throw new Error('La contraseña actual es incorrecta');
            }

            if (newPassword === currentPassword) {
                throw new Error('La nueva contraseña no puede ser igual a la actual');
            }

            // Update password
            await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('newPassword', sql.VarChar, newPassword)
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

    // ─────────────────────────────────────────────────────────────────
    // S-14 / S-15 / S-16 / S-17 — Recuperación de contraseña por email
    // ─────────────────────────────────────────────────────────────────

    // Genera un token hex de 64 chars
    _generateResetToken() {
        const bytes = crypto.randomBytes(48);
        return bytes.toString('hex'); // 96 chars
    }

    _hashToken(token) {
        return crypto.createHash('sha256').update(String(token)).digest('hex');
    }

    /**
     * S-14: solicitar reset enviando email.
     * S-15: responde igual exista o no el email (no revelar enumeración).
     * S-17: al solicitar dos veces, invalida tokens previos del usuario (solo el último vale).
     */
    async requestPasswordReset(email, ipSolicitante) {
        const result = { ok: true }; // siempre 200 para no filtrar existencia
        try {
            const cleanEmail = String(email || '').trim();
            if (!cleanEmail) return result;

            const pool = await getConnection();
            const userRes = await pool.request()
                .input('email', sql.VarChar(200), cleanEmail)
                .query(`
                    SELECT id_usuario, nombre_usuario, correo_electronico, habilitado
                    FROM mae_usuario
                    WHERE LOWER(correo_electronico) = LOWER(@email)
                `);

            if (userRes.recordset.length === 0) {
                logger.info(`[PWD-RESET] Email no registrado: ${cleanEmail} (respuesta genérica)`);
                return result; // S-15: no revelar
            }
            const user = userRes.recordset[0];
            if (user.habilitado === 'N') {
                logger.info(`[PWD-RESET] Usuario ${user.nombre_usuario} deshabilitado — no se envía link`);
                return result;
            }

            // S-17: invalidar tokens previos no usados (marcar como consumidos)
            await pool.request()
                .input('uid', sql.Numeric(10, 0), user.id_usuario)
                .query(`
                    UPDATE mae_password_reset_tokens
                    SET used_at = SYSDATETIME()
                    WHERE id_usuario = @uid AND used_at IS NULL
                `);

            const token = this._generateResetToken();
            const tokenHash = this._hashToken(token);
            const EXPIRES_MIN = 60; // 1 hora

            await pool.request()
                .input('uid', sql.Numeric(10, 0), user.id_usuario)
                .input('hash', sql.VarChar(255), tokenHash)
                .input('exp', sql.DateTime2, new Date(Date.now() + EXPIRES_MIN * 60 * 1000))
                .input('ip', sql.VarChar(45), ipSolicitante || null)
                .query(`
                    INSERT INTO mae_password_reset_tokens (id_usuario, token_hash, expires_at, ip_solicitante)
                    VALUES (@uid, @hash, @exp, @ip)
                `);

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

            // Lazy import para no romper si email.service no está disponible
            const { default: emailService } = await import('./email.service.js');
            await emailService.sendPasswordReset({
                to: user.correo_electronico,
                nombreUsuario: user.nombre_usuario,
                resetUrl,
                expiresInMinutes: EXPIRES_MIN
            });

            auditService.log({
                usuario_id: user.id_usuario,
                area_key: 'it',
                modulo_nombre: 'Seguridad',
                evento_tipo: 'PASSWORD_RESET_REQUESTED',
                entidad_nombre: 'mae_usuario',
                entidad_id: user.id_usuario,
                descripcion_humana: `Solicitud de reset de contraseña para ${user.nombre_usuario}`,
                metadatos_extra: { email: cleanEmail, ip: ipSolicitante },
                severidad: 1
            });

            return result;
        } catch (error) {
            logger.error('requestPasswordReset error:', error);
            return result; // Igualmente devolvemos ok genérico
        }
    }

    /**
     * S-16: validar si un token sirve (existe, no usado, no expirado).
     */
    async validateResetToken(token) {
        if (!token) return { valid: false, reason: 'TOKEN_MISSING' };
        const hash = this._hashToken(token);
        const pool = await getConnection();
        const res = await pool.request()
            .input('h', sql.VarChar(255), hash)
            .query(`
                SELECT t.id_token, t.id_usuario, t.expires_at, t.used_at, u.nombre_usuario
                FROM mae_password_reset_tokens t
                INNER JOIN mae_usuario u ON u.id_usuario = t.id_usuario
                WHERE t.token_hash = @h
            `);
        if (res.recordset.length === 0) return { valid: false, reason: 'TOKEN_INVALID' };
        const row = res.recordset[0];
        if (row.used_at) return { valid: false, reason: 'TOKEN_USED' };
        if (new Date(row.expires_at) < new Date()) return { valid: false, reason: 'TOKEN_EXPIRED' };
        return { valid: true, idUsuario: row.id_usuario, nombreUsuario: row.nombre_usuario };
    }

    /**
     * Consumir token y aplicar nueva contraseña.
     */
    async consumeResetToken(token, newPassword) {
        const validation = await this.validateResetToken(token);
        if (!validation.valid) {
            const err = new Error(validation.reason === 'TOKEN_USED'
                ? 'El link ya fue utilizado'
                : validation.reason === 'TOKEN_EXPIRED'
                    ? 'El link ha expirado'
                    : 'El link no es válido');
            err.code = validation.reason;
            err.statusCode = 410;
            throw err;
        }
        const cleanPwd = String(newPassword || '').trim();
        if (cleanPwd.length < 4) {
            const err = new Error('La contraseña debe tener al menos 4 caracteres');
            err.statusCode = 400;
            throw err;
        }
        const hash = this._hashToken(token);
        const pool = await getConnection();
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            await new sql.Request(tx)
                .input('uid', sql.Numeric(10, 0), validation.idUsuario)
                .input('pwd', sql.VarChar(255), cleanPwd)
                .query(`
                    UPDATE mae_usuario
                    SET clave_usuario = @pwd,
                        permisos_version = ISNULL(permisos_version, 0) + 1
                    WHERE id_usuario = @uid
                `);
            await new sql.Request(tx)
                .input('h', sql.VarChar(255), hash)
                .query(`
                    UPDATE mae_password_reset_tokens
                    SET used_at = SYSDATETIME()
                    WHERE token_hash = @h
                `);
            await tx.commit();
        } catch (err) {
            await tx.rollback();
            throw err;
        }

        // Limpiar bloqueos por intentos fallidos (S-13)
        await this.clearFailedLoginAttempts(validation.nombreUsuario);

        auditService.log({
            usuario_id: validation.idUsuario,
            area_key: 'it',
            modulo_nombre: 'Seguridad',
            evento_tipo: 'PASSWORD_RESET_COMPLETED',
            entidad_nombre: 'mae_usuario',
            entidad_id: validation.idUsuario,
            descripcion_humana: `Contraseña restablecida vía link de reset para ${validation.nombreUsuario}`,
            severidad: 1
        });
        return { success: true };
    }
}

export default new AuthService();
