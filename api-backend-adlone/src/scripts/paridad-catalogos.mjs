// Paridad de catálogos: compara lo que devuelve hoy el servicio (legado: procedimientos y consultas) con la lectura del esquema nuevo.
//   node src/scripts/paridad-catalogos.mjs
// Solo lee. Compara por id legado, con los textos sin espacios sobrantes (el legado rellena algunos nombres con espacios).
import 'dotenv/config';
import { catalogosService } from '../services/catalogos.service.js';
import { catalogosNuevo } from '../services/catalogos.nuevo.js';

// Se ignoran los espacios sobrantes (relleno y dobles): el esquema nuevo guarda los textos normalizados (una decisión conocida y cosmética).
const norm = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v instanceof Date ? v.toISOString() : v);
const limpia = (fila, m) => Object.fromEntries(Object.entries(fila).filter(([k]) => !(IGNORAR[m] || []).includes(k)).map(([k, v]) => [k, norm(v)]));
const casos = [
  ['getLugaresAnalisis', []], ['getComponentesAmbientales', []], ['getSubAreas', [190]], ['getTiposMuestreo', []], ['getTiposMuestra', []], ['getActividadesMuestreo', []], ['getTiposDescarga', []],
  ['getModalidades', []], ['getFormasCanal', []], ['getDispositivosHidraulicos', []], ['getInstrumentosAmbientales', []], ['getUnidadesMedida', []], ['getFrecuenciasPeriodo', []],
  ['getEmpresasServicio', []], ['getClientes', []], ['getCentros', []], ['getContactos', []], ['getContactos', [null, 48]], ['getObjetivosMuestreo', []], ['getInspectores', []], ['getMuestreadores', []], ['getCargos', []], ['getEstadosMuestreo', []], ['getEstadosEquipo', []],
];
// Columnas del legado que ningún código lee (verificado con grep en ADL ONE, frontend y APP MAM): no cuentan como diferencia.
const IGNORAR = { getCargos: ['id_observadorterreno'] };
let mal = 0;
for (const [m, args] of casos) {
  let leg, nue;
  try { leg = (await catalogosService[m](...args)).map((f) => limpia(f, m)); } catch (e) { console.log(`?    ${m}: falla el legado (${e.message.slice(0, 80)})`); continue; }
  try { nue = (await catalogosNuevo[m](...args)).map((f) => limpia(f, m)); } catch (e) { console.log(`FALLA ${m}: falla el nuevo (${e.message.slice(0, 120)})`); mal++; continue; }
  const cols = Object.keys(leg[0] || nue[0] || {}); const idc = cols.find((c) => /^id/.test(c) && c !== 'id_tipomuestra' || c === 'id') || cols[0];
  const mapNue = new Map(nue.map((r) => [String(r[idc]), r])); const mapLeg = new Map(leg.map((r) => [String(r[idc]), r]));
  const soloLeg = [...mapLeg.keys()].filter((k) => !mapNue.has(k)), soloNue = [...mapNue.keys()].filter((k) => !mapLeg.has(k)); const difieren = [];
  for (const [k, r] of mapLeg) { const n = mapNue.get(k); if (!n) continue; const d = Object.keys(r).filter((c) => JSON.stringify(r[c]) !== JSON.stringify(n[c])); if (d.length) difieren.push(`${k}: ${d.map((c) => `${c} «${r[c]}» ≠ «${n[c]}»`).join('; ')}`); }
  const sinCol = Object.keys(leg[0] || {}).filter((c) => nue[0] && !(c in nue[0]));
  const ordenIgual = leg.map((r) => r[idc]).join() === nue.map((r) => r[idc]).join(); if (!ordenIgual && !soloLeg.length && !soloNue.length) console.log(`      (mismo contenido, distinto ORDEN: legado ${leg.map((r) => r[idc]).join(',')} / nuevo ${nue.map((r) => r[idc]).join(',')})`);
  const ok = !soloLeg.length && !soloNue.length && !difieren.length && !sinCol.length; if (!ok) mal++;
  console.log(`${ok ? 'OK  ' : 'DIFIERE'} ${m}(${args.join(',')}): legado ${leg.length} filas, nuevo ${nue.length}`);
  if (soloLeg.length) console.log(`      solo en el legado (ids): ${soloLeg.join(',')}`);
  if (soloNue.length) console.log(`      solo en el nuevo (ids): ${soloNue.join(',')}`);
  if (sinCol.length) console.log(`      columnas del legado que faltan en el nuevo: ${sinCol.join(',')}`);
  for (const d of difieren.slice(0, 5)) console.log(`      ${d}`);
}
console.log(mal ? `\n${mal} método(s) con diferencias` : '\nparidad completa'); process.exit(0);
