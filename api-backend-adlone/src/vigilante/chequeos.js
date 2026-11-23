// Comprobaciones del vigilante: ¿responde la dirección? ¿qué dice pm2? ¿hay una pausa manual?
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const CARPETA_LOGS = path.resolve(AQUI, '../../logs');
export const ARCHIVO_PAUSA = path.join(CARPETA_LOGS, 'vigilante.pausa');
export const ARCHIVO_ESTADO = path.join(CARPETA_LOGS, 'vigilante-estado.json');

/**
 * Pide la dirección y comprueba que responda de verdad (no basta con que el proceso esté «online»: el 2026-11-19 el frontend aceptaba
 * conexiones pero nunca contestaba). Si `debeContener` viene, el cuerpo tiene que traer ese texto (así se distingue la aplicación de una página de error).
 * @returns {Promise<{ok:boolean, motivo?:string}>}
 */
export async function probarHttp(url, { timeoutMs = 10000, debeContener = null } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(url, { signal: ctrl.signal, redirect: 'manual', headers: { 'Cache-Control': 'no-cache' } });
        if (r.status >= 400) { r.body?.cancel?.().catch(() => {}); return { ok: false, motivo: `respondió HTTP ${r.status}` }; }
        if (debeContener) {
            const cuerpo = (await r.text()).slice(0, 300000);
            if (!cuerpo.includes(debeContener)) return { ok: false, motivo: `respondió, pero no es la aplicación (no trae «${debeContener}»)` };
        } else {
            r.body?.cancel?.().catch(() => {});
        }
        return { ok: true };
    } catch (e) {
        if (e && e.name === 'AbortError') return { ok: false, motivo: `no respondió en ${Math.round(timeoutMs / 1000)} s` };
        return { ok: false, motivo: `no se pudo conectar (${(e && e.cause && e.cause.code) || (e && e.message) || 'error'})` };
    } finally {
        clearTimeout(t);
    }
}

/** Estado de todos los procesos de pm2: { 'adl-one-frontend': 'online', ... }. null si no se pudo consultar pm2. */
export function estadosPm2({ timeoutMs = 15000 } = {}) {
    return new Promise((resolve) => {
        const [cmd, args] = process.platform === 'win32' ? ['cmd.exe', ['/c', 'pm2', 'jlist']] : ['pm2', ['jlist']];
        execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
            if (err && !stdout) return resolve(null);
            try {
                const desde = String(stdout).indexOf('[');
                const lista = JSON.parse(String(stdout).slice(desde));
                resolve(Object.fromEntries(lista.map((p) => [p.name, p.pm2_env && p.pm2_env.status])));
            } catch { resolve(null); }
        });
    });
}

/** ¿Una parada a propósito? Solo «stopped» o «stopping». Un proceso que ya NO aparece en pm2 (p. ej. el servidor se reinició y nadie lo levantó) NO cuenta como parada: es una caída. */
export const estaDetenidoAPropósito = (estadoPm2) => estadoPm2 === 'stopped' || estadoPm2 === 'stopping';

/** Pausa manual de los avisos (para mantenciones largas): un archivo con la hora límite. */
export function pausaVigente(ruta = ARCHIVO_PAUSA, ahora = Date.now()) {
    try {
        const j = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        const hasta = Date.parse(j.hasta);
        return Number.isFinite(hasta) && hasta > ahora ? { hasta, motivo: j.motivo || '' } : null;
    } catch { return null; }
}
