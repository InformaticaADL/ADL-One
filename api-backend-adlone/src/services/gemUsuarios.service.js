import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';

const ROL_GEM = 20;
// La columna `area` de rel_usuario_empresa_asignada tiene un CHECK constraint
// (CK_ruea_area) que sólo acepta 'MAM' — comprobado empíricamente contra la
// BD, ya que el usuario de aplicación no tiene permiso para leer la
// definición del constraint. No usar 'GEM' aquí aunque el rol se llame así.
const AREA = 'MAM';

class GemUsuariosService {
    async isGemUser(userId) {
        const pool = await getConnection();
        const result = await pool.request()
            .input('userId', sql.Numeric(10, 0), userId)
            .input('rolGem', sql.Numeric(10, 0), ROL_GEM)
            .query('SELECT 1 FROM rel_usuario_rol WHERE id_usuario = @userId AND id_rol = @rolGem');
        return result.recordset.length > 0;
    }

    async getGemUsuarios() {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('rolGem', sql.Numeric(10, 0), ROL_GEM)
                .query(`
                    SELECT
                        u.id_usuario,
                        u.nombre_usuario,
                        u.usuario as nombre_real,
                        u.correo_electronico,
                        u.id_cargo,
                        c.nombre_cargo,
                        u.habilitado,
                        (
                            SELECT TOP 1 CONVERT(VARCHAR(19), al.fecha_registro, 120)
                            FROM App_Audit_Log al
                            WHERE al.usuario_id = u.id_usuario AND al.evento_tipo = 'LOGIN_SUCCESS'
                            ORDER BY al.fecha_registro DESC
                        ) AS ultimo_acceso
                    FROM mae_usuario u
                    LEFT JOIN mae_cargo c ON u.id_cargo = c.id_cargo
                    WHERE EXISTS (
                        SELECT 1 FROM rel_usuario_rol x WHERE x.id_usuario = u.id_usuario AND x.id_rol = @rolGem
                    )
                    ORDER BY u.nombre_usuario
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error getting GEM users:', error);
            throw error;
        }
    }

    async getEmpresasAsignadas(userId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('area', sql.VarChar(10), AREA)
                .query(`
                    SELECT rel.id_empresa, e.nombre_empresa
                    FROM rel_usuario_empresa_asignada rel
                    JOIN mae_empresa e ON e.id_empresa = rel.id_empresa
                    WHERE rel.id_usuario = @userId AND rel.area = @area
                    ORDER BY e.nombre_empresa
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error getting empresas asignadas:', error);
            throw error;
        }
    }

    async setEmpresasAsignadas(userId, empresaIds, asignadoPorUserId) {
        try {
            const pool = await getConnection();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                await new sql.Request(transaction)
                    .input('userId', sql.Numeric(10, 0), userId)
                    .input('area', sql.VarChar(10), AREA)
                    .query('DELETE FROM rel_usuario_empresa_asignada WHERE id_usuario = @userId AND area = @area');

                for (const idEmpresa of empresaIds) {
                    await new sql.Request(transaction)
                        .input('userId', sql.Numeric(10, 0), userId)
                        .input('idEmpresa', sql.Int, idEmpresa)
                        .input('area', sql.VarChar(10), AREA)
                        .input('asignadoPor', sql.Numeric(10, 0), asignadoPorUserId)
                        .query(`
                            INSERT INTO rel_usuario_empresa_asignada (id_usuario, id_empresa, area, asignado_en, asignado_por)
                            VALUES (@userId, @idEmpresa, @area, GETDATE(), @asignadoPor)
                        `);
                }

                await transaction.commit();
                return { success: true };
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } catch (error) {
            logger.error('Error setting empresas asignadas:', error);
            throw error;
        }
    }
}

export default new GemUsuariosService();
export { ROL_GEM };
