// Paridad de lecturas de fichas: ficha.service.js (legado) vs ficha.nuevo.js (esquema nuevo). Solo lee.
//   node src/scripts/paridad-fichas.mjs
import 'dotenv/config'; import sql from 'mssql';
import fichaService from '../services/ficha.service.js';
import { fichaNuevo } from '../services/ficha.nuevo.js';

const L = await new sql.ConnectionPool({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: true, trustServerCertificate: true } }).connect();
// undefined (columna que el legado ni siquiera trae en esa fila) y null (el nuevo la trae vacía a propósito) son "lo mismo".
const limpio = (v) => (v === undefined ? null : typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v instanceof Date ? v.toISOString().slice(0, 19) : typeof v === 'boolean' ? (v ? 1 : 0) : v);   // fechas al segundo (datetime legado ±1 ms)
// estado_ficha es texto libre del legado (mayúsculas inconsistentes según qué pantalla lo escribió: "En Proceso" vs "EN PROCESO");
// nada compara ese texto con `===` (verificado con grep en el frontend) — se compara sin diferenciar mayúsculas.
const CAMPO_LIBRE = new Set(['estado_ficha']);
// getForAssignment/getForAssignmentDetail/getEnProcesoFichas dependen de rutas legadas (mae_estadomuestreo, estado_caso
// crudo) que el esquema nuevo, a propósito, no conservó como catálogo/texto libre — quedan siempre null/0 del lado nuevo
// (ver ficha.nuevo.js y el hallazgo del módulo rut_, 2026-09-25). Se ignoran en la comparación, no se normalizan.
const CAMPOS_IGNORADOS = new Set(['id_estadomuestreo', 'nombre_estadomuestreo', 'estado_caso', 'motivo_cancelacion', 'sincronizado']);
// id_muestreador2: el legado usa "em.id_muestreador2 || row.id_muestreador2 || null" (0 se vuelve null por su propio `||`);
// el esquema nuevo no reproduce ese quirk. 0 y null son "lo mismo" para este campo.
const CERO_COMO_NULO_LISTA = new Set(['id_muestreador2']);
// ma_duracion_muestreo: el legado la trae como columna VARCHAR (texto), el esquema nuevo como número; mismo valor.
const NUMERO_LISTA = new Set(['ma_duracion_muestreo']);
// muestreador/muestreador2: el mae_muestreador id 0 (placeholder "sin asignar") nunca se migró a per_persona (mismo criterio
// que el resto de catálogos con fila "No aplica"/"NA"); el legado igual muestra su nombre en blanco ('').
const VACIO_COMO_NULO_LISTA = new Set(['muestreador', 'muestreador_retiro', 'nombre_muestreador', 'nombre_muestreador2']);
// nombre_coordinador: el legado muestra el texto "NA" del usuario placeholder cuando la visita no tiene coordinador asignado;
// ese usuario placeholder tampoco se migró (mismo criterio de catálogos con fila "No aplica").
const NA_COMO_NULO_LISTA = new Set(['nombre_coordinador']);
const valor = (k, v) => {
  if (CAMPO_LIBRE.has(k) && typeof v === 'string') return limpio(v).toUpperCase();
  if (CERO_COMO_NULO_LISTA.has(k) && (v === 0 || v == null)) return null;
  if (NUMERO_LISTA.has(k) && v != null && v !== '') return Number(v);
  if (VACIO_COMO_NULO_LISTA.has(k) && (v == null || limpio(v) === '')) return null;
  if (NA_COMO_NULO_LISTA.has(k) && (v == null || limpio(v) === 'NA')) return null;
  return limpio(v);
};
const fila = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !CAMPOS_IGNORADOS.has(k)).map(([k, v]) => [k, valor(k, v)]));
const fichas = (await L.request().query(`SELECT id_fichaingresoservicio id FROM App_Ma_FichaIngresoServicio_ENC ORDER BY 1`)).recordset.map((r) => Number(r.id));
const visitas = (await L.request().query(`SELECT DISTINCT id_fichaingresoservicio f, frecuencia_correlativo c FROM App_Ma_Equipos_MUESTREOS ORDER BY 1, 2`)).recordset;
// Fichas EN_PROCESO/PENDIENTE_PROGRAMACION (5,6) reales: las únicas que getForAssignment/Detail devuelven algo.
const enProceso = (await L.request().query(`SELECT id_fichaingresoservicio id FROM App_Ma_FichaIngresoServicio_ENC WHERE id_validaciontecnica IN (5,6) ORDER BY 1`)).recordset.map((r) => Number(r.id));
const casos = [...fichas.map((id) => [`historial ficha ${id}`, 'getHistorial', [id], 'id_historial']), ...visitas.map((v) => [`equipos ${String(v.c).trim()}`, 'getSamplingEquipos', [Number(v.f), String(v.c).trim()], 'id_equipo']),
  ['equipos: visita sin equipos', 'getSamplingEquipos', [1, 'no-existe'], 'id_equipo'],
  ['listado general', 'getAllFichas', [], 'id_fichaingresoservicio'], ['muestreos ejecutados', 'getMuestreosEjecutados', [], 'id_agendamam'],
  ['asignación: listado', 'getForAssignment', [], 'id_fichaingresoservicio'], ['en proceso (calendario)', 'getEnProcesoFichas', [], 'id_agenda'],
  ...enProceso.map((id) => [`asignación detalle ficha ${id}`, 'getForAssignmentDetail', [id, 1], 'id_agendamam'])];
