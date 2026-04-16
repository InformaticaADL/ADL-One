import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';

class MenuService {
    async getDynamicMenu(userPermissions) {
        try {
            const pool = await getConnection();

            // Permissions come in as an array of strings, e.g., ['MA_ACCESO', 'NEC_ACCESO']
            // For Super Admin handling: AI_MA_ADMIN_ACCESO gives access to everything
            const isSuperAdmin = userPermissions.includes('AI_MA_ADMIN_ACCESO');

            // 1. Fetch Modules
            const modulesResult = await pool.request().query(`
                SELECT id_modulo, label, icon_name, grupo, permissions_str, sort_order
                FROM mae_menu_modulo
                WHERE activo = 1
                ORDER BY sort_order ASC
            `);

            // 2. Fetch Links
            const linksResult = await pool.request().query(`
                SELECT id_link, id_modulo, id_accion, label, permissions_str, sort_order
                FROM mae_menu_link
                WHERE activo = 1
                ORDER BY sort_order ASC
            `);

            // 3. Process Modules
            const modules = [];

            for (const mod of modulesResult.recordset) {
                // Check module permission
                let hasModuleAccess = isSuperAdmin;
                if (!hasModuleAccess && mod.permissions_str) {
                    const requiredPerms = mod.permissions_str.split(',').map(p => p.trim());
                    hasModuleAccess = requiredPerms.some(p => userPermissions.includes(p));
                }

                if (hasModuleAccess || !mod.permissions_str) {
                    // Assemble links for this module
                    const moduleLinks = linksResult.recordset.filter(l => l.id_modulo === mod.id_modulo);
                    const processedLinks = [];

                    for (const link of moduleLinks) {
                        let hasLinkAccess = isSuperAdmin;
                        if (!hasLinkAccess && link.permissions_str) {
                            const reqLinkPerms = link.permissions_str.split(',').map(p => p.trim());
                            hasLinkAccess = reqLinkPerms.some(p => userPermissions.includes(p));
                        }
                        
                        if (hasLinkAccess || !link.permissions_str) {
                            processedLinks.push({
                                id: link.id_accion,
                                label: link.label,
                                // Enviar permisos al frontend por consistencia
                                permission: link.permissions_str ? link.permissions_str.split(',').map(p => p.trim()) : undefined
                            });
                        }
                    }

                    // Only push module if it has no children logic, or if children exist it gets pushed
                    modules.push({
                        id: mod.id_modulo,
                        label: mod.label,
                        icon: mod.icon_name,
                        group: mod.grupo,
                        permission: mod.permissions_str ? mod.permissions_str.split(',').map(p => p.trim()) : undefined,
                        links: processedLinks.length > 0 ? processedLinks : undefined
                    });
                }
            }

            return modules;
        } catch (error) {
            logger.error('Error fetching dynamic menu:', error);
            throw error;
        }
    }

    // --- ADMIN CRUD METHODS ---

    async getAllAdminData() {
        try {
            const pool = await getConnection();
            const modulos = await pool.request().query(`
                SELECT * FROM mae_menu_modulo ORDER BY sort_order ASC
            `);
            const links = await pool.request().query(`
                SELECT * FROM mae_menu_link ORDER BY sort_order ASC
            `);
            return {
                modulos: modulos.recordset,
                links: links.recordset
            };
        } catch (error) {
            logger.error('Error fetching admin menu data:', error);
            throw error;
        }
    }

