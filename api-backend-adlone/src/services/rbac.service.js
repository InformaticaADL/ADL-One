import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';
import { invalidatePermVersionCache } from '../utils/permVersionCache.js';

class RbacService {
    // === Roles Management ===
    async getAllRoles() {
        try {
            const pool = await getConnection();
            const result = await pool.request().query('SELECT * FROM mae_rol');
            return result.recordset;
        } catch (error) {
            logger.error('Error getting roles:', error);
            throw error;
        }
    }

    async createRole(nombre, descripcion) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('nombre', sql.VarChar, nombre)
                .input('descripcion', sql.VarChar, descripcion)
                .query('INSERT INTO mae_rol (nombre_rol, descripcion, estado) OUTPUT INSERTED.* VALUES (@nombre, @descripcion, 1)');
            return result.recordset[0];
        } catch (error) {
            logger.error('Error creating role:', error);
            throw error;
        }
    }

    // === Permissions Management ===
    async getAllPermissions() {
        try {
            const pool = await getConnection();

            // Get all enabled permissions ordered by priority
            const permissionsResult = await pool.request().query('SELECT * FROM mae_permiso WHERE habilitado = 1 ORDER BY orden ASC');
            return permissionsResult.recordset;
        } catch (error) {
            logger.error('Error getting permissions:', error);
            throw error;
        }
    }

    async toggleRoleStatus(roleId, estado) {
        try {
            const pool = await getConnection();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                const result = await new sql.Request(transaction)
                    .input('roleId', sql.Numeric(10, 0), roleId)
                    .input('estado', sql.Bit, estado ? 1 : 0)
                    .query('UPDATE mae_rol SET estado = @estado WHERE id_rol = @roleId');
                if (result.rowsAffected[0] === 0) throw new Error('Rol no encontrado');

                const affectedResult = await new sql.Request(transaction)
                    .input('roleId', sql.Numeric(10, 0), roleId)
                    .query('SELECT id_usuario FROM rel_usuario_rol WHERE id_rol = @roleId');

                // Bump permisos_version for all users that have this role
                await new sql.Request(transaction)
                    .input('roleId', sql.Numeric(10, 0), roleId)
                    .query(`
                        UPDATE mae_usuario
                        SET permisos_version = ISNULL(permisos_version, 0) + 1
                        WHERE id_usuario IN (SELECT id_usuario FROM rel_usuario_rol WHERE id_rol = @roleId)
                    `);

                await transaction.commit();
                const affectedIds = affectedResult.recordset.map(r => r.id_usuario);
                if (affectedIds.length > 0) invalidatePermVersionCache(...affectedIds);
                return { success: true };
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } catch (error) {
            logger.error('Error toggling role status:', error);
            throw error;
        }
    }

    async updateRole(roleId, nombre, descripcion) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('roleId', sql.Numeric(10, 0), roleId)
                .input('nombre', sql.VarChar(100), nombre)
                .input('descripcion', sql.VarChar(255), descripcion || null)
                .query(`
                    UPDATE mae_rol
                    SET nombre_rol = @nombre, descripcion = @descripcion
                    WHERE id_rol = @roleId
                `);
            if (result.rowsAffected[0] === 0) throw new Error('Rol no encontrado');
            return { success: true };
        } catch (error) {
            logger.error('Error updating role:', error);
            throw error;
        }
    }

    // === Role-Permission Assignment ===
    async getRolePermissions(roleId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('roleId', sql.Numeric, roleId)
                .query(`
                    SELECT p.* 
                    FROM mae_permiso p
                    INNER JOIN rel_rol_permiso rp ON p.id_permiso = rp.id_permiso
                    WHERE rp.id_rol = @roleId AND p.habilitado = 1
                    ORDER BY p.orden ASC
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error getting role permissions:', error);
            throw error;
        }
    }

    async assignPermissionsToRole(roleId, permissionIds) {
        try {
            const pool = await getConnection();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                const affectedResult = await new sql.Request(transaction)
                    .input('roleId', sql.Numeric(10, 0), roleId)
                    .query('SELECT id_usuario FROM rel_usuario_rol WHERE id_rol = @roleId');

                // 1. Clear existing permissions for this role
                await new sql.Request(transaction)
                    .input('roleId', sql.Numeric, roleId)
                    .query('DELETE FROM rel_rol_permiso WHERE id_rol = @roleId');

                // 2. Insert new permissions
                for (const permId of permissionIds) {
                    await new sql.Request(transaction)
                        .input('roleId', sql.Numeric, roleId)
                        .input('permId', sql.Numeric, permId)
                        .query('INSERT INTO rel_rol_permiso (id_rol, id_permiso) VALUES (@roleId, @permId)');
                }

                // 3. Bump permisos_version for all users that have this role (invalidates their JWTs)
                await new sql.Request(transaction)
                    .input('roleId', sql.Numeric(10, 0), roleId)
                    .query(`
                        UPDATE mae_usuario
                        SET permisos_version = ISNULL(permisos_version, 0) + 1
                        WHERE id_usuario IN (SELECT id_usuario FROM rel_usuario_rol WHERE id_rol = @roleId)
                    `);

                await transaction.commit();
                const affectedIds = affectedResult.recordset.map(r => r.id_usuario);
                if (affectedIds.length > 0) invalidatePermVersionCache(...affectedIds);
                return true;
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } catch (error) {
            logger.error('Error assigning permissions:', error);
            throw error;
        }
    }

    // === User-Role Management ===
    async getAllUsers() {
        try {
            const pool = await getConnection();
            const result = await pool.request().query(`
                SELECT id_usuario, nombre_usuario, usuario as nombre_real, correo_electronico 
                FROM mae_usuario 
                WHERE habilitado = 'S'
                ORDER BY nombre_usuario
            `);
            return result.recordset;
        } catch (error) {
            logger.error('Error getting all users:', error);
            throw error;
        }
    }

    async getUserRoles(userId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('userId', sql.Numeric, userId)
                .query(`
                    SELECT r.* 
                    FROM mae_rol r
                    INNER JOIN rel_usuario_rol ur ON r.id_rol = ur.id_rol
                    WHERE ur.id_usuario = @userId
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error getting user roles:', error);
            throw error;
        }
    }

    async assignRolesToUser(userId, roleIds) {
        try {
            const pool = await getConnection();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                // 1. Clear existing roles
                await new sql.Request(transaction)
                    .input('userId', sql.Numeric, userId)
                    .query('DELETE FROM rel_usuario_rol WHERE id_usuario = @userId');

                // 2. Insert new roles
                for (const roleId of roleIds) {
                    await new sql.Request(transaction)
                        .input('userId', sql.Numeric, userId)
                        .input('roleId', sql.Numeric, roleId)
                        .query('INSERT INTO rel_usuario_rol (id_usuario, id_rol) VALUES (@userId, @roleId)');
                }

                // 3. Bump permisos_version for this user (invalidates their active JWT)
                await new sql.Request(transaction)
                    .input('userId', sql.Numeric(10, 0), userId)
                    .query('UPDATE mae_usuario SET permisos_version = ISNULL(permisos_version, 0) + 1 WHERE id_usuario = @userId');

                await transaction.commit();
                invalidatePermVersionCache(userId);
                return true;
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } catch (error) {
            logger.error('Error assigning roles to user:', error);
            throw error;
        }
    }

    async getUsersByRole(roleId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('roleId', sql.Numeric(10, 0), roleId)
                .query(`
                    SELECT u.id_usuario, u.nombre_usuario, u.usuario as nombre_real, u.correo_electronico
                    FROM rel_usuario_rol rel
                    JOIN mae_usuario u ON rel.id_usuario = u.id_usuario
                    WHERE rel.id_rol = @roleId AND u.habilitado = 'S'
                    ORDER BY u.nombre_usuario
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error getting users by role:', error);
            throw error;
        }
    }

    async getUserById(userId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .query(`
                    SELECT u.id_usuario, u.nombre_usuario, u.usuario as nombre_real,
                           u.correo_electronico, u.id_cargo, u.habilitado, c.nombre_cargo
                    FROM mae_usuario u
                    LEFT JOIN mae_cargo c ON u.id_cargo = c.id_cargo
                    WHERE u.id_usuario = @userId
                `);
            return result.recordset[0] || null;
        } catch (error) {
            logger.error('Error getting user by id:', error);
            throw error;
        }
    }

    // === User CRUD ===
    async getAllUsersWithStatus() {
        try {
            const pool = await getConnection();
            const result = await pool.request().query(`
                SELECT
                    u.id_usuario,
                    u.nombre_usuario,
                    u.usuario as nombre_real,
                    u.correo_electronico,
                    u.id_cargo,
                    c.nombre_cargo,
                    u.habilitado,
                    STRING_AGG(r.nombre_rol, ',') WITHIN GROUP (ORDER BY r.nombre_rol) as roles_list,
                    (
                        SELECT TOP 1 CONVERT(VARCHAR(19), al.fecha_registro, 120)
                        FROM App_Audit_Log al
                        WHERE al.usuario_id = u.id_usuario AND al.evento_tipo = 'LOGIN_SUCCESS'
                        ORDER BY al.fecha_registro DESC
                    ) AS ultimo_acceso
                FROM mae_usuario u
                LEFT JOIN mae_cargo c ON u.id_cargo = c.id_cargo
                LEFT JOIN rel_usuario_rol ur ON ur.id_usuario = u.id_usuario
                LEFT JOIN mae_rol r ON r.id_rol = ur.id_rol
                GROUP BY u.id_usuario, u.nombre_usuario, u.usuario, u.correo_electronico, u.id_cargo, c.nombre_cargo, u.habilitado
                ORDER BY u.nombre_usuario
            `);

            const users = result.recordset.map(user => ({
                ...user,
                roles: user.roles_list ? user.roles_list.split(',') : []
            }));

            return users;
        } catch (error) {
            logger.error('Error getting all users with status:', error);
            throw error;
        }
    }

    async createUser(userData) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            // Check for duplicate username
            const dupCheck = await new sql.Request(transaction)
                .input('nombreUsuario', sql.VarChar(50), userData.nombre_usuario)
                .query('SELECT id_usuario FROM mae_usuario WHERE nombre_usuario = @nombreUsuario');
            if (dupCheck.recordset.length > 0) {
                await transaction.rollback();
                const err = new Error('El nombre de usuario ya existe');
                err.code = 'DUPLICATE_USERNAME';
                throw err;
            }

            // Check for duplicate email (only if email is provided)
            if (userData.correo_electronico) {
                const emailCheck = await new sql.Request(transaction)
                    .input('correo', sql.VarChar(100), userData.correo_electronico)
                    .query('SELECT id_usuario FROM mae_usuario WHERE correo_electronico = @correo');
                if (emailCheck.recordset.length > 0) {
                    await transaction.rollback();
                    const err = new Error('El correo electrónico ya está en uso');
                    err.code = 'DUPLICATE_EMAIL';
                    throw err;
                }
            }

            // Serializable MAX+1 within the same transaction prevents race condition
            const idResult = await new sql.Request(transaction)
                .query('SELECT ISNULL(MAX(id_usuario), 0) + 1 AS newId FROM mae_usuario WITH (UPDLOCK, HOLDLOCK)');
            const newId = idResult.recordset[0].newId;

            const result = await new sql.Request(transaction)
                .input('id', sql.Numeric(10, 0), newId)
                .input('nombreUsuario', sql.VarChar(50), userData.nombre_usuario)
                .input('nombreReal', sql.VarChar(100), userData.nombre_real)
                .input('correo', sql.VarChar(100), userData.correo_electronico || null)
                .input('clave', sql.VarChar(50), userData.clave_usuario)
                .input('idCargo', sql.Numeric(10, 0), userData.id_cargo || null)
                .input('habilitado', sql.Char(1), 'S')
                .query(`
                    INSERT INTO mae_usuario (id_usuario, nombre_usuario, usuario, correo_electronico, clave_usuario, id_cargo, habilitado)
                    OUTPUT INSERTED.id_usuario, INSERTED.nombre_usuario, INSERTED.usuario,
                           INSERTED.correo_electronico, INSERTED.id_cargo, INSERTED.habilitado
                    VALUES (@id, @nombreUsuario, @nombreReal, @correo, @clave, @idCargo, @habilitado)
                `);
            await transaction.commit();
            return result.recordset[0];
        } catch (error) {
            try { await transaction.rollback(); } catch (_) {}
            logger.error('Error creating user:', error);
            throw error;
        }
    }

    async updateUser(userId, userData) {
        try {
            const pool = await getConnection();

            // Check username uniqueness (excluding self)
            const userCheck = await pool.request()
                .input('nombre', sql.VarChar(50), userData.nombre_usuario)
                .input('userId', sql.Numeric(10, 0), userId)
                .query('SELECT id_usuario FROM mae_usuario WHERE nombre_usuario = @nombre AND id_usuario != @userId');
            if (userCheck.recordset.length > 0) {
                const err = new Error('El nombre de usuario ya está en uso');
                err.code = 'DUPLICATE_USERNAME';
                throw err;
            }

            // Check email uniqueness (excluding self)
            if (userData.correo_electronico) {
                const emailCheck = await pool.request()
                    .input('correo', sql.VarChar(100), userData.correo_electronico)
                    .input('userId', sql.Numeric(10, 0), userId)
                    .query('SELECT id_usuario FROM mae_usuario WHERE correo_electronico = @correo AND id_usuario != @userId');
                if (emailCheck.recordset.length > 0) {
                    const err = new Error('El correo electrónico ya está en uso');
                    err.code = 'DUPLICATE_EMAIL';
                    throw err;
                }
            }

            const result = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('nombreUsuario', sql.VarChar(50), userData.nombre_usuario)
                .input('nombreReal', sql.VarChar(100), userData.nombre_real)
                .input('correo', sql.VarChar(100), userData.correo_electronico || null)
                .input('idCargo', sql.Numeric(10, 0), userData.id_cargo || null)
                .query(`
                    UPDATE mae_usuario
                    SET nombre_usuario = @nombreUsuario,
                        usuario = @nombreReal,
                        correo_electronico = @correo,
                        id_cargo = @idCargo
                    WHERE id_usuario = @userId
                `);

            if (result.rowsAffected[0] === 0) throw new Error('Usuario no encontrado');
            return { success: true };
        } catch (error) {
            logger.error('Error updating user:', error);
            throw error;
        }
    }

    async updateUserPassword(userId, newPassword) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('newPassword', sql.VarChar(50), newPassword)
                .query(`
                    UPDATE mae_usuario
                    SET clave_usuario = @newPassword
                    WHERE id_usuario = @userId
                `);

            if (result.rowsAffected[0] === 0) {
                throw new Error('Usuario no encontrado');
            }

            return { success: true };
        } catch (error) {
            logger.error('Error updating user password:', error);
            throw error;
        }
    }

    async updateUserProfilePicture(userId, photoPath) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('photoPath', sql.VarChar(200), photoPath)
                .query(`
                    UPDATE mae_usuario 
                    SET foto = @photoPath
                    WHERE id_usuario = @userId
                `);

            if (result.rowsAffected[0] === 0) {
                throw new Error('Usuario no encontrado');
            }

            return { success: true, foto: photoPath };
        } catch (error) {
            logger.error('Error updating profile picture:', error);
            throw error;
        }
    }

    async toggleUserStatus(userId, newStatus) {
        try {
            const pool = await getConnection();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                const result = await new sql.Request(transaction)
                    .input('userId', sql.Numeric(10, 0), userId)
                    .input('habilitado', sql.Char(1), newStatus ? 'S' : 'N')
                    .query(`
                        UPDATE mae_usuario
                        SET habilitado = @habilitado
                        WHERE id_usuario = @userId
                    `);

                if (result.rowsAffected[0] === 0) throw new Error('Usuario no encontrado');

                // On disable: bump permisos_version to immediately invalidate the user's JWT
                if (!newStatus) {
                    await new sql.Request(transaction)
                        .input('userId', sql.Numeric(10, 0), userId)
                        .query('UPDATE mae_usuario SET permisos_version = ISNULL(permisos_version, 0) + 1 WHERE id_usuario = @userId');
                }

                await transaction.commit();
                if (!newStatus) invalidatePermVersionCache(userId);
                return { success: true };
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } catch (error) {
            logger.error('Error toggling user status:', error);
            throw error;
        }
    }
}

export default new RbacService();
