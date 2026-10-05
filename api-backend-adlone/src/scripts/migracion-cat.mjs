/* =====================================================================
   Migración del módulo cat_ : legado (PruebasInformatica) → esquema v5
   =====================================================================
   Uso:
     node src/scripts/migracion-cat.mjs                 → ensayo: carga y hace ROLLBACK
     node src/scripts/migracion-cat.mjs --apply         → carga y confirma (COMMIT)
     node src/scripts/migracion-cat.mjs --apply --reset → borra lo cat_ previo y recarga

   SEGURIDAD: del legado solo lee; solo escribe en una base cuyo nombre contenga
   "TEST"; una transacción; sin --apply termina en ROLLBACK.

   ALCANCE Y REGLAS (verificadas con los datos reales; ver task.md)
     - Solo las 382 técnicas de Medio Ambiente: las que tienen límites en
       App_Ma_ReferenciaAnalisis (las 41 de las fichas existentes están incluidas).
       Las otras 669 de mae_tecnica son del área de Laboratorio (fuera de alcance).
     - Tipo de técnica: NO sale de id_tipotecnica (vale 1 en todas) sino del texto
       'tipotecnica' (+ 'grupotecnica'); 153 técnicas no tienen tipo → NULL.
     - Sección: solo las referenciadas por técnicas MA (una: MEDIO AMBIENTE / centro de costo MAM).
     - Normativas y referencias: se omite la fila vacía (id 0) y sus dependientes.
     - Packs (cat_pack_*): el legado no tiene ninguno (concepto nuevo del diseño de precios): quedan vacíos.
     - Cada id legado queda en mig_id_map (mae_tecnica, mae_Normativa, mae_NormativaReferencia,
       App_Ma_ReferenciaAnalisis).
   ===================================================================== */
import dotenv from 'dotenv'; dotenv.config();
import sql from 'mssql';

const APPLY = process.argv.includes('--apply');
const RESET = process.argv.includes('--reset');
const TEST_DB = process.env.MIG_TEST_DB || 'ADL ONE TEST';
if (!/TEST/i.test(TEST_DB)) { console.error(`ABORTADO: la base destino "${TEST_DB}" no contiene "TEST".`); process.exit(1); }

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
const yes = (v, def = false) => { const x = norm(v); return x === '' ? def : /^(S|SI|1|TRUE)$/i.test(x); };
const placeholder = (s) => norm(s) === '' || /^no\s*(aplica|informado)$/i.test(norm(s));
const stats = []; const warns = new Map();
const warn = (k, ej) => { const w = warns.get(k) || { n: 0, ej: [] }; w.n++; if (w.ej.length < 4 && ej != null) w.ej.push(ej); warns.set(k, w); };
const mapaGeo = new Map(); // mae_umedida (legado) → geo_unidad_medida (nuevo), ya migrado por geo_

