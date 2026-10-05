/* =====================================================================
   Migración del módulo geo_ : legado (PruebasInformatica) → esquema v5
   =====================================================================
   Uso:
     node src/scripts/migracion-geo.mjs                 → ensayo: carga y hace ROLLBACK
     node src/scripts/migracion-geo.mjs --apply         → carga y confirma (COMMIT)
     node src/scripts/migracion-geo.mjs --apply --reset → borra lo geo_ previo y recarga

   SEGURIDAD: del legado solo lee; solo escribe en una base cuyo nombre contenga
   "TEST" (MIG_TEST_DB, por defecto "ADL ONE TEST"); una transacción, sin --apply
   termina en ROLLBACK.

   REGLAS (cada una verificada con los datos reales; ver task.md)
     - Se omiten las filas "No aplica" / "No informado": en el esquema nuevo eso es NULL.
     - Nombres: se recortan y se colapsan espacios; se fusionan los repetidos por nombre.
     - mae_zonas → geo_zona;  mae_zonageografica → geo_sector;  mae_barrio → geo_barrio (por código).
     - mae_tipoagua: 'agrupa' → grupo (AD/AM/AE); se omite la fila basura sin uso.
     - Región de cada comuna: mae_comuna NO la trae. Se asigna con el mapeo explícito
       REGION_DE_COMUNA (97 comunas) y se contrasta con la mayoría de los centros del legado.
     - Cada id legado queda en mig_id_map (varios ids legado pueden apuntar a un mismo id nuevo).
   ===================================================================== */
import dotenv from 'dotenv'; dotenv.config();
import sql from 'mssql';

const APPLY = process.argv.includes('--apply');
const RESET = process.argv.includes('--reset');
const TEST_DB = process.env.MIG_TEST_DB || 'ADL ONE TEST';
if (!/TEST/i.test(TEST_DB)) { console.error(`ABORTADO: la base destino "${TEST_DB}" no contiene "TEST".`); process.exit(1); }

// comuna (id legado) → región (id legado de mae_region): mapeo compartido con el motor de sincronización.
import { REGION_DE_COMUNA } from '../sync/datos/regionDeComuna.js';

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
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const key = (s) => norm(s).toLowerCase();
const placeholder = (s) => norm(s) === '' || /^no\s*(aplica|informado)$/i.test(norm(s));
const yes = (v) => { const x = norm(v); return x === '' ? true : /^(S|SI|1)$/i.test(x); };

