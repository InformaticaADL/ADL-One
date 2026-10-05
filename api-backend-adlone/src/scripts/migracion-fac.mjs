/* =====================================================================
   Migración del módulo fac_ (PRECIOS): legado (PruebasInformatica) → esquema v5
   =====================================================================
   Uso:
     node src/scripts/migracion-fac.mjs                 → ensayo: carga y hace ROLLBACK
     node src/scripts/migracion-fac.mjs --apply         → carga y confirma (COMMIT)
     node src/scripts/migracion-fac.mjs --apply --reset → borra lo fac_ (precios) previo y recarga

   Requiere: parche 8_patch_fac.sql aplicado; geo_, cat_ y cli_ ya migrados.
   SEGURIDAD: del legado solo lee; solo escribe en una base cuyo nombre contenga "TEST";
   una transacción; sin --apply termina en ROLLBACK.

   ALCANCE (esta etapa): lista de precios base, convenios y sus tarifas.
   NO incluye todavía cotizaciones, prefacturas, emisiones, órdenes de compra, lotes, UF ni
   configuración por cliente (tablas transaccionales; ver task.md).

   REGLAS (verificadas con los datos reales)
     - Lista base: mae_tecnica.precio_lista > 0 → fac_lista_precio_tecnica (vigente desde la migración).
       Las otras columnas de precio (_adl, _mas, _menos, _us, vta_*) NO se cargan: su significado
       está pendiente de confirmar con el negocio.
     - Convenio (fac_convenio legado): el precio es ABSOLUTO (no es descuento sobre lista).
       id_programama vale 0 en los 1.000 → no se migra. Sin servicio resoluble en cli_ → no se carga.
       Centro 0 o inexistente en el legado → sin centro (convenio para todo el servicio).
     - Tarifa → fac_convenio_precio con su "tabla" (id_tabla_legado + nombre). Técnica fuera de
       las 382 de cat_ → no se carga (se informa). Precio 0 se carga tal cual.
     - Dos o más convenios HABILITADOS con el mismo (servicio, centro) → cola de revisión
       (FAC_CONVENIO / MISMA_DIMENSION): no se elige ganador solo.
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
const yes = (v) => /^(S|SI|1|TRUE)$/i.test(norm(v)) || v === true || v === 1;
const warns = new Map(); const warn = (k, ej) => { const w = warns.get(k) || { n: 0, ej: [] }; w.n++; if (w.ej.length < 4 && ej != null) w.ej.push(ej); warns.set(k, w); };

try {
  if (!(await run(`SELECT COL_LENGTH('fac_convenio_precio','id_tabla_legado') AS c`))[0].c) throw new Error('Falta el parche 8_patch_fac.sql (columna fac_convenio_precio.id_tabla_legado). Ejecútalo en SSMS sobre la base de prueba.');
  const TABLAS = ['fac_convenio_precio', 'fac_convenio', 'fac_lista_precio_tecnica', 'fac_lista_precio'];
  let previo = 0; for (const tb of TABLAS) previo += (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  if (previo > 0 && !RESET) throw new Error('Las tablas fac_ (precios) ya tienen datos. Usa --reset para borrarlas y recargar.');
  if (RESET) {
    await run(`DELETE FROM revision_duplicado WHERE entidad='FAC_CONVENIO'`);
    await run(`DELETE FROM mig_id_map WHERE tabla_nueva IN ('fac_lista_precio','fac_lista_precio_tecnica','fac_convenio','fac_convenio_precio')`);
    for (const tb of TABLAS) await run(`DELETE FROM ${tb}`);
  }
  if (process.argv.includes('--solo-reset')) { // vacía los precios y termina (necesario antes de recargar cli_: los convenios apuntan a servicios y centros)
    if (!APPLY) { console.log('Ensayo de --solo-reset: se revierte. Agrega --apply para confirmar.'); await tx.rollback(); } else { await tx.commit(); console.log('Precios fac_ vaciados en', TEST_DB); }
    await leg.close(); await dst.close(); process.exit(0);
  }
  const desdeMapa = async (tl) => new Map((await run(`SELECT id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado=@t`, { t: tl })).map((r) => [Number(r.id_legado), r.id_nuevo]));
  const TEC = await desdeMapa('mae_tecnica'), SRV = await desdeMapa('mae_empresaservicios'), CEN = await desdeMapa('mae_centro'), EMP = await desdeMapa('mae_empresa');
  if (!TEC.size || !SRV.size) throw new Error('Faltan cat_ o cli_ (mig_id_map sin mae_tecnica / mae_empresaservicios).');
  const padreSrv = new Map((await run(`SELECT s.id, s.id_empresa FROM cli_empresa_servicio s`)).map((r) => [r.id, r.id_empresa]));

  /* ---------- 1. Lista de precios base ---------- */
  const idLista = await ins('fac_lista_precio', { nombre: 'Lista base (migrada de mae_tecnica.precio_lista)', descripcion: 'Precio de catálogo por técnica, copiado del legado al migrar. Las variantes _adl/_mas/_menos/_us y vta_* no se migraron.', vigencia_desde: new Date(), es_activa: true });
  await mapear('mae_tecnica#precio_lista', 0, 'fac_lista_precio', idLista);
  const TECNICAS = await L(`SELECT id_tecnica, precio_lista FROM mae_tecnica WHERE TRY_CAST(precio_lista AS FLOAT) > 0 ORDER BY id_tecnica`);
  let nLista = 0, sumLista = 0;
  for (const x of TECNICAS) { const tec = TEC.get(Number(x.id_tecnica)); if (!tec) { warn('técnica con precio de lista fuera de cat_', x.id_tecnica); continue; }
    const p = num(x.precio_lista); const id = await ins('fac_lista_precio_tecnica', { id_lista_precio: idLista, id_tecnica: tec, precio_uf: p }); await mapear('mae_tecnica#precio_lista', Number(x.id_tecnica), 'fac_lista_precio_tecnica', id); nLista++; sumLista += p; }

  /* ---------- 2. Convenios ---------- */
  const CV = await L(`SELECT * FROM fac_convenio ORDER BY id_convenio`);
  const TF = await L(`SELECT * FROM fac_tarifa ORDER BY id_tarifa`);
  const tarifasPor = new Map(); for (const f of TF) tarifasPor.set(Number(f.id_convenio), (tarifasPor.get(Number(f.id_convenio)) || 0) + 1);
  let tablas = new Map(); try { tablas = new Map((await L(`SELECT id_tablama, nombre_tablama FROM LaboratorioADL.dbo.mae_tablama`)).map((r) => [Number(r.id_tablama), t(r.nombre_tablama)])); } catch (e) { warn('sin acceso a LaboratorioADL.mae_tablama: las tablas quedan solo con su id', e.message.slice(0, 60)); }
  const cvMap = new Map(), cvFila = new Map(); const noCargados = [];
  for (const c of CV) {
    const idL = Number(c.id_convenio); const srv = SRV.get(Number(c.id_empresaservicio));
    if (!srv) { noCargados.push({ id: idL, motivo: `servicio ${c.id_empresaservicio} no existe en cli_`, hab: yes(c.habilitado), tarifas: tarifasPor.get(idL) || 0 }); continue; }
    const cenL = Number(c.id_centro); const cen = cenL > 0 ? CEN.get(cenL) : null; if (cenL > 0 && !cen) warn('convenio con centro inexistente (queda sin centro: aplica a todo el servicio)', `${idL}: ${cenL}`);
    const emp = EMP.get(Number(c.id_empresa)); if (emp && padreSrv.get(srv) && emp !== padreSrv.get(srv)) warn('convenio: la empresa indicada no es la del servicio (se usa el servicio)', idL);
    const id = await ins('fac_convenio', { nombre: (t(c.nombre) || `Convenio ${idL}`).slice(0, 150), id_empresa_servicio: srv, id_centro: cen ?? undefined, aplica_sobre: 'absoluto', prioridad: 10,
      vigencia_desde: c.vigencia_desde instanceof Date ? c.vigencia_desde : undefined, vigencia_hasta: c.vigencia_hasta instanceof Date ? c.vigencia_hasta : undefined, habilitado: yes(c.habilitado) });
    cvMap.set(idL, id); cvFila.set(idL, { ...c, srv, cen }); await mapear('fac_convenio', idL, 'fac_convenio', id);
  }

  /* ---------- 3. Tarifas → precios de convenio ---------- */
  let nTar = 0, sumTar = 0, sumLeg = 0, sinTec = 0, sinConv = 0; const vistas = new Map(); const tecFuera = new Set();
  for (const f of TF) {
    const conv = cvMap.get(Number(f.id_convenio)); if (!conv) { sinConv++; continue; }
    const tec = TEC.get(Number(f.id_tecnica)); if (!tec) { sinTec++; tecFuera.add(Number(f.id_tecnica)); continue; }
    const tab = Number(f.id_tablama); const k = `${conv}|${tec}|${tab}`;
    if (vistas.has(k)) { warn('tarifa repetida para (convenio, técnica, tabla): se conserva la última', k); }
    const precio = num(f.uf_individual); if (precio == null) { warn('tarifa sin precio', f.id_tarifa); continue; }
    if (vistas.has(k)) { await run(`UPDATE fac_convenio_precio SET precio_uf=@p WHERE id=@i`, { p: precio, i: vistas.get(k) }); continue; }
    const id = await ins('fac_convenio_precio', { id_convenio: conv, id_tecnica: tec, tipo_precio: 'precio_fijo', precio_uf: precio, id_tabla_legado: tab, nombre_tabla: (tablas.get(tab) || undefined)?.slice(0, 150) });
    vistas.set(k, id); await mapear('fac_tarifa', Number(f.id_tarifa), 'fac_convenio_precio', id); nTar++; sumTar += precio; sumLeg += precio;
  }

  /* ---------- 4. Cola: convenios habilitados con la misma dimensión ---------- */
  const grupos = new Map();
  for (const [idL, c] of cvFila) if (yes(c.habilitado)) { const k = `${c.srv}|${c.cen ?? 0}`; (grupos.get(k) || grupos.set(k, []).get(k)).push(idL); }
  let nPares = 0;
  for (const g of grupos.values()) { if (g.length < 2) continue;
    g.sort((a, b) => (tarifasPor.get(b) || 0) - (tarifasPor.get(a) || 0) || a - b);
    for (const o of g.slice(1)) { const A = cvFila.get(g[0]), B = cvFila.get(o);
      await ins('revision_duplicado', { entidad: 'FAC_CONVENIO', id_registro_a: cvMap.get(g[0]), id_registro_b: cvMap.get(o), criterio: 'MISMA_DIMENSION',
        detalle_json: JSON.stringify({ a: { legado_id: g[0], nombre: t(A.nombre), tarifas: tarifasPor.get(g[0]) || 0, habilitado: true, fichas: 0 }, b: { legado_id: o, nombre: t(B.nombre), tarifas: tarifasPor.get(o) || 0, habilitado: true, fichas: 0 } }),
        observacion: 'Dos convenios habilitados para el mismo servicio y centro: el motor de precios no sabría cuál aplicar' }); nPares++; } }

  /* ---------- Conciliación ---------- */
  const cuenta = async (tb) => (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  const legTar = TF.filter((f) => cvMap.has(Number(f.id_convenio)) && TEC.has(Number(f.id_tecnica))).length;
  console.log(`\n== Conciliación (${APPLY ? 'APLICAR' : 'ENSAYO'} en [${TEST_DB}]) ==`);
  console.table([
    { tabla: 'lista_precio_tecnica', legado: `${TECNICAS.length} con precio_lista>0`, nuevo: await cuenta('fac_lista_precio_tecnica') },
    { tabla: 'convenios', legado: CV.length, nuevo: await cuenta('fac_convenio') },
    { tabla: 'tarifas → convenio_precio', legado: `${TF.length} (cargables: ${legTar})`, nuevo: await cuenta('fac_convenio_precio') },
  ]);
  const suma = (await run(`SELECT CAST(SUM(precio_uf) AS DECIMAL(18,3)) s FROM fac_convenio_precio`))[0].s;
  const sumaLeg = TF.filter((f) => cvMap.has(Number(f.id_convenio)) && TEC.has(Number(f.id_tecnica))).reduce((a, f) => a + Number(f.uf_individual), 0);
  console.log(`suma de precios UF: legado(cargables)=${sumaLeg.toFixed(3)} nuevo=${suma} ${Math.abs(sumaLeg - suma) < 0.01 ? 'OK' : 'DIFERENCIA (por repetidas)'}`);
  console.log(`convenios no cargados: ${noCargados.length} (habilitados: ${noCargados.filter((x) => x.hab).length}, tarifas afectadas: ${noCargados.reduce((a, x) => a + x.tarifas, 0)})`);
  console.log(`tarifas no cargadas: técnica fuera de cat_ = ${sinTec} filas (${tecFuera.size} técnicas); de convenios no cargados = ${sinConv}`);
  console.log(`pares para revisar (FAC_CONVENIO): ${nPares}`);
  console.log('\n== Advertencias =='); for (const [k, w] of warns) console.log(`  ${w.n} × ${k}${w.ej.length ? '  ej: ' + w.ej.join(' | ') : ''}`);
  if (noCargados.length) { console.log('\n== Convenios no cargados =='); console.table(noCargados); }
  if (APPLY) { await tx.commit(); console.log('\nCOMMIT realizado.'); } else { await tx.rollback(); console.log('\nENSAYO: ROLLBACK (nada se guardó). Usa --apply para confirmar.'); }
} catch (e) { try { await tx.rollback(); } catch { /* cerrada */ } console.error('\nERROR (ROLLBACK):', e.message); process.exitCode = 1; }
finally { await leg.close(); await dst.close(); }
