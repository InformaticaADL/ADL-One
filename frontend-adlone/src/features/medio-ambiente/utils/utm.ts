/**
 * Coordenadas UTM → latitud/longitud y enlace de Google Maps (misma lógica que api-backend-adlone/src/utils/utm.js; si se cambia una, se cambia la otra).
 * Supuestos: datum WGS84/SIRGAS y hemisferio SUR (todo el territorio de trabajo es chileno), salvo que la zona traiga una letra de banda norte.
 */
const A = 6378137;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const BANDAS_NORTE = 'NPQRTUVWX';

export function parseNumeroUtm(valor: unknown): number | null {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
    let s = String(valor).trim().replace(/\s+/g, '');
    if (!s) return null;
    if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else s = s.replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

export function parseZona(zona: unknown): { huso: number; banda: string } | null {
    const m = String(zona || '').trim().match(/^(\d{1,2})\s*([A-Za-z])?$/);
    if (!m) return null;
    const huso = parseInt(m[1], 10);
    if (huso < 1 || huso > 60) return null;
    return { huso, banda: (m[2] || '').toUpperCase() };
}

export function utmALatLon(zona: unknown, norte: unknown, este: unknown): { lat: number; lon: number } | null {
    const z = parseZona(zona);
    const N = parseNumeroUtm(norte);
    const E = parseNumeroUtm(este);
    if (!z || N === null || E === null) return null;
    if (E < 100000 || E > 900000 || N <= 0 || N > 10000000) return null;
    const sur = !(z.banda && BANDAS_NORTE.includes(z.banda));
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

export function bandaDeLatitud(lat: number): string {
    const letras = 'CDEFGHJKLMNPQRSTUVWX';
    const i = Math.floor((lat + 80) / 8);
    return letras[Math.min(Math.max(i, 0), letras.length - 1)];
}

export const enlaceGoogleMaps = (lat: number, lon: number) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;

export interface UbicacionUtm { lat: number; lon: number; enlace: string; banda: string; alReves: boolean }

/** Zona, norte y este → ubicación y enlace; corrige norte/este escritos al revés. null si faltan datos o no son creíbles. */
export function ubicacionDesdeUtm(d: { zona?: unknown; utmNorte?: unknown; utmEste?: unknown } = {}): UbicacionUtm | null {
    let p = utmALatLon(d.zona, d.utmNorte, d.utmEste);
    let alReves = false;
    if (!p) {
        const a = parseNumeroUtm(d.utmNorte);
        const b = parseNumeroUtm(d.utmEste);
        if (a !== null && b !== null && a < 1000000 && b >= 1000000) { p = utmALatLon(d.zona, b, a); alReves = !!p; }
    }
    if (!p) return null;
    return { lat: p.lat, lon: p.lon, enlace: enlaceGoogleMaps(p.lat, p.lon), banda: bandaDeLatitud(p.lat), alReves };
}

const PREFIJO_GENERADO = 'https://www.google.com/maps?q=';
/** ¿El enlace lo generó el sistema desde las UTM (y no lo escribió una persona)? */
export const esEnlaceGenerado = (ref: string) => ref.trim().startsWith(PREFIJO_GENERADO);

/**
 * Referencia de Google Maps que corresponde tras un cambio de zona/UTM: si está vacía o es una generada antes, se recalcula desde las UTM;
 * un enlace escrito por la persona no se toca.
 */
export function refAutomatica<T extends { zona: string; utmNorte: string; utmEste: string; refGoogle: string }>(fila: T): T {
    if (fila.refGoogle.trim() && !esEnlaceGenerado(fila.refGoogle)) return fila;
    const u = ubicacionDesdeUtm(fila);
    const nuevo = u ? u.enlace : '';
    return nuevo === fila.refGoogle ? fila : { ...fila, refGoogle: nuevo };
}

/** Distancia en metros entre dos puntos (haversine). */
export function distanciaMetros(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
    const R = 6371008.8;
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
