// Reglas de clientes compartidas con scripts/migracion-cli.mjs (mantener idénticas: la prueba de idempotencia sobre datos reales las contrasta).
import { norm, t } from '../comun.js';

// Clave de comparación de nombres: sin tildes, mayúsculas ni signos.
export const clave = (s) => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]/g, '').replace(/\s+/g, ' ').trim();

// RUT normalizado para comparar; null si es vacío o de relleno (00000000-0, 11111111-1, NA…).
export const rutClave = (s) => { const x = norm(s).replace(/[.\s-]/g, '').toLowerCase(); return /^0*$/.test(x) || /^([0-9])\1+[0-9k]?$/.test(x) || /^(na|nd|sn|noaplica|noinformado)$/.test(x) ? null : x; };
export const pareceRut = (x) => /^[0-9][0-9.]*-?[0-9kK]$/.test(norm(x));

// En 93 empresas del legado el nombre y el RUT del representante legal venían intercambiados.
export function rlegalDe(e) {
  let n = t(e.rlegal_nombre), r = t(e.rlegal_rut);
  if (r && !pareceRut(r) && n && pareceRut(n)) [n, r] = [r, n];
  else if (r && r.length > 20) { if (!n) n = r; r = null; }
  return { rlegal_nombre: n ?? null, rlegal_rut: r ?? null };
}

// Coordenadas: decimales del legado; si faltan, se recuperan de ma_latitud / ma_longitud (coma decimal o grados) SOLO si caen en Chile.
export const coordOk = (lat, lon) => lat != null && lon != null && Math.abs(lat) > 0.0001 && Math.abs(lon) > 0.0001 && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
export const enChile = (lat, lon) => lat >= -56 && lat <= -17 && lon >= -80 && lon <= -66;
export const coordTexto = (v) => {
  const x = norm(v); if (!x || x === '0') return null;
  const d = /^(-?)(\d+)[°º]\s*(\d+)['′]\s*([\d.,]+)/.exec(x);
  if (d) { const g = Number(d[2]) + Number(d[3]) / 60 + Number(d[4].replace(',', '.')) / 3600; return -g; }
  const n = Number(x.replace(',', '.')); return Number.isFinite(n) ? n : null;
};
export const metros = (a, b, c, d) => { const R = 6371000, r = Math.PI / 180, dp = (c - a) * r, dl = (d - b) * r; const x = Math.sin(dp / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

export const ESQUEMAS = new Map([['precio lista', 'Precio lista'], ['precio convenio', 'Precio convenio'], ['precio recargo', 'Precio recargo']]);
