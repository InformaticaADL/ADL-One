import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from './logger.js';

// RB-04 / RB-07: cache muy corto para que el admin tool sea reactivo (max 5s delay).
const cache = new Map();
const CACHE_TTL = 5_000; // 5 segundos

export async function getUserAuthState(userId) {
    const cached = cache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.state;
    }
    const pool = await getConnection();
    const result = await pool.request()
        .input('userId', sql.Numeric(10, 0), userId)
        .query('SELECT permisos_version, habilitado FROM mae_usuario WHERE id_usuario = @userId');
    const state = result.recordset[0] || null;
    cache.set(userId, { state, fetchedAt: Date.now() });
    return state;
}

// Backwards compat
export async function getPermVersion(userId) {
    const state = await getUserAuthState(userId);
    return state?.permisos_version ?? 0;
}

export function invalidatePermVersionCache(...userIds) {
    for (const id of userIds) {
        cache.delete(id);
        logger.debug(`permVersionCache: invalidated userId=${id}`);
    }
}
