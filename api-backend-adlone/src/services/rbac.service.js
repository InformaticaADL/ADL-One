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
            const result = await pool.request().query('SELECT id_usuario, nombre_usuario, usuario as nombre_real FROM mae_usuario');
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
}

export default new RbacService();
