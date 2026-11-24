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
    _cacheVisibles = new Map();
    _webCaidaHasta = 0; // mientras dure, no se intenta llamar a ADL WEB GO (acaba de fallar)

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

    /**
     * Empresas del laboratorio que puede ver un usuario GEM (p. ej. en Muestreos Ejecutados).
     * La fuente es ADL WEB GO (Administración → Resp. solicitudes): se le pregunta por su API.
     * Si la web no responde o aún no autoriza esta llave, se usa la asignación antigua de ADL ONE.
     * Devuelve { restringido: boolean, ids: number[] }. Sin restricción = ve todas las empresas.
     */
    async getEmpresasVisibles(userId) {
        // Caché corta: un aviso a todo el rol GEM pregunta por cada persona y la respuesta casi no cambia (se administra en ADL WEB GO).
        const ahora = Date.now();
        const guardado = this._cacheVisibles.get(Number(userId));
        if (guardado && ahora - guardado.en < guardado.ttl) return guardado.valor;
        const valor = await this._leerEmpresasVisibles(userId);
        // Si ADL WEB GO no respondió y se usó la asignación antigua, se recuerda solo 1 minuto: así un corte de la web no hace esperar su tiempo de espera por cada persona.
        this._cacheVisibles.set(Number(userId), { en: ahora, ttl: valor.fuente === 'web' ? 5 * 60 * 1000 : 60 * 1000, valor });
        return valor;
    }

    async _leerEmpresasVisibles(userId) {
        try {
            const pool = await getConnection();
            const r = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .query('SELECT correo_electronico FROM mae_usuario WHERE id_usuario = @userId');
            const email = (r.recordset[0]?.correo_electronico || '').trim().toLowerCase();
            if (email && process.env.WEBCLIENTES_API_URL && process.env.WEBCLIENTES_API_KEY && Date.now() >= this._webCaidaHasta) {
                const resp = await fetch(
                    `${process.env.WEBCLIENTES_API_URL}/api/v1/equipo/empresas-visibles?email=${encodeURIComponent(email)}`,
                    { headers: { Authorization: `Bearer ${process.env.WEBCLIENTES_API_KEY}` }, signal: AbortSignal.timeout(8000) });
                if (resp.ok) {
                    const data = await resp.json();
                    return data.restringido
                        ? { restringido: true, ids: (data.ids_empresa || []).map(Number).filter(Boolean), fuente: 'web' }
                        : { restringido: false, ids: [], fuente: 'web' };
                }
                this._webCaidaHasta = Date.now() + 60 * 1000;
                logger.warn(`ADL WEB GO respondió ${resp.status} al pedir las empresas visibles; se usa la asignación antigua (se reintenta en 1 minuto).`);
            }
        } catch (error) {
            this._webCaidaHasta = Date.now() + 60 * 1000;
            logger.warn(`No se pudo consultar ADL WEB GO (${error.message}); se usa la asignación antigua (se reintenta en 1 minuto).`);
        }
        const antiguas = await this.getEmpresasAsignadas(userId);
        const ids = antiguas.map(e => Number(e.id_empresa)).filter(Boolean);
        return { restringido: ids.length > 0, ids, fuente: 'antigua' };
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

}

export default new GemUsuariosService();
export { ROL_GEM };
