import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';

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

            // Get all permissions
            const permissionsResult = await pool.request().query('SELECT * FROM mae_permiso');

            // Get grouped by module/submodule if needed, or just return flat list
            return permissionsResult.recordset;
        } catch (error) {
            logger.error('Error getting permissions:', error);
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
                    WHERE rp.id_rol = @roleId
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
                const request = new sql.Request(transaction);

                // 1. Clear existing permissions for this role
                await request.input('roleId', sql.Numeric, roleId)
                    .query('DELETE FROM rel_rol_permiso WHERE id_rol = @roleId');

                // 2. Insert new permissions
                // Note: Bulk insert or loop. Loop is simpler for small sets.
                for (const permId of permissionIds) {
                    const insertReq = new sql.Request(transaction);
                    await insertReq
                        .input('roleId', sql.Numeric, roleId)
                        .input('permId', sql.Numeric, permId)
                        .query('INSERT INTO rel_rol_permiso (id_rol, id_permiso) VALUES (@roleId, @permId)');
                }

                await transaction.commit();
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
                const request = new sql.Request(transaction);

                // 1. Clear existing roles
                await request.input('userId', sql.Numeric, userId)
                    .query('DELETE FROM rel_usuario_rol WHERE id_usuario = @userId');

                // 2. Insert new roles
                for (const roleId of roleIds) {
                    const insertReq = new sql.Request(transaction);
                    await insertReq
                        .input('userId', sql.Numeric, userId)
                        .input('roleId', sql.Numeric, roleId)
                        .query('INSERT INTO rel_usuario_rol (id_usuario, id_rol) VALUES (@userId, @roleId)');
                }

                await transaction.commit();
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

    // === User CRUD ===
    async getAllUsersWithStatus() {
        try {
            const pool = await getConnection();
            const result = await pool.request().query(`
                SELECT id_usuario, nombre_usuario, usuario as nombre_real, 
                       correo_electronico, mam_cargo, habilitado
                FROM mae_usuario 
                ORDER BY nombre_usuario
            `);
            return result.recordset;
        } catch (error) {
            logger.error('Error getting all users with status:', error);
            throw error;
        }
    }

    async createUser(userData) {
        try {
            const pool = await getConnection();

            // Generate ID manually (legacy table without IDENTITY)
            const idResult = await pool.request()
                .query('SELECT ISNULL(MAX(id_usuario), 0) + 1 AS newId FROM mae_usuario');
            const newId = idResult.recordset[0].newId;

            const result = await pool.request()
                .input('id', sql.Numeric(10, 0), newId)
                .input('nombreUsuario', sql.VarChar(50), userData.nombre_usuario)
                .input('nombreReal', sql.VarChar(100), userData.nombre_real)
                .input('correo', sql.VarChar(100), userData.correo_electronico)
                .input('clave', sql.VarChar(50), userData.clave_usuario)
                .input('habilitado', sql.Char(1), 'S')
                .query(`
                    INSERT INTO mae_usuario (id_usuario, nombre_usuario, usuario, correo_electronico, clave_usuario, habilitado)
                    OUTPUT INSERTED.id_usuario, INSERTED.nombre_usuario, INSERTED.usuario, 
                           INSERTED.correo_electronico, INSERTED.habilitado
                    VALUES (@id, @nombreUsuario, @nombreReal, @correo, @clave, @habilitado)
                `);
            return result.recordset[0];
        } catch (error) {
            logger.error('Error creating user:', error);
            throw error;
        }
    }

    async updateUser(userId, userData) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('nombreUsuario', sql.VarChar(50), userData.nombre_usuario)
                .input('nombreReal', sql.VarChar(100), userData.nombre_real)
                .input('correo', sql.VarChar(100), userData.correo_electronico)
                .query(`
                    UPDATE mae_usuario 
                    SET nombre_usuario = @nombreUsuario,
                        usuario = @nombreReal,
                        correo_electronico = @correo
                    WHERE id_usuario = @userId
                `);

            if (result.rowsAffected[0] === 0) {
                throw new Error('Usuario no encontrado');
            }

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

    async toggleUserStatus(userId, newStatus) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('habilitado', sql.Char(1), newStatus ? 'S' : 'N')
                .query(`
                    UPDATE mae_usuario 
                    SET habilitado = @habilitado
                    WHERE id_usuario = @userId
                `);

            if (result.rowsAffected[0] === 0) {
                throw new Error('Usuario no encontrado');
            }

            return { success: true };
        } catch (error) {
            logger.error('Error toggling user status:', error);
            throw error;
        }
    }
}

export default new RbacService();
