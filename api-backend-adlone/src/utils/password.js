import bcrypt from 'bcryptjs';

// Costo de bcrypt. 10 es un buen balance seguridad/latencia para login interactivo.
const SALT_ROUNDS = 12;

// Un hash bcrypt siempre empieza con $2a$ / $2b$ / $2y$ y mide 60 caracteres.
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$.{53}$/;

/**
 * ¿El valor almacenado ya es un hash bcrypt (vs. una clave legacy en texto plano)?
 */
export function isBcryptHash(stored) {
    return typeof stored === 'string' && BCRYPT_RE.test(stored);
}

/**
 * Genera el hash bcrypt de una contraseña en texto plano.
 */
export function hashPassword(plain) {
    return bcrypt.hash(String(plain ?? ''), SALT_ROUNDS);
}

/**
 * Verifica una contraseña contra el valor almacenado.
 *
 * Soporta migración transparente: si lo almacenado es un hash bcrypt usa
 * bcrypt.compare; si todavía es texto plano (legacy) compara directo,
 * case-sensitive, e indica con needsRehash que hay que migrarlo.
 *
 * @returns {Promise<{ match: boolean, needsRehash: boolean }>}
 */
export async function verifyPassword(plain, stored) {
    const candidate = String(plain ?? '');
    if (isBcryptHash(stored)) {
        const match = await bcrypt.compare(candidate, stored);
        return { match, needsRehash: false };
    }
    // Legacy: clave en texto plano. Coincidencia exacta (incl. mayúsculas).
    const match = String(stored ?? '') === candidate;
    return { match, needsRehash: match };
}
