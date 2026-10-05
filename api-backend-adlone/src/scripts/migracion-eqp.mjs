/* =====================================================================
   Migración del módulo eqp_ : legado (PruebasInformatica) → esquema v5
   =====================================================================
   Uso:
     node src/scripts/migracion-eqp.mjs                 → ensayo: carga y hace ROLLBACK
     node src/scripts/migracion-eqp.mjs --apply         → carga y confirma (COMMIT)
     node src/scripts/migracion-eqp.mjs --apply --reset → borra lo eqp_ previo y recarga

   SEGURIDAD: del legado solo lee; solo escribe en una base cuyo nombre contenga "TEST";
   una transacción; sin --apply termina en ROLLBACK. Requiere per_ ya migrado.

   REGLAS (verificadas con los datos reales; ver task.md)
     - Los 666 equipos y las 37 fichas de catálogo. Los equipos de TI de mae_tipoequipo /
       mae_marca / mae_almacenamiento (notebooks, PC) no son equipos de muestreo: fuera de alcance.
     - Custodia: persona a cargo (per_persona) O lugar de guardado ("Guardados": las sedes que
       el legado modelaba como muestreadores falsos 1023-1026). Nunca ambos.
     - Estados reales del legado (Operativo, Dado de Baja, Fuera de Servicio…); sin estado → Operativo.
     - Código repetido (3 pares, todos deshabilitados y sin uso): se conserva el mejor con su
       código y el otro se sufija "#id"; ambos van a revision_duplicado (PENDIENTE).
     - Historial: se cargan las versiones anteriores y se crea la fila de la versión VIGENTE de
       cada equipo (el legado no la guarda), para que todo uso apunte a una versión.
   ===================================================================== */
import dotenv from 'dotenv'; dotenv.config();
import sql from 'mssql';
import { fotoEquipo } from '../sync/datos/equipoHistorial.js';

const APPLY = process.argv.includes('--apply');
const RESET = process.argv.includes('--reset');
const TEST_DB = process.env.MIG_TEST_DB || 'ADL ONE TEST';
if (!/TEST/i.test(TEST_DB)) { console.error(`ABORTADO: la base destino "${TEST_DB}" no contiene "TEST".`); process.exit(1); }
const SEDES = new Map([[1023, 'Base Aysén'], [1024, 'Base Puerto Montt'], [1025, 'Base Villarrica'], [1026, 'Sede Villarrica']]);
const ESTADOS = ['Operativo', 'Dado de Baja', 'En Mantención', 'En Calibración', 'Fuera de Servicio'];

const cfg = (database) => ({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database,
  requestTimeout: 120000, options: { encrypt: true, trustServerCertificate: true } });
