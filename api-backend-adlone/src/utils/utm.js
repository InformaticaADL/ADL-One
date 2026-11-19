/**
 * Coordenadas UTM → latitud/longitud y enlace de Google Maps, sin servicios externos.
 *
 * Supuestos (los de ADL): datum WGS84/SIRGAS (la diferencia entre ambos es menor a 1 m) y hemisferio SUR, porque todo el territorio de trabajo
 * es chileno. Solo se usa el hemisferio norte si la zona trae una letra de banda del norte (N, P, Q, R, T, U, V, W, X). Las coordenadas con
 * otro datum (por ejemplo el antiguo PSAD56) darían un punto desplazado cientos de metros.
 */

const A = 6378137; // semieje mayor WGS84
const F = 1 / 298.257223563; // achatamiento
const K0 = 0.9996; // factor de escala de la proyección UTM
const BANDAS_NORTE = 'NPQRTUVWX';

/** «5.435.661», «5426758,7», «665482» o un número → número (o null si no se puede leer). */
export function parseNumeroUtm(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
    let s = String(valor).trim().replace(/\s+/g, '');
    if (!s) return null;
    if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // «5.435.661,7»
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // «5.435.661» (puntos de miles)
    else s = s.replace(',', '.'); // «5426758,7»
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

/** «18G», «19» o «18 H» → { huso: 18, banda: 'G' }; null si no hay un huso válido (1 a 60). */
export function parseZona(zona) {
    const m = String(zona || '').trim().match(/^(\d{1,2})\s*([A-Za-z])?$/);
    if (!m) return null;
    const huso = parseInt(m[1], 10);
    if (huso < 1 || huso > 60) return null;
    return { huso, banda: (m[2] || '').toUpperCase() };
}

/** UTM → { lat, lon } en grados decimales (series de Krüger, error menor a 1 mm). Devuelve null si los datos no son creíbles. */
export function utmALatLon(zona, norte, este) {
    const z = parseZona(zona);
    const N = parseNumeroUtm(norte);
    const E = parseNumeroUtm(este);
    if (!z || N === null || E === null) return null;
    // Rangos creíbles: este entre 100 km y 900 km; norte hasta 10.000 km
    if (E < 100000 || E > 900000 || N <= 0 || N > 10000000) return null;
    const sur = !(z.banda && BANDAS_NORTE.includes(z.banda)); // sin letra = sur (la cadena vacía «está incluida» en cualquier texto: de ahí el chequeo)
    // En el hemisferio sur el norte se mide con falso origen de 10.000.000 m: un norte muy chico no corresponde a Chile
    if (sur && N < 1000000) return null;

    const n = F / (2 - F);
    const Ap = (A / (1 + n)) * (1 + (n * n) / 4 + n ** 4 / 64);
    const beta = [
        n / 2 - (2 * n * n) / 3 + (37 * n ** 3) / 96 - n ** 4 / 360,
        n * n / 48 + n ** 3 / 15 - (437 * n ** 4) / 1440,
        (17 * n ** 3) / 480 - (37 * n ** 4) / 840,
        (4397 * n ** 4) / 161280,
    ];
    const e2 = F * (2 - F);
    const Ey = E - 500000;
    const Ny = sur ? N - 10000000 : N;
    const xi = Ny / (K0 * Ap);
    const eta = Ey / (K0 * Ap);
    let xiP = xi;
    let etaP = eta;
    beta.forEach((bj, j) => {
        const m = 2 * (j + 1);
        xiP -= bj * Math.sin(m * xi) * Math.cosh(m * eta);
        etaP -= bj * Math.cos(m * xi) * Math.sinh(m * eta);
    });
    const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
    const lat = chi
        + (e2 / 2 + (5 * e2 * e2) / 24 + e2 ** 3 / 12) * Math.sin(2 * chi)
        + ((7 * e2 * e2) / 48 + (29 * e2 ** 3) / 240) * Math.sin(4 * chi)
        + ((7 * e2 ** 3) / 120) * Math.sin(6 * chi);
    const lon0 = ((z.huso - 1) * 6 - 180 + 3) * (Math.PI / 180);
    const lon = lon0 + Math.atan(Math.sinh(etaP) / Math.cos(xiP));
    const latG = (lat * 180) / Math.PI;
    const lonG = (lon * 180) / Math.PI;
    if (!(latG >= -90 && latG <= 90 && lonG >= -180 && lonG <= 180)) return null;
    return { lat: latG, lon: lonG };
}

/** Letra de banda de latitud UTM (C … X) que corresponde a una latitud; para Chile suele ser F, G o H. */
export function bandaDeLatitud(lat) {
    const letras = 'CDEFGHJKLMNPQRSTUVWX';
    const i = Math.floor((lat + 80) / 8);
    return letras[Math.min(Math.max(i, 0), letras.length - 1)];
}

/** Enlace de Google Maps a una latitud/longitud (abre el punto; sirve también como «referencia» de la ficha). */
export const enlaceGoogleMaps = (lat, lon) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;

/**
 * Zona, norte y este → { lat, lon, enlace, banda } o null si faltan datos o no son creíbles. Si vienen al revés (el este, de 6 dígitos, en el lugar del norte, de 7;
 * pasa al copiar de una planilla), se detecta y se corrige: es inequívoco porque el norte de Chile es siempre mayor a 1.000.000 y el este, menor a 1.000.000.
 */
export function ubicacionDesdeUtm({ zona, utmNorte, utmEste } = {}) {
    let p = utmALatLon(zona, utmNorte, utmEste);
    let alReves = false;
    if (!p) {
        const a = parseNumeroUtm(utmNorte);
        const b = parseNumeroUtm(utmEste);
        if (a !== null && b !== null && a < 1000000 && b >= 1000000) { p = utmALatLon(zona, b, a); alReves = !!p; }
    }
    if (!p) return null;
    return { lat: p.lat, lon: p.lon, enlace: enlaceGoogleMaps(p.lat, p.lon), banda: bandaDeLatitud(p.lat), alReves };
}