const stats = []; const maps = {}; const excluidosPorTabla = {};
/* Carga un catálogo plano: omite lo excluido, fusiona por nombre y registra mig_id_map. */
async function cargar({ legado, nueva, filas, id, nombre, extra = () => ({}), excluir = () => null, nombreCol = 'nombre', maxLen }) {
  const vistos = new Map(); const mapa = new Map(); let exc = 0, fus = 0, nue = 0; const excl = [];
  for (const r of filas) {
    const nom = norm(nombre(r)); const motivo = excluir(r, nom);
    if (motivo) { exc++; excl.push({ id: Number(r[id]), nombre: nom, motivo }); continue; }
    if (maxLen && nom.length > maxLen) throw new Error(`${legado}: el nombre de ${r[id]} excede ${maxLen} caracteres`);
    let nuevo = vistos.get(key(nom)); let nota = null;
    if (nuevo == null) { nuevo = await ins(nueva, { [nombreCol]: nom, ...extra(r) }); vistos.set(key(nom), nuevo); nue++; }
    else { fus++; nota = `fusionado por nombre con otro id legado ("${nom}")`; }
    mapa.set(Number(r[id]), nuevo);
    await run(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo, nota) VALUES (@a,@b,@c,@d,@e)`, { a: legado, b: Number(r[id]), c: nueva, d: nuevo, e: nota });
  }
  maps[legado] = mapa; excluidosPorTabla[legado] = excl;
  stats.push({ tabla_legado: legado, tabla_nueva: nueva, legado: filas.length, omitidas: exc, fusionadas: fus, cargadas: nue, verificacion: filas.length === exc + fus + nue ? 'OK' : 'NO CUADRA' });
}

try {
  const TABLAS = ['geo_zona', 'geo_sector', 'geo_barrio', 'geo_tipo_agua', 'geo_zona_utm', 'geo_unidad_medida', 'geo_comuna', 'geo_region'];
  // Secuencial: una transacción usa UNA conexión y no admite consultas en paralelo (colgaba el script).
  let previo = 0; for (const t of TABLAS) previo += (await run(`SELECT COUNT(*) n FROM ${t}`))[0].n;
  if (previo > 0 && !RESET) throw new Error('Las tablas geo_ ya tienen datos. Usa --reset para borrarlas y recargar.');
  if (RESET) { await run(`DELETE FROM mig_id_map WHERE tabla_nueva LIKE 'geo[_]%'`); for (const t of TABLAS) await run(`DELETE FROM ${t}`); }

  const RE = await L(`SELECT * FROM mae_region ORDER BY id_region`);
  const CO = await L(`SELECT * FROM mae_comuna ORDER BY id_comuna`);
  /* 1) regiones */
  await cargar({ legado: 'mae_region', nueva: 'geo_region', filas: RE, id: 'id_region', nombre: (r) => r.nombre_region,
    extra: (r) => ({ numero_romano: norm(r.numero) && norm(r.numero) !== '0' ? norm(r.numero).slice(0, 10) : null, habilitado: yes(r.habilitado) }),
    excluir: (r, n) => (placeholder(n) ? 'placeholder (pasa a NULL)' : null), maxLen: 100 });
  /* 2) comunas → región por mapeo explícito */
  const sinMapa = CO.filter((c) => !placeholder(c.nombre_comuna) && !REGION_DE_COMUNA.has(Number(c.id_comuna)));
  if (sinMapa.length) throw new Error(`Comunas sin región asignada en REGION_DE_COMUNA: ${sinMapa.map((c) => `${c.id_comuna}:${norm(c.nombre_comuna)}`).join(', ')}`);
  const vistosC = new Map(); const mapaC = new Map(); let exC = 0, fuC = 0, nuC = 0;
  for (const c of CO) {
    const nom = norm(c.nombre_comuna); if (placeholder(nom)) { exC++; excluidosPorTabla.mae_comuna = [...(excluidosPorTabla.mae_comuna || []), { id: Number(c.id_comuna), nombre: nom }]; continue; }
    const reg = maps.mae_region.get(REGION_DE_COMUNA.get(Number(c.id_comuna))); if (!reg) throw new Error(`Región ${REGION_DE_COMUNA.get(Number(c.id_comuna))} de "${nom}" no cargada`);
    const k = `${reg}|${key(nom)}`; let nuevo = vistosC.get(k); let nota = 'región asignada por mapeo explícito (revisión pendiente)';
    if (nuevo == null) { nuevo = await ins('geo_comuna', { id_region: reg, nombre: nom, habilitado: yes(c.habilitado) }); vistosC.set(k, nuevo); nuC++; } else { fuC++; nota = 'fusionado por nombre y región'; }
    mapaC.set(Number(c.id_comuna), nuevo);
    await run(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo, nota) VALUES ('mae_comuna',@b,'geo_comuna',@d,@e)`, { b: Number(c.id_comuna), d: nuevo, e: nota });
  }
  maps.mae_comuna = mapaC; stats.push({ tabla_legado: 'mae_comuna', tabla_nueva: 'geo_comuna', legado: CO.length, omitidas: exC, fusionadas: fuC, cargadas: nuC, verificacion: CO.length === exC + fuC + nuC ? 'OK' : 'NO CUADRA' });

  /* 3) resto de catálogos */
  await cargar({ legado: 'mae_zonas', nueva: 'geo_zona', filas: await L(`SELECT * FROM mae_zonas ORDER BY id_zona`), id: 'id_zona', nombre: (r) => r.nombre_zona,
    excluir: (r, n) => (placeholder(n) ? 'placeholder o vacío' : null), maxLen: 150 });
  await cargar({ legado: 'mae_zonageografica', nueva: 'geo_sector', filas: await L(`SELECT * FROM mae_zonageografica ORDER BY id_zonageografica`), id: 'id_zonageografica', nombre: (r) => r.nombre_zonageografica,
    excluir: (r, n) => (placeholder(n) ? 'placeholder o vacío' : null), maxLen: 250 });
  await cargar({ legado: 'mae_tipoagua', nueva: 'geo_tipo_agua', filas: await L(`SELECT * FROM mae_tipoagua ORDER BY id_tipoagua`), id: 'id_tipoagua', nombre: (r) => r.nombre_tipoagua,
    extra: (r) => ({ grupo: ['AD', 'AM', 'AE'].includes(norm(r.agrupa)) ? norm(r.agrupa) : null }),
    excluir: (r, n) => (placeholder(n) ? 'placeholder (pasa a NULL)' : /sin nombre\/barrio/i.test(n) ? 'fila basura sin uso' : null), maxLen: 80 });
  await cargar({ legado: 'mae_zonautm', nueva: 'geo_zona_utm', filas: await L(`SELECT * FROM mae_zonautm ORDER BY id_zonautm`), id: 'id_zonautm', nombre: (r) => r.nombre_zonautm,
    extra: (r) => ({ habilitado: yes(r.habilitado) }), excluir: (r, n) => (placeholder(n) ? 'placeholder (pasa a NULL)' : null), maxLen: 10 });
  await cargar({ legado: 'mae_umedida', nueva: 'geo_unidad_medida', filas: await L(`SELECT * FROM mae_umedida ORDER BY id_umedida`), id: 'id_umedida', nombre: (r) => r.nombre_umedida,
    excluir: (r, n) => (n.toUpperCase() === 'NA' || placeholder(n) ? 'placeholder (pasa a NULL)' : null), maxLen: 40 });
  /* barrio: el dato útil es el CÓDIGO (el nombre casi siempre está en blanco) */
  const BA = await L(`SELECT * FROM mae_barrio ORDER BY id_barrio`);
  await cargar({ legado: 'mae_barrio', nueva: 'geo_barrio', filas: BA, id: 'id_barrio', nombre: (r) => r.codigo_barrio, nombreCol: 'codigo',
    extra: (r) => ({ nombre: norm(r.nombre_barrio) || null }), excluir: (r, n) => (n === '' || /^(NA|NI)$/i.test(n) ? 'placeholder (pasa a NULL)' : null), maxLen: 10 });

  /* ---------- Conciliación ---------- */
  console.log(`\n== CONCILIACIÓN geo_ (${APPLY ? 'con --apply' : 'ENSAYO, se revierte'}) ==`); console.table(stats);
  const nMap = (await run(`SELECT COUNT(*) n FROM mig_id_map WHERE tabla_nueva LIKE 'geo[_]%'`))[0].n;
  const esperadoMap = stats.reduce((s, x) => s + x.legado - x.omitidas, 0);
  console.log(`filas en mig_id_map: ${nMap} (esperado ${esperadoMap}) → ${nMap === esperadoMap ? 'OK' : 'NO CUADRA'}`);
  console.log('\n== FILAS OMITIDAS (pasan a NULL en los centros) ==');
  for (const [t, ex] of Object.entries(excluidosPorTabla)) if (ex.length) console.log(`${t}: ${ex.map((x) => `${x.id}="${x.nombre}"`).join(' | ')}`.slice(0, 400));

  /* Comuna → región: mapeo explícito frente a la mayoría de los centros del legado */
  const may = await L(`WITH p AS (SELECT id_comuna, id_region, COUNT(*) n FROM mae_centro WHERE id_comuna>0 AND id_region>0 GROUP BY id_comuna,id_region), r AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY id_comuna ORDER BY n DESC) rn FROM p) SELECT id_comuna, id_region, n FROM r WHERE rn=1`);
  const dif = may.filter((m) => REGION_DE_COMUNA.has(Number(m.id_comuna)) && REGION_DE_COMUNA.get(Number(m.id_comuna)) !== Number(m.id_region));
  const nomC = new Map(CO.map((c) => [Number(c.id_comuna), norm(c.nombre_comuna)])), nomR = new Map(RE.map((r) => [Number(r.id_region), norm(r.nombre_region)]));
  console.log(`\n== REGIÓN DE LA COMUNA: mapeo explícito vs mayoría de los centros (${dif.length} discrepancias de ${may.length} comunas con datos) ==`);
  for (const m of dif) console.log(`- ${nomC.get(Number(m.id_comuna))}: mapeo=${nomR.get(REGION_DE_COMUNA.get(Number(m.id_comuna)))} | mayoría de centros=${nomR.get(Number(m.id_region))} (${m.n} centros)`);

  /* Efecto sobre los centros: valores que pasarán a NULL */
  const efecto = [];
  for (const [col, tabla] of [['id_region', 'mae_region'], ['id_comuna', 'mae_comuna'], ['id_zona', 'mae_zonas'], ['id_zonageografica', 'mae_zonageografica'], ['id_barrio', 'mae_barrio'], ['id_tipoagua', 'mae_tipoagua']]) {
    const ids = [...maps[tabla].keys()]; const filaC = (await L(`SELECT ${col} v, COUNT(*) n FROM mae_centro GROUP BY ${col}`));
    const conValor = filaC.filter((x) => x.v != null && Number(x.v) !== 0), total = conValor.reduce((s, x) => s + x.n, 0);
    const mapeados = conValor.filter((x) => ids.includes(Number(x.v))).reduce((s, x) => s + x.n, 0);
    efecto.push({ columna_de_mae_centro: col, centros_con_valor: total, se_conservan: mapeados, pasan_a_NULL: total - mapeados });
  }
  console.log('\n== EFECTO SOBRE mae_centro (8.285 centros) =='); console.table(efecto);

  if (APPLY) { await tx.commit(); console.log('\nCOMMIT realizado en', TEST_DB); } else { await tx.rollback(); console.log('\nROLLBACK (ensayo): no se guardó nada. Usa --apply para confirmar.'); }
} catch (e) {
  try { await tx.rollback(); } catch {}
  console.error('\nERROR — se revirtió todo:', e.message); process.exitCode = 1;
} finally { await leg.close(); await dst.close(); }
