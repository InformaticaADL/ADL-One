/**
 * Resolves a Google Maps link (short or long URL, or raw "lat,lon") to { lat, lon }.
 * Returns null if no reliable coordinate can be extracted.
 *
 * Pattern priority: !3d!4d (exact place) > q= / search/ etc. > @ (viewport center, last resort)
 * NO body-HTML parsing — the page contains dozens of nearby-place coordinates that
 * would produce catastrophically wrong results.
 */

const PATRONES_COORDS = [
    /!3d(-?\d+(?:\.\d+)?)[\s+]*!4d(-?\d+(?:\.\d+)?)/,       // exact place — highest priority
    /[?&]q=(-?\d+(?:\.\d+)?),[\s+]*(-?\d+(?:\.\d+)?)/,
    /[?&]daddr=(-?\d+(?:\.\d+)?),[\s+]*(-?\d+(?:\.\d+)?)/,
    /[?&]ll=(-?\d+(?:\.\d+)?),[\s+]*(-?\d+(?:\.\d+)?)/,
    /place\/(-?\d+(?:\.\d+)?),[\s+]*(-?\d+(?:\.\d+)?)/,
    /search\/(-?\d+(?:\.\d+)?),[\s+]*(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),[\s+]*(-?\d+(?:\.\d+)?)/,            // viewport center — low priority
    /^(-?\d+(?:\.\d+)?),[\s+]*(-?\d+(?:\.\d+)?)$/,           // bare "lat,lon" string
];

export function extraerCoordsDeUrl(texto) {
    if (!texto || typeof texto !== 'string') return null;
    const candidatos = [texto.trim()];
    try { candidatos.push(decodeURIComponent(texto.trim())); } catch (_) {}
    for (const candidato of candidatos) {
        for (const patron of PATRONES_COORDS) {
            const match = candidato.match(patron);
            if (match) {
                const lat = parseFloat(match[1]);
                const lon = parseFloat(match[2]);
                if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                    return { lat, lon };
                }
            }
        }
    }
    return null;
}

const linkCache = new Map();

export async function resolverGoogleMapsLink(link) {
    if (!link || typeof link !== 'string') return null;
    const limpio = link.trim();
    if (!limpio) return null;

    if (linkCache.has(limpio)) return linkCache.get(limpio);

    // 1) direct extraction (covers long URLs and bare "lat,lon" strings)
    const coordsDirectas = extraerCoordsDeUrl(limpio);
    if (coordsDirectas) {
        linkCache.set(limpio, coordsDirectas);
        return coordsDirectas;
    }

    // 2) follow HTTP redirects (handles short links like maps.app.goo.gl)
    if (/^https?:\/\//i.test(limpio)) {
        try {
            const response = await fetch(limpio, {
                method: 'GET',
                redirect: 'follow',
                signal: AbortSignal.timeout(10000),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/100.0 Mobile Safari/537.36',
                },
            });
            const finalUrl = response.url || limpio;
            const coords = extraerCoordsDeUrl(finalUrl);
            const result = coords ?? null;
            linkCache.set(limpio, result);
            return result;
        } catch (_) {
            // timeout or network error — fall through
        }
    }

    linkCache.set(limpio, null);
    return null;
}