const leg = await new sql.ConnectionPool(cfg(process.env.DB_DATABASE)).connect();
const dst = await new sql.ConnectionPool(cfg(TEST_DB)).connect();
const L = async (q) => (await leg.request().query(q)).recordset;
const tx = new sql.Transaction(dst); await tx.begin();
const run = async (text, params = {}) => { const rq = new sql.Request(tx); for (const [k, v] of Object.entries(params)) rq.input(k, v === undefined ? null : v); return (await rq.query(text)).recordset; };
const ins = async (table, obj) => {
  const e = Object.entries(obj).filter(([, v]) => v !== undefined);
  const params = Object.fromEntries(e.map(([, v], i) => [`p${i}`, v]));
  return (await run(`DECLARE @o TABLE (id INT); INSERT INTO ${table} (${e.map(([k]) => `[${k}]`).join(',')}) OUTPUT INSERTED.id INTO @o VALUES (${e.map((_, i) => `@p${i}`).join(',')}); SELECT id FROM @o;`, params))[0].id;
};
const mapear = (tl, il, tn, inu, nota = null) => run(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo, nota) VALUES (@a,@b,@c,@d,@e)`, { a: tl, b: il, c: tn, d: inu, e: nota });
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const t = (s) => norm(s) || null;
const num = (v) => { if (v == null || norm(v) === '') return null; const n = Number(norm(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const yes = (v, def = false) => { if (v === true || v === 1) return true; if (v === false || v === 0) return false; const x = norm(v); return x === '' ? def : /^(S|SI|1|TRUE)$/i.test(x); };
const dateOnly = (d) => (d instanceof Date && d.getUTCFullYear() > 1900 ? d : null);
const warns = new Map(); const warn = (k, ej) => { const w = warns.get(k) || { n: 0, ej: [] }; w.n++; if (w.ej.length < 4 && ej != null) w.ej.push(ej); warns.set(k, w); };
const cortar = (s, n, k) => { const x = t(s); if (x && x.length > n) { warn(`${k}: texto truncado a ${n}`, x.slice(0, 30)); return x.slice(0, n); } return x; };

try {
  const TABLAS = ['eqp_reserva', 'eqp_historial', 'eqp_equipo', 'eqp_catalogo', 'eqp_lugar_guardado'];
  let previo = 0; for (const tb of TABLAS) previo += (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  if (previo > 0 && !RESET) throw new Error('Las tablas eqp_ ya tienen datos. Usa --reset para borrarlas y recargar.');
  if (RESET) {
    await run(`DELETE FROM revision_duplicado WHERE entidad='EQP_EQUIPO'`);
    await run(`DELETE FROM mig_id_map WHERE tabla_nueva LIKE 'eqp[_]%'`);
    for (const tb of TABLAS) { try { await run(`DELETE FROM ${tb}`); } catch (e) { throw new Error(`No se pudo vaciar ${tb}: hay filas que la referencian (uso de equipos de las fichas de prueba). Vacía antes esos datos con migracion-fic.mjs --solo-reset --reset --apply. Detalle: ${e.message}`); } }
  }
  const persMap = new Map((await run(`SELECT id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado='mae_muestreador' AND id_nuevo>0`)).map((r) => [Number(r.id_legado), r.id_nuevo]));
  if (!persMap.size) throw new Error('per_ no está migrado (mig_id_map sin mae_muestreador). Ejecuta antes migracion-per.mjs.');

  /* ---------- 1. Lugares de guardado ---------- */
  const lugarMap = new Map();
  for (const [idLeg, nombre] of SEDES) { const id = await ins('eqp_lugar_guardado', { nombre }); lugarMap.set(idLeg, id); await mapear('mae_muestreador#sede', idLeg, 'eqp_lugar_guardado', id, 'sede modelada como muestreador en el legado'); }

  /* ---------- 2. Catálogo ---------- */
  const CAT = await L(`SELECT * FROM mae_equipo_catalogo ORDER BY id_equipocatalogo`); const catMap = new Map(); const catNombres = new Set();
  for (const c of CAT) {
    const nombre = norm(c.nombre); if (catNombres.has(nombre.toLowerCase())) throw new Error(`Catálogo de equipo repetido: ${nombre}`); catNombres.add(nombre.toLowerCase());
    const id = await ins('eqp_catalogo', { nombre: nombre.slice(0, 150), que_mide: cortar(c.que_mide, 150, 'catálogo.que_mide'), unidad_medida_texto: cortar(c.unidad_medida_textual, 200, 'catálogo.unidad'), unidad_medida_sigla: cortar(c.unidad_medida_sigla, 50, 'catálogo.sigla'), tipo_equipo: cortar(c.tipo_equipo, 80, 'catálogo.tipo') });
    catMap.set(Number(c.id_equipocatalogo), id); await mapear('mae_equipo_catalogo', Number(c.id_equipocatalogo), 'eqp_catalogo', id);
  }

  /* ---------- 3. Equipos ---------- */
  const EQ = await L(`SELECT * FROM mae_equipo ORDER BY id_equipo`);
  const orden = [...EQ].sort((a, b) => (yes(b.habilitado) - yes(a.habilitado)) || ((norm(b.Estado) === 'Operativo') - (norm(a.Estado) === 'Operativo')) || (Number(a.id_equipo) - Number(b.id_equipo)));
  const codigos = new Map(); const eqMap = new Map(); const eqFila = new Map(); const dupPares = []; const custodia = { persona: 0, lugar: 0, ninguna: 0 };
  for (const e of orden) {
    const idL = Number(e.id_equipo); let cod = norm(e.codigo) || `EQ-${idL}`; const k = cod.toLowerCase();
    if (codigos.has(k)) { dupPares.push([codigos.get(k), idL]); warn('código de equipo repetido (el segundo se sufija "#id")', cod); cod = `${cod}#${idL}`; } else codigos.set(k, idL);
    if (cod.length > 60) throw new Error(`Código de equipo demasiado largo (${cod.length}): ${cod}`);
    let estado = norm(e.Estado); if (!estado) { warn('equipo sin estado (queda Operativo)', idL); estado = 'Operativo'; } else if (!ESTADOS.includes(estado)) { warn('estado de equipo fuera del catálogo (queda Operativo)', estado); estado = 'Operativo'; }
    const cat = catMap.get(Number(e.id_equipocatalogo)); if (!cat) throw new Error(`Equipo ${idL} sin catálogo`);
    const idMue = Number(e.id_muestreador); const persona = persMap.get(idMue) ?? null; const lugar = persona ? null : (lugarMap.get(idMue) ?? null);
    custodia[persona ? 'persona' : lugar ? 'lugar' : 'ninguna']++; if (!persona && !lugar) warn('equipo sin custodio (persona ni lugar)', `${idL}: id_muestreador ${idMue}`);
    if (norm(e.ocupado_por_frecuencia)) warn('equipo con ocupado_por_frecuencia (visita se resuelve en la carga de fichas)', idL);
    const sede = t(e.sede); if (sede && sede.length > 10) throw new Error(`sede demasiado larga: ${sede}`);
    const id = await ins('eqp_equipo', { id_equipo_catalogo: cat, codigo: cod, sigla: t(e.sigla)?.slice(0, 20), correlativo: num(e.correlativo) != null ? Math.round(num(e.correlativo)) : undefined,
      nombre: (norm(e.nombre) || cod).slice(0, 150), sede: sede ?? undefined, id_persona_responsable: persona ?? undefined, id_lugar_guardado: lugar ?? undefined,
      error_0: num(e.error0), error_15: num(e.error15), error_30: num(e.error30), tiene_factor_correccion: yes(e.tienefc), es_fijo: yes(e.es_fijo), aparece_en_informe: yes(e.informe),
      ultima_verificacion: dateOnly(e.Ultima_verificacion) ?? undefined, siguiente_verificacion: dateOnly(e.Siguiente_verificacion) ?? undefined, fecha_vigencia: dateOnly(e.fecha_vigencia) ?? undefined,
      plazo_vigencia: cortar(e.Plazo_Vigencia, 500, 'plazo_vigencia'), equipo_asociado: cortar(e.equipo_asociado, 200, 'equipo_asociado'), observacion: cortar(e.observacion, 1000, 'observacion'),
      estado, habilitado: yes(e.habilitado), visible_muestreador: yes(e.visible_muestreador, true), version: (t(e.version) || 'v1').slice(0, 10), esta_ocupado: yes(e.esta_ocupado) });
    eqMap.set(idL, id); eqFila.set(idL, e); await mapear('mae_equipo', idL, 'eqp_equipo', id, cod.includes('#') ? 'código repetido: sufijado' : null);
  }
  for (const [a, b] of dupPares) await ins('revision_duplicado', { entidad: 'EQP_EQUIPO', id_registro_a: eqMap.get(a), id_registro_b: eqMap.get(b), criterio: 'MISMO_CODIGO',
    detalle_json: JSON.stringify({ legado_a: a, legado_b: b, codigo: norm(eqFila.get(a).codigo) }), observacion: 'Mismo código en dos equipos (ambos deshabilitados y sin uso); el segundo se cargó con sufijo #id' });

  /* ---------- 4. Historial: versiones anteriores + línea base de la vigente ---------- */
  const HIS = await L(`SELECT * FROM mae_equipo_historial ORDER BY id_equipo, id_historial`); const claves = new Set(); let nHis = 0, nBase = 0;
  for (const h of HIS) {
    const eq = eqMap.get(Number(h.id_equipo)); if (!eq) { warn('historial de un equipo no cargado', h.id_equipo); continue; }
    const id = await ins('eqp_historial', { id_equipo: eq, version: t(h.version)?.slice(0, 10), codigo: (norm(h.codigo) || 'S/C').slice(0, 60), sigla: t(h.sigla)?.slice(0, 20), correlativo: num(h.correlativo) != null ? Math.round(num(h.correlativo)) : undefined,
      nombre: (norm(h.nombre) || 'S/N').slice(0, 150), sede: t(h.sede) ?? undefined, tiene_factor_correccion: yes(h.tienefc), error_0: num(h.error0), error_15: num(h.error15), error_30: num(h.error30),
      ultima_verificacion: dateOnly(h.Ultima_verificacion) ?? undefined, siguiente_verificacion: dateOnly(h.Siguiente_verificacion) ?? undefined, estado: (t(h.Estado) || 'Operativo').slice(0, 30),
      fecha_cambio: h.fecha_cambio instanceof Date ? h.fecha_cambio : undefined, motivo: cortar(h.observacion, 300, 'historial.observacion'), ...fotoEquipo(h, persMap, lugarMap) });
    claves.add(`${Number(h.id_equipo)}|${t(h.version)}`); await mapear('mae_equipo_historial', Number(h.id_historial), 'eqp_historial', id); nHis++;
  }
  for (const [idL, e] of eqFila) { const v = (t(e.version) || 'v1').slice(0, 10); if (claves.has(`${idL}|${v}`)) continue;
    const id = await ins('eqp_historial', { id_equipo: eqMap.get(idL), version: v, codigo: (norm(e.codigo) || 'S/C').slice(0, 60), sigla: t(e.sigla)?.slice(0, 20), correlativo: num(e.correlativo) != null ? Math.round(num(e.correlativo)) : undefined,
      nombre: (norm(e.nombre) || 'S/N').slice(0, 150), sede: t(e.sede) ?? undefined, tiene_factor_correccion: yes(e.tienefc), error_0: num(e.error0), error_15: num(e.error15), error_30: num(e.error30),
      ultima_verificacion: dateOnly(e.Ultima_verificacion) ?? undefined, siguiente_verificacion: dateOnly(e.Siguiente_verificacion) ?? undefined, estado: (ESTADOS.includes(norm(e.Estado)) ? norm(e.Estado) : 'Operativo'),
      motivo: 'Línea base: versión vigente al migrar (el historial legado solo guarda las versiones anteriores)', ...fotoEquipo(e, persMap, lugarMap) });
    await mapear('mae_equipo#vigente', idL, 'eqp_historial', id, `versión vigente ${v}`); nBase++; }

  /* ---------- Conciliación ---------- */
  const cnt = async (tb) => (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  const filas = [
    { tabla: 'eqp_lugar_guardado', legado: '4 sedes (muestreadores falsos)', nuevo: await cnt('eqp_lugar_guardado') },
    { tabla: 'eqp_catalogo', legado: CAT.length, nuevo: await cnt('eqp_catalogo'), ok: CAT.length === await cnt('eqp_catalogo') ? 'OK' : 'NO CUADRA' },
    { tabla: 'eqp_equipo', legado: EQ.length, nuevo: await cnt('eqp_equipo'), ok: EQ.length === await cnt('eqp_equipo') ? 'OK' : 'NO CUADRA' },
    { tabla: 'eqp_historial', legado: `${HIS.length} + ${nBase} líneas base`, nuevo: await cnt('eqp_historial'), ok: HIS.length + nBase === await cnt('eqp_historial') ? 'OK' : 'NO CUADRA' } ];
  console.log(`\n== CONCILIACIÓN eqp_ (${APPLY ? 'con --apply' : 'ENSAYO, se revierte'}) ==`); console.table(filas);
  const nMap = (await run(`SELECT COUNT(*) n FROM mig_id_map WHERE tabla_nueva LIKE 'eqp[_]%'`))[0].n; const esp = lugarMap.size + catMap.size + eqMap.size + nHis + nBase;
  console.log(`mig_id_map (eqp_): ${nMap} (esperado ${esp}) → ${nMap === esp ? 'OK' : 'NO CUADRA'}`);
  console.log(`\n== CUSTODIA (666 equipos) == a una persona: ${custodia.persona} | guardados en un lugar: ${custodia.lugar} | sin custodio: ${custodia.ninguna}`);
  const est = await run(`SELECT estado, COUNT(*) equipos FROM eqp_equipo GROUP BY estado ORDER BY 2 DESC`); const estL = await L(`SELECT ISNULL(RTRIM(Estado),'(sin estado)') estado, COUNT(*) n FROM mae_equipo GROUP BY Estado`);
  console.log('\n== ESTADOS: legado vs nuevo =='); console.table(estL.map((x) => ({ estado_legado: x.estado, legado: x.n, nuevo: est.find((y) => y.estado === (x.estado === '(sin estado)' ? 'Operativo' : x.estado))?.equipos ?? 0 })));
  const lug = await run(`SELECT l.nombre lugar, COUNT(*) equipos FROM eqp_equipo e JOIN eqp_lugar_guardado l ON l.id=e.id_lugar_guardado GROUP BY l.nombre ORDER BY 2 DESC`); console.log('== GUARDADOS =='); console.table(lug);
  /* Resolución de los usos de equipo de las fichas (para la próxima carga) */
  const EQM = await L(`SELECT DISTINCT id_equipo, version FROM App_Ma_Equipos_MUESTREOS`); const his = new Set((await run(`SELECT h.version, m.id_legado FROM eqp_historial h JOIN mig_id_map m ON m.id_nuevo=h.id_equipo AND m.tabla_legado='mae_equipo'`)).map((r) => `${Number(r.id_legado)}|${r.version}`));
  const exactos = EQM.filter((r) => his.has(`${Number(r.id_equipo)}|${t(r.version)}`)).length;
  console.log(`\n== USOS DE EQUIPO EN FICHAS == pares (equipo, versión) distintos: ${EQM.length} | con la versión exacta en eqp_historial: ${exactos} | versión inexistente (usarán la vigente): ${EQM.length - exactos}`);
  const sinEq = EQM.filter((r) => !eqMap.has(Number(r.id_equipo))).length; console.log(`usos con equipo sin equivalente: ${sinEq}`);
  console.log('deshabilitados pero "Operativo" (dos ejes distintos en el legado):', (await run(`SELECT COUNT(*) n FROM eqp_equipo WHERE habilitado=0 AND estado='Operativo'`))[0].n);
  const dups = await run(`SELECT COUNT(*) n FROM revision_duplicado WHERE entidad='EQP_EQUIPO'`); console.log('revision_duplicado (EQP_EQUIPO, PENDIENTE):', dups[0].n);
  if (warns.size) { console.log('\n== AVISOS =='); for (const [k, w] of warns) console.log(`- ${k}: ${w.n}  ej: ${w.ej.join(' | ')}`); }

  if (APPLY) { await tx.commit(); console.log('\nCOMMIT realizado en', TEST_DB); } else { await tx.rollback(); console.log('\nROLLBACK (ensayo): no se guardó nada. Usa --apply para confirmar.'); }
} catch (e) {
  try { await tx.rollback(); } catch {}
  console.error('\nERROR — se revirtió todo:', e.message); process.exitCode = 1;
} finally { await leg.close(); await dst.close(); }
