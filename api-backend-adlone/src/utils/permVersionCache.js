import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from './logger.js';

const cache = new Map();
const CACHE_TTL = 120_000; // 2 minutes

export async function getPermVersion(userId) {
    const cached = cache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.version;
    }
    const pool = await getConnection();
    const result = await pool.request()
        .input('userId', sql.Numeric(10, 0), userId)
        .query('SELECT permisos_version FROM mae_usuario WHERE id_usuario = @userId');
    const version = result.recordset[0]?.permisos_version ?? 0;
    cache.set(userId, { version, fetchedAt: Date.now() });
    return version;
}

export function invalidatePermVersionCache(...userIds) {
    for (const id of userIds) {
        cache.delete(id);
        logger.debug(`permVersionCache: invalidated userId=${id}`);
    }
}