    async createModulo(data) {
        try {
            const pool = await getConnection();
            const { id_modulo, label, icon_name, grupo, permissions_str, sort_order } = data;
            
            // Check if exists
            const check = await pool.request().input('id', sql.NVarChar, id_modulo).query('SELECT id_modulo FROM mae_menu_modulo WHERE id_modulo = @id');
            if (check.recordset.length > 0) throw new Error('El ID de módulo ya existe.');

            await pool.request()
                .input('id', sql.NVarChar(50), id_modulo)
                .input('lbl', sql.NVarChar(100), label)
                .input('icn', sql.NVarChar(50), icon_name)
                .input('grp', sql.NVarChar(20), grupo || 'unidades')
                .input('perm', sql.NVarChar(500), permissions_str || null)
                .input('srt', sql.Int, sort_order || 0)
                .query(`
                    INSERT INTO mae_menu_modulo (id_modulo, label, icon_name, grupo, permissions_str, sort_order, activo)
                    VALUES (@id, @lbl, @icn, @grp, @perm, @srt, 1)
                `);
            return { success: true };
        } catch (error) {
            logger.error('Error creating modulo:', error);
            throw error;
        }
    }

    async updateModulo(id_modulo, data) {
        try {
            const pool = await getConnection();
            const { label, icon_name, grupo, permissions_str, sort_order, activo } = data;
            await pool.request()
                .input('id', sql.NVarChar(50), id_modulo)
                .input('lbl', sql.NVarChar(100), label)
                .input('icn', sql.NVarChar(50), icon_name)
                .input('grp', sql.NVarChar(20), grupo)
                .input('perm', sql.NVarChar(500), permissions_str || null)
                .input('srt', sql.Int, sort_order)
                .input('act', sql.Bit, activo ? 1 : 0)
                .query(`
                    UPDATE mae_menu_modulo 
                    SET label=@lbl, icon_name=@icn, grupo=@grp, permissions_str=@perm, sort_order=@srt, activo=@act
                    WHERE id_modulo = @id
                `);
            return { success: true };
        } catch (error) {
            logger.error('Error updating modulo:', error);
            throw error;
        }
    }

    async deleteModulo(id_modulo) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('id', sql.NVarChar(50), id_modulo)
                .query('UPDATE mae_menu_modulo SET activo = 0 WHERE id_modulo = @id');
            return { success: true };
        } catch (error) {
            logger.error('Error deleting modulo:', error);
            throw error;
        }
    }

    async createLink(data) {
        try {
            const pool = await getConnection();
            const { id_modulo, id_accion, label, permissions_str, sort_order } = data;
            
            await pool.request()
                .input('mid', sql.NVarChar(50), id_modulo)
                .input('aid', sql.NVarChar(100), id_accion)
                .input('lbl', sql.NVarChar(100), label)
                .input('perm', sql.NVarChar(500), permissions_str || null)
                .input('srt', sql.Int, sort_order || 0)
                .query(`
                    INSERT INTO mae_menu_link (id_modulo, id_accion, label, permissions_str, sort_order, activo)
                    VALUES (@mid, @aid, @lbl, @perm, @srt, 1)
                `);
            return { success: true };
        } catch (error) {
            logger.error('Error creating link:', error);
            throw error;
        }
    }

    async updateLink(id_link, data) {
        try {
            const pool = await getConnection();
            const { id_modulo, id_accion, label, permissions_str, sort_order, activo } = data;
            await pool.request()
                .input('id', sql.Int, id_link)
                .input('mid', sql.NVarChar(50), id_modulo)
                .input('aid', sql.NVarChar(100), id_accion)
                .input('lbl', sql.NVarChar(100), label)
                .input('perm', sql.NVarChar(500), permissions_str || null)
                .input('srt', sql.Int, sort_order)
                .input('act', sql.Bit, activo ? 1 : 0)
                .query(`
                    UPDATE mae_menu_link 
                    SET id_modulo=@mid, id_accion=@aid, label=@lbl, permissions_str=@perm, sort_order=@srt, activo=@act
                    WHERE id_link = @id
                `);
            return { success: true };
        } catch (error) {
            logger.error('Error updating link:', error);
            throw error;
        }
    }

    async deleteLink(id_link) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('id', sql.Int, id_link)
                .query('UPDATE mae_menu_link SET activo = 0 WHERE id_link = @id');
            return { success: true };
        } catch (error) {
            logger.error('Error deleting link:', error);
            throw error;
        }
    }
}

export default new MenuService();