let mal = 0, n = 0;
for (const [nombre, m, argsLeg, idc] of casos) {
  // getForAssignmentDetail: el esquema nuevo no usa el filtro de estado (siempre trae todo lo vigente de la ficha).
  const argsNuevo = m === 'getForAssignmentDetail' ? [argsLeg[0]] : argsLeg;
  const a = (await fichaService[m](...argsLeg)).map(fila), b = (await fichaNuevo[m](...argsNuevo)).map(fila); n++;
  const mb = new Map(b.map((r) => [String(r[idc]), r])), ma = new Map(a.map((r) => [String(r[idc]), r]));
  const soloA = [...ma.keys()].filter((k) => !mb.has(k)), soloB = [...mb.keys()].filter((k) => !ma.has(k)); const dif = [];
  for (const [k, r] of ma) { const x = mb.get(k); if (!x) continue; for (const c of Object.keys(r)) if (JSON.stringify(r[c]) !== JSON.stringify(x[c])) dif.push(`${k}.${c}: «${r[c]}» ≠ «${x[c]}»`); }
  const orden = a.map((r) => r[idc]).join() === b.map((r) => r[idc]).join();
  const ok = !soloA.length && !soloB.length && !dif.length && (orden || m === 'getSamplingEquipos'); if (!ok) { mal++; console.log(`DIFIERE ${nombre}: legado ${a.length}, nuevo ${b.length}${soloA.length ? ` solo-legado ${soloA}` : ''}${soloB.length ? ` solo-nuevo ${soloB}` : ''}${orden ? '' : ' (orden)'}`); for (const d of dif.slice(0, 4)) console.log('      ' + d); }
}
// getExecutionDetail: no es una lista, es un objeto anidado (ficha/analisis/equipos/laboratorios/media/procesos). Se compara aparte.
// Campo conocido y aceptado con distinta may/minúscula: instrumento_ambiental "No aplica" (nombre del catálogo) vs "No Aplica" (texto libre legado).
const SIN_CASE = new Set(['instrumento_ambiental']);
// Numéricos que el legado devuelve como texto (columnas VARCHAR de origen) y el esquema nuevo como número.
const COMO_NUMERO = new Set(['ma_temperaturai', 'ma_phi', 'ma_temperaturat', 'ma_pht', 'ma_temperatura_compuesta', 'ma_ph_compuesta', 'temperatura_corregidai', 'temperatura_corregidat', 'temperatura_corregidacompuesta']);
// "Sin observaciones." es el propio texto de relleno que la pantalla ya reconstruye cuando no hay observación (ver migracion-fic.mjs:
// obs() trata ese texto igual que vacío al migrar); comparar como si ambos fueran "sin observación".
const SIN_OBSERVACION = new Set(['observaciones_muestreador', 'observaciones_muestreador2']);
const VACIO_COMO_NULO = new Set(['lab_suplente', 'lab_principal', 'observaciones_coordinador', 'nombre_observadorterreno', 'cargo_observadorterreno', 'nombre_observadorterreno_retiro', 'cargo_observadorterreno_retiro', 'observaciones_jefaturatecnica']);
// Campos numéricos donde el legado a veces guarda 0 y a veces NULL para "sin medición" (una distinción que la migración de fic_
// no conservó a propósito: ver migracion-fic.mjs, "totalizador: o.tot && o.tot>0 ? o.tot : null"). Ambos representan lo mismo.
// id_muestreador2: en getForAssignmentDetail/getEnProcesoFichas el legado usa "em.id_muestreador2 || row.id_muestreador2 || null"
// (0 se vuelve null por el propio `||` del legado); el esquema nuevo no reproduce ese quirk. Mismo criterio: 0 y null son "lo mismo".
const CERO_COMO_NULO = new Set(['totalizador_inicio', 'totalizador_final', 'vdd', 'id_muestreador2']);
// getFichaById selecciona es_remuestreo/id_ficha_original DOS veces sin darse cuenta (f.* + explícitas): el driver del legado
// devuelve un array con el mismo valor repetido en vez de un escalar. Es un bug del propio legado; se destapa aquí (mismo valor).
const CAMPO_DUPLICADO = new Set(['es_remuestreo', 'id_ficha_original']);
const limpiaProfundo = (v, clave) => {
  if (CAMPO_DUPLICADO.has(clave) && Array.isArray(v)) v = v[0];
  if (Array.isArray(v)) return v.map((x) => limpiaProfundo(x, clave));
  if (v && typeof v === 'object' && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, limpiaProfundo(x, k)]));
  let x = valor(clave, v);
  if (SIN_CASE.has(clave) && typeof x === 'string') x = x.toUpperCase();
  if (COMO_NUMERO.has(clave) && x != null && x !== '') x = Number(x);
  if (SIN_OBSERVACION.has(clave) && (x == null || x === 'Sin observaciones.')) x = null;
  if (VACIO_COMO_NULO.has(clave) && x === '') x = null;
  if (CERO_COMO_NULO.has(clave) && (x === 0 || x == null)) x = null;
  return x;
};
for (const idFicha of fichas) {
  n++;
  let a, b;
  try { a = limpiaProfundo(await fichaService.getFichaById(idFicha)); } catch (e) { console.log(`?    ficha ${idFicha}: falla el legado (${e.message.slice(0, 80)})`); continue; }
  try { b = limpiaProfundo(await fichaNuevo.getFichaById(idFicha)); } catch (e) { console.log(`FALLA ficha ${idFicha}: falla el nuevo (${e.message.slice(0, 120)})`); mal++; continue; }
  // La fila "CostoOperativo" del DET del legado no es un análisis (no tiene técnica); la sincronización de fic_ la excluye a
  // propósito (su valor queda en fic_ficha.snap_costo_operativo_uf) y no conserva el número de item original. Se ignora aquí:
  // conocido y documentado, no se puede reconstruir sin leer el legado (que este archivo, a propósito, no hace).
  if (a?.detalles) a.detalles = a.detalles.filter((d) => d.tipo_analisis !== 'CostoOperativo' && d.nombre_tecnica != null);
  const diffs = [];
  const claveDet = (arr) => (Array.isArray(arr) ? arr.map((x) => x.item).join(',') : '');
  const walk2 = (x, y, ruta) => {
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    if (Array.isArray(x) && Array.isArray(y) && x.length === y.length) { x.forEach((xi, i) => walk2(xi, y[i], `${ruta}[item ${xi?.item ?? i}]`)); return; }
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !(x instanceof Date)) { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk2(x[k], y[k], ruta ? `${ruta}.${k}` : k); }
    else diffs.push(`${ruta}: «${JSON.stringify(x)}» ≠ «${JSON.stringify(y)}» ${ruta === 'detalles' ? `(claves ${claveDet(x)} vs ${claveDet(y)})` : ''}`);
  };
  walk2(a, b, ''); if (diffs.length) { mal++; console.log(`DIFIERE ficha ${idFicha}:`); for (const d of diffs.slice(0, 8)) console.log('      ' + d); }
}
const agendas = (await L.request().query(`SELECT id_fichaingresoservicio f, frecuencia_correlativo c FROM App_Ma_Agenda_MUESTREOS ORDER BY 1, 2`)).recordset;
for (const { f: idFicha, c: correlativo } of agendas) {
  n++;
  let a, b;
  try { a = limpiaProfundo(await fichaService.getExecutionDetail(idFicha, correlativo)); } catch (e) { console.log(`?    detalle ${idFicha}/${correlativo}: falla el legado (${e.message.slice(0, 80)})`); continue; }
  try { b = limpiaProfundo(await fichaNuevo.getExecutionDetail(idFicha, correlativo)); } catch (e) { console.log(`FALLA detalle ${idFicha}/${correlativo}: falla el nuevo (${e.message.slice(0, 120)})`); mal++; continue; }
  const diffs = [];
  const walk = (x, y, ruta) => {
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !(x instanceof Date)) { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], ruta ? `${ruta}.${k}` : k); }
    else diffs.push(`${ruta}: «${JSON.stringify(x)}» ≠ «${JSON.stringify(y)}»`);
  };
  // 1002 es el marcador legado de "sin supervisión" (PLACEHOLDER_SUP en sync/handlers/fic.js): el esquema nuevo lo resuelve a NULL
  // al migrar, así que no se puede distinguir de "no había ningún id". El campo "supervisado" que cada lado calcula a partir de su
  // propio id_supervisor queda entonces desalineado solo en ese caso puntual; se homologan ambos lados antes de comparar.
  for (const [campo, clave, sinSupervisor] of [['instalacion', 'id_supervisor', 0], ['retiro', 'id_supervisor_retiro', null]]) {
    if (a?.ficha?.[clave] === 1002) { a.ficha[clave] = sinSupervisor; if (a.procesos?.[campo]) a.procesos[campo].supervisado = b?.procesos?.[campo]?.supervisado; }
  }
  walk(a, b, ''); if (diffs.length) { mal++; console.log(`DIFIERE detalle ${idFicha}/${correlativo}:`); for (const d of diffs.slice(0, 6)) console.log('      ' + d); }
}
console.log(mal ? `\n${mal} de ${n} caso(s) con diferencias` : `\nparidad completa (${n} casos)`); process.exit(0);