try {
  const TABLAS = ['cat_referencia_analisis', 'cat_normativa_referencia', 'cat_normativa', 'cat_pack_tecnica', 'cat_pack_analisis', 'cat_tecnica', 'cat_seccion_laboratorio', 'cat_tipo_tecnica'];
  let previo = 0; for (const tb of TABLAS) previo += (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  if (previo > 0 && !RESET) throw new Error('Las tablas cat_ ya tienen datos. Usa --reset para borrarlas y recargar.');
  if (RESET) {
    await run(`DELETE FROM mig_id_map WHERE tabla_nueva LIKE 'cat[_]%'`);
    for (const tb of TABLAS) { try { await run(`DELETE FROM ${tb}`); } catch (e) { throw new Error(`No se pudo vaciar ${tb}: hay filas que la referencian (¿fic_ficha_analisis?). Recarga primero fic_ con --reset. Detalle: ${e.message}`); } }
  }
  const geoUM = await run(`SELECT id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado='mae_umedida'`);
  if (!geoUM.length) throw new Error('geo_ no está migrado (mig_id_map sin mae_umedida). Ejecuta antes migracion-geo.mjs.');
  for (const r of geoUM) mapaGeo.set(Number(r.id_legado), r.id_nuevo);

  /* ---------- Lectura del legado ---------- */
  const RA = await L(`SELECT * FROM App_Ma_ReferenciaAnalisis ORDER BY id_referenciaanalisis`);
  const idsMA = [...new Set(RA.map((r) => Number(r.id_tecnica)))];
  const TEC = await L(`SELECT * FROM mae_tecnica WHERE id_tecnica IN (${idsMA.join(',')}) ORDER BY id_tecnica`);
  const SEC = await L(`SELECT * FROM mae_seccion ORDER BY id_seccion`);
  const NOR = await L(`SELECT * FROM mae_Normativa ORDER BY id_normativa`);
  const REF = await L(`SELECT * FROM mae_NormativaReferencia ORDER BY id_normativareferencia`);

  /* ---------- 1. Tipos de técnica (del texto, no del id) ---------- */
  const tipos = new Map(); // nombre → {grupos: Map}
  for (const x of TEC) { const n = t(x.tipotecnica); if (!n) continue; const g = t(x.grupotecnica); const e = tipos.get(n) || new Map(); e.set(g, (e.get(g) || 0) + 1); tipos.set(n, e); }
  const tipoId = new Map();
  for (const [nombre, gr] of tipos) {
    const [grupo] = [...gr.entries()].sort((a, b) => b[1] - a[1])[0]; if (gr.size > 1) warn('tipo de técnica con más de un grupo (se usa el más frecuente)', nombre);
    tipoId.set(nombre, await ins('cat_tipo_tecnica', { nombre: nombre.slice(0, 100), grupo: grupo ? grupo.slice(0, 60) : undefined }));
  }
  stats.push({ tabla: 'cat_tipo_tecnica', legado: `${tipos.size} valores distintos de texto`, cargadas: tipoId.size });

  /* ---------- 2. Secciones referenciadas por técnicas MA ---------- */
  const idsSec = [...new Set(TEC.map((x) => Number(x.id_seccion)).filter((x) => x > 0))]; const secMap = new Map();
  for (const s of SEC.filter((s) => idsSec.includes(Number(s.id_seccion)))) {
    const ccs = [...new Set(TEC.filter((x) => Number(x.id_seccion) === Number(s.id_seccion)).map((x) => t(x.centrocosto)).filter(Boolean))];
    if (ccs.length > 1) warn('sección con más de un centro de costo (queda NULL)', `${s.id_seccion}: ${ccs.join('/')}`);
    const id = await ins('cat_seccion_laboratorio', { nombre: norm(s.nombre_seccion).slice(0, 100), centro_costo: ccs.length === 1 ? ccs[0].slice(0, 20) : undefined });
    secMap.set(Number(s.id_seccion), id); await mapear('mae_seccion', Number(s.id_seccion), 'cat_seccion_laboratorio', id);
  }
  stats.push({ tabla: 'cat_seccion_laboratorio', legado: `${idsSec.length} referenciada(s) de ${SEC.length}`, cargadas: secMap.size });

  /* ---------- 3. Técnicas ---------- */
  const tecMap = new Map(); const nombres = new Set(); const distTiempo = new Map();
  for (const x of TEC) {
    const nombre = norm(x.nombre_tecnica); if (!nombre) { warn('técnica sin nombre (no se carga)', x.id_tecnica); continue; }
    if (nombres.has(nombre.toLowerCase())) throw new Error(`Nombre de técnica repetido dentro de las técnicas MA: "${nombre}"`); nombres.add(nombre.toLowerCase());
    const um = mapaGeo.get(Number(x.id_umedida)); if (Number(x.id_umedida) > 0 && !um) warn('unidad de medida omitida por geo_ (queda NULL)', `${x.id_tecnica}: um ${x.id_umedida}`);
    const tr = num(x.tiemporespuesta); distTiempo.set(tr, (distTiempo.get(tr) || 0) + 1);
    const costo = num(x.costo_tecnica);
    const id = await ins('cat_tecnica', { nombre: nombre.slice(0, 200), id_tipo_tecnica: tipoId.get(t(x.tipotecnica)) ?? null, id_seccion: secMap.get(Number(x.id_seccion)) ?? null,
      tiempo_respuesta_hrs: tr != null ? Math.round(tr) : null, id_unidad_medida: um ?? null, metodologia: t(x.metodologia)?.slice(0, 200), costo_operativo_uf: costo && costo > 0 ? costo : null });
    tecMap.set(Number(x.id_tecnica), id); await mapear('mae_tecnica', Number(x.id_tecnica), 'cat_tecnica', id);
  }
  stats.push({ tabla: 'cat_tecnica', legado: `${TEC.length} (de 1051; las MA)`, cargadas: tecMap.size });

  /* ---------- 4. Normativas y sus referencias ---------- */
  const norMap = new Map(); const norNombres = new Set();
  for (const n of NOR) {
    const nombre = norm(n.nombre_normativa); if (placeholder(nombre)) { warn('normativa vacía omitida', n.id_normativa); continue; }
    if (norNombres.has(nombre.toLowerCase())) throw new Error(`Normativa repetida: ${nombre}`); norNombres.add(nombre.toLowerCase());
    const id = await ins('cat_normativa', { nombre: nombre.slice(0, 100), habilitado: yes(n.habilitado, true) }); norMap.set(Number(n.id_normativa), id); await mapear('mae_Normativa', Number(n.id_normativa), 'cat_normativa', id);
  }
  stats.push({ tabla: 'cat_normativa', legado: NOR.length, cargadas: norMap.size });
  const refMap = new Map(); const refKeys = new Set(); let refOm = 0;
  for (const r of REF) {
    const padre = norMap.get(Number(r.id_normativa)); const nombre = norm(r.nombre_normativareferencia);
    if (!padre || placeholder(nombre)) { refOm++; warn('referencia omitida (su normativa o su nombre está vacío)', `${r.id_normativareferencia}:"${nombre}"`); continue; }
    const k = `${padre}|${nombre.toLowerCase()}`; if (refKeys.has(k)) throw new Error(`Referencia repetida: ${nombre}`); refKeys.add(k);
    const id = await ins('cat_normativa_referencia', { id_normativa: padre, nombre: nombre.slice(0, 150), habilitado: yes(r.habilitado, true) });
    refMap.set(Number(r.id_normativareferencia), id); await mapear('mae_NormativaReferencia', Number(r.id_normativareferencia), 'cat_normativa_referencia', id);
  }
  stats.push({ tabla: 'cat_normativa_referencia', legado: REF.length, cargadas: refMap.size });

  /* ---------- 5. Límites por técnica + normativa + referencia ---------- */
  let nRA = 0; const porNorm = new Map(); const maxTrad = { v: 0 };
  for (const r of RA) {
    const tec = tecMap.get(Number(r.id_tecnica)), nor = norMap.get(Number(r.id_normativa)), ref = refMap.get(Number(r.id_normativareferencia));
    if (!tec || !nor || !ref) { warn('límite sin técnica/normativa/referencia cargada (no se carga)', r.id_referenciaanalisis); continue; }
    const t0 = t(r.traduccion_0), t1 = t(r.traduccion_1); maxTrad.v = Math.max(maxTrad.v, (t0 || '').length, (t1 || '').length);
    const id = await ins('cat_referencia_analisis', { id_tecnica: tec, id_normativa: nor, id_normativa_referencia: ref, limite_max_d: num(r.limitemax_d), limite_max_h: num(r.limitemax_h),
      lleva_error: yes(r.llevaerror), error_min: num(r.error_min), error_max: num(r.error_max), lleva_traduccion: yes(r.llevatraduccion), traduccion_0: t0?.slice(0, 60), traduccion_1: t1?.slice(0, 60),
      marca: r.marca === true || r.marca === 1, habilitado: yes(r.habilitado, true) });
    await mapear('App_Ma_ReferenciaAnalisis', Number(r.id_referenciaanalisis), 'cat_referencia_analisis', id); nRA++;
    porNorm.set(Number(r.id_normativa), (porNorm.get(Number(r.id_normativa)) || 0) + 1);
  }
  stats.push({ tabla: 'cat_referencia_analisis', legado: RA.length, cargadas: nRA });
  stats.push({ tabla: 'cat_pack_analisis / cat_pack_tecnica', legado: 'no existe en el legado', cargadas: 0 });

  /* ---------- Conciliación ---------- */
  console.log(`\n== CONCILIACIÓN cat_ (${APPLY ? 'con --apply' : 'ENSAYO, se revierte'}) ==`); console.table(stats.map((s) => ({ ...s, verificacion: typeof s.legado === 'number' ? (s.legado === s.cargadas + (s.tabla === 'cat_normativa' ? NOR.length - norMap.size : s.tabla === 'cat_normativa_referencia' ? refOm : 0) ? 'OK' : 'NO CUADRA') : '' })));
  const nMap = (await run(`SELECT COUNT(*) n FROM mig_id_map WHERE tabla_nueva LIKE 'cat[_]%'`))[0].n; const esp = secMap.size + tecMap.size + norMap.size + refMap.size + nRA;
  console.log(`mig_id_map (cat_): ${nMap} (esperado ${esp}) → ${nMap === esp ? 'OK' : 'NO CUADRA'}`);
  console.log('\n== LÍMITES POR NORMATIVA: legado vs nuevo =='); const nn = new Map(NOR.map((n) => [Number(n.id_normativa), norm(n.nombre_normativa)]));
  const nuevos = await run(`SELECT n.nombre, COUNT(*) n FROM cat_referencia_analisis r JOIN cat_normativa n ON n.id=r.id_normativa GROUP BY n.nombre`);
  console.table([...porNorm.entries()].map(([id, n]) => ({ normativa: nn.get(id), legado: RA.filter((r) => Number(r.id_normativa) === id).length, nuevo: nuevos.find((x) => x.nombre === nn.get(id))?.n ?? 0 })));
  console.log('tiempo de respuesta de las técnicas (valor → cuántas):', JSON.stringify([...distTiempo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)), '  ← UNIDAD SIN CONFIRMAR: el diseño dice horas');
  console.log('largo máximo de traducciones:', maxTrad.v, '(límite 60)');

  /* Efecto sobre lo que ya depende de técnicas */
  const det = await L(`SELECT COUNT(*) filas, COUNT(DISTINCT id_tecnica) tecnicas, SUM(CASE WHEN id_referenciaanalisis IN (${RA.map((r) => r.id_referenciaanalisis).join(',')}) THEN 1 ELSE 0 END) con_referencia_migrada FROM App_Ma_FichaIngresoServicio_DET WHERE tipo_analisis<>'CostoOperativo'`);
  const noMapDet = (await L(`SELECT DISTINCT id_tecnica FROM App_Ma_FichaIngresoServicio_DET WHERE id_tecnica IS NOT NULL`)).filter((x) => !tecMap.has(Number(x.id_tecnica))).length;
  console.log('\n== FICHAS EXISTENTES: ¿sus análisis tienen equivalente? =='); console.table([{ filas_de_analisis: det[0].filas, con_referencia_migrada: det[0].con_referencia_migrada, tecnicas_sin_equivalente: noMapDet }]);
  const tar = await L(`SELECT COUNT(*) filas, SUM(CASE WHEN id_tecnica IN (${idsMA.join(',')}) THEN 0 ELSE 1 END) fuera_de_las_382 FROM fac_tarifa`);
  console.log(`\n== AVISO PARA fac_ : fac_tarifa tiene ${tar[0].filas} filas y ${tar[0].fuera_de_las_382} son de técnicas fuera de las 382 (laboratorio) → sin equivalente en cat_tecnica ==`);
  if (warns.size) { console.log('\n== AVISOS =='); for (const [k, w] of warns) console.log(`- ${k}: ${w.n}  ej: ${w.ej.join(' | ')}`); }

  if (APPLY) { await tx.commit(); console.log('\nCOMMIT realizado en', TEST_DB); } else { await tx.rollback(); console.log('\nROLLBACK (ensayo): no se guardó nada. Usa --apply para confirmar.'); }
} catch (e) {
  try { await tx.rollback(); } catch {}
  console.error('\nERROR — se revirtió todo:', e.message); process.exitCode = 1;
} finally { await leg.close(); await dst.close(); }
