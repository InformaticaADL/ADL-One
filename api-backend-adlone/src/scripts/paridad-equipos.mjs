// Paridad de la lectura de equipos: equipo.service.js (legado) vs equipo.nuevo.js (esquema nuevo). Solo lee.
//   node src/scripts/paridad-equipos.mjs
import 'dotenv/config';
import { equipoService } from '../services/equipo.service.js';
import { equipoNuevo } from '../services/equipo.nuevo.js';

const limpio = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v instanceof Date ? v.toISOString() : v);
// Columnas que el esquema nuevo no conserva y que ningún código de ADL ONE/APP MAM lee se anotan aquí (se comprueba con grep antes de añadirlas).
const IGNORAR = new Set([]);
// tiene_fc: el legado mezcla 'Si'/'No' con 'S'/'N' (2 filas); el nuevo siempre devuelve 'Si'/'No'.
const valor = (k, v) => (k === 'tiene_fc' ? { S: 'Si', N: 'No' }[v] ?? v : k === 'fecha_cambio' && v instanceof Date ? v.toISOString().slice(0, 19) : limpio(v));   // fecha_cambio: se compara al segundo (el legado es datetime, ±1 ms de redondeo)
const fila = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !IGNORAR.has(k)).map(([k, v]) => [k, valor(k, v)]));
const casos = [
  ['catálogo', 'getEquipoCatalogo', []], ['todos p1', 'getEquipos', [{ limit: 700 }]], ['pág 2 (10)', 'getEquipos', [{ page: 2 }]], ['sede PM', 'getEquipos', [{ sede: 'PM', limit: 700 }]],
  ['activos', 'getEquipos', [{ estado: 'Activo', limit: 700 }]], ['inactivos', 'getEquipos', [{ estado: 'Inactivo', limit: 700 }]], ['búsqueda "ph"', 'getEquipos', [{ search: 'ph', limit: 700 }]],
  ['vencidos', 'getEquipos', [{ expiredOnly: true, limit: 700 }]], ['orden vigencia', 'getEquipos', [{ sortBy: 'vigencia', limit: 30 }]], ['muestreador inactivo', 'getEquipos', [{ inactiveSamplerOnly: true, limit: 700 }]],
  ['por muestreador 1031', 'getEquipos', [{ id_muestreador: 1031, limit: 700 }]], ['por sede 1023', 'getEquipos', [{ id_muestreador: 1023, limit: 700 }]],
  ['por id 1', 'getEquipoById', [1]], ['por id 545', 'getEquipoById', [545]], ['por id 2', 'getEquipoById', [2]],
  ['correlativo BATERIA', 'getNextCorrelativo', ['BATERIA']], ['correlativo Phmetro', 'getNextCorrelativo', ['Phmetro']],
  ['sugerir pH', 'suggestNextCode', ['Phmetro', 'PM', 'pH']], ['sugerir GPS', 'suggestNextCode', ['GPS', 'AY', '']], ['sugerir sin coincidencia', 'suggestNextCode', ['Zzz', 'PM', 'Zzz']],
  ['historial sin cambios (1)', 'getEquipoHistorial', [1]], ['historial 49 (3 versiones)', 'getEquipoHistorial', [49]], ['historial 40', 'getEquipoHistorial', [40]], ['historial 38', 'getEquipoHistorial', [38]], ['historial 25', 'getEquipoHistorial', [25]],
];
let mal = 0;
for (const [nombre, m, args] of casos) {
  const a = await equipoService[m](...args), b = await equipoNuevo[m](...args);
  if (['getEquipoById', 'getNextCorrelativo', 'suggestNextCode'].includes(m)) { const ja = JSON.stringify(Object.fromEntries(Object.entries(a || {}).map(([k, v]) => [k, valor(k, v)]))), jb = JSON.stringify(Object.fromEntries(Object.entries(b || {}).map(([k, v]) => [k, valor(k, v)]))); const ok1 = ja === jb; if (!ok1) mal++; console.log(`${ok1 ? 'OK  ' : 'DIFIERE'} ${nombre}`); if (!ok1) { const x = JSON.parse(ja || '{}'), y = JSON.parse(jb || '{}'); for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) console.log(`      ${k}: «${x[k]}» ≠ «${y[k]}»`); } continue; }
  const filasA = (m === 'getEquipos' ? a.data : a).map(fila), filasB = (m === 'getEquipos' ? b.data : b).map(fila);
  const idc = filasA[0] && 'id_historial' in filasA[0] ? 'id_historial' : filasA[0] && 'id_equipo' in filasA[0] ? 'id_equipo' : 'id_equipocatalogo';
  const mb = new Map(filasB.map((r) => [String(r[idc]), r])); const ma = new Map(filasA.map((r) => [String(r[idc]), r]));
  const soloA = [...ma.keys()].filter((k) => !mb.has(k)), soloB = [...mb.keys()].filter((k) => !ma.has(k)); const dif = new Map();
  for (const [k, r] of ma) { const n = mb.get(k); if (!n) continue; for (const c of Object.keys(r)) if (JSON.stringify(r[c]) !== JSON.stringify(n[c])) { const x = dif.get(c) || { n: 0, ej: `${k}: «${r[c]}» ≠ «${n[c]}»` }; x.n++; dif.set(c, x); } }
  const orden = filasA.map((r) => r[idc]).join() === filasB.map((r) => r[idc]).join();
  const extra = m === 'getEquipos' ? ['total', 'expiringCount', 'expiredCount', 'inactiveSamplerCount'].filter((k) => a[k] !== b[k]).map((k) => `${k}: ${a[k]} ≠ ${b[k]}`) : [];
  const cat = m === 'getEquipos' ? Object.keys(a.catalogs).filter((k) => k !== 'nombres' && JSON.stringify(a.catalogs[k].map(limpio)) !== JSON.stringify(b.catalogs[k].map(limpio))).map((k) => `catalogs.${k}`) : [];
  const ok = !soloA.length && !soloB.length && !dif.size && orden && !extra.length && !cat.length; if (!ok) mal++;
  console.log(`${ok ? 'OK  ' : 'DIFIERE'} ${nombre}: legado ${filasA.length} filas, nuevo ${filasB.length}${orden ? '' : ' (ORDEN distinto)'}`);
  if (soloA.length) console.log(`      solo en el legado: ${soloA.slice(0, 12).join(',')}`);
  if (soloB.length) console.log(`      solo en el nuevo: ${soloB.slice(0, 12).join(',')}`);
  for (const [c, x] of dif) console.log(`      columna ${c}: ${x.n} filas; ej ${x.ej}`);
  if (extra.length) console.log(`      ${extra.join('; ')}`);
  if (cat.length) console.log(`      catálogos distintos: ${cat.join(', ')}`);
}
console.log(mal ? `\n${mal} caso(s) con diferencias` : '\nparidad completa'); process.exit(0);
