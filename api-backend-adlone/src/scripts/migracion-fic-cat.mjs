/* =====================================================================
   Migración de los CATÁLOGOS de la ficha (fic_*): legado → esquema v5
   =====================================================================
   Uso:
     node src/scripts/migracion-fic-cat.mjs                 → ensayo: carga y hace ROLLBACK
     node src/scripts/migracion-fic-cat.mjs --apply         → carga y confirma (COMMIT)
     node src/scripts/migracion-fic-cat.mjs --apply --reset → borra estos catálogos y recarga
       (antes: node src/scripts/migracion-fic.mjs --solo-reset --reset --apply)

   Requiere: parche 11_patch_fic.sql. SEGURIDAD: del legado solo lee; solo escribe en una base cuyo
   nombre contenga "TEST"; una transacción; sin --apply termina en ROLLBACK.

   Catálogos (todas las filas, también las deshabilitadas: fichas antiguas pueden citarlas):
     mae_lugaranalisis (6)          → fic_lugar_analisis      (y completa usr_usuario.id_lugar_analisis)
     mae_objetivomuestreo_ma (44)   → fic_objetivo_muestreo   (informe → tipo_informe)
     mae_instrumentoambiental (9)   → fic_instrumento_ambiental (estado V/S = habilitado; N = no)
     mae_tipomuestreo (22)          → fic_tipo_muestreo
     mae_tipomuestra_ma (8)         → fic_tipo_muestra        (Puntual, Compuesta… = id_tipomuestra_ma de la ficha)
     mae_tipomuestra (solo los COMPONENTES que usan las subáreas o las fichas: Agua, Suelo)
                                    → fic_componente          (las otras ~170 filas son tipos de muestra de laboratorio)
     mae_subarea (17)               → fic_subarea             (id_tipomuestra → id_componente)
     mae_actividadmuestreo (4), mae_tipodescarga (4), mae_modalidad (3), mae_formacanal (8),
     mae_dispositivohidraulico (3)  → fic_actividad_muestreo, fic_tipo_descarga, fic_modalidad_caudal,
                                      fic_forma_canal, fic_dispositivo_hidraulico
   Unicidad: por nombre; objetivos por (nombre, tipo de informe) y tipos de muestreo por (nombre, aplicado_a): el legado
   repite el nombre con distinto informe/ámbito y son filas distintas. Si aun así hay clave repetida, la fila de menor id
   conserva el nombre y la otra queda "nombre (id)"; ambas entran en mig_id_map con su propio id legado.
   Requiere también 12_patch_fic_unicidad.sql.
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
const mapear = (tl, il, tn, inu) => run(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES (@a,@b,@c,@d)`, { a: tl, b: il, c: tn, d: inu });
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const t = (s) => norm(s) || null;
const yes = (v) => v === true || v === 1 || /^(S|SI|V|1|TRUE)$/i.test(norm(v));
const warns = new Map(); const warn = (k, ej) => { const w = warns.get(k) || { n: 0, ej: [] }; w.n++; if (w.ej.length < 4 && ej != null) w.ej.push(ej); warns.set(k, w); };

try {
  if (!(await run(`SELECT OBJECT_ID('fic_componente') AS o`))[0].o) throw new Error('Falta el parche 11_patch_fic.sql (tabla fic_componente). Ejecútalo en SSMS sobre la base de prueba.');
  const TABLAS = ['fic_subarea', 'fic_componente', 'fic_lugar_analisis', 'fic_objetivo_muestreo', 'fic_instrumento_ambiental', 'fic_tipo_muestreo', 'fic_tipo_muestra', 'fic_actividad_muestreo', 'fic_tipo_descarga', 'fic_modalidad_caudal', 'fic_forma_canal', 'fic_dispositivo_hidraulico'];
  let previo = 0; for (const tb of TABLAS) previo += (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  if (previo > 0 && !RESET) throw new Error('Los catálogos fic_ ya tienen datos. Usa --reset para borrarlos y recargar.');
  if (RESET) {
    await run(`UPDATE usr_usuario SET id_lugar_analisis = NULL WHERE id_lugar_analisis IS NOT NULL`);
    await run(`DELETE FROM mig_id_map WHERE tabla_nueva IN (${TABLAS.map((x) => `'${x}'`).join(',')})`);
    for (const tb of TABLAS) { try { await run(`DELETE FROM ${tb}`); } catch (e) { throw new Error(`No se pudo vaciar ${tb}: hay fichas que la referencian. Ejecuta antes migracion-fic.mjs --solo-reset --reset --apply. Detalle: ${e.message}`); } }
  }

  // Carga genérica: id/nombre/habilitado (+ columnas extra) con control de nombre repetido.
  const resultado = [];
  const catalogo = async ({ tabla, origen, idCol, nombreCol, habCol, extra, destino, filtro, clave }) => {
    const filas = await L(`SELECT * FROM ${origen} ${filtro ? `WHERE ${filtro}` : ''} ORDER BY ${idCol}`); const usados = new Map(); const mapa = new Map(); let ajustados = 0;
    for (const f of filas) {
      const idL = Number(f[idCol]); let nombre = t(f[nombreCol]) || `(sin nombre ${idL})`; const max = destino.maxNombre;
      if (nombre.length > max) { warn(`${destino.tabla}: nombre recortado a ${max}`, nombre.slice(0, 30)); nombre = nombre.slice(0, max); }
      const k = (clave ? clave(f, nombre) : nombre).toLowerCase();
      if (usados.has(k)) { const nuevo = `${nombre} (${idL})`.slice(0, max); warn(`${destino.tabla}: nombre repetido (queda "nombre (id)")`, nombre); nombre = nuevo; ajustados++; }
      usados.set(k, idL);
      const extras = extra ? extra(f, mapa) : {};
      const id = await ins(destino.tabla, { nombre, habilitado: habCol ? yes(f[habCol]) : true, ...extras });
      mapa.set(idL, id); await mapear(tabla, idL, destino.tabla, id);
    }
    resultado.push({ catalogo: destino.tabla, legado: filas.length, nuevo: (await run(`SELECT COUNT(*) n FROM ${destino.tabla}`))[0].n, nombres_ajustados: ajustados });
    return mapa;
  };

  const lugar = await catalogo({ tabla: 'mae_lugaranalisis', origen: 'mae_lugaranalisis', idCol: 'id_lugaranalisis', nombreCol: 'nombre_lugaranalisis', habCol: 'habilitado', extra: (f) => ({ sigla: t(f.sigla)?.slice(0, 10) }), destino: { tabla: 'fic_lugar_analisis', maxNombre: 100 } });
  await catalogo({ tabla: 'mae_objetivomuestreo_ma', origen: 'mae_objetivomuestreo_ma', idCol: 'id_objetivomuestreo_ma', nombreCol: 'nombre_objetivomuestreo_ma', habCol: 'habilitado', extra: (f) => ({ tipo_informe: t(f.informe)?.slice(0, 80) }), clave: (f, n) => `${n}|${t(f.informe) || ''}`, destino: { tabla: 'fic_objetivo_muestreo', maxNombre: 150 } });
  await catalogo({ tabla: 'mae_instrumentoambiental', origen: 'mae_instrumentoambiental', idCol: 'id', nombreCol: 'nombre', habCol: 'estado', extra: (f) => ({ habilitado: /^V$/i.test(norm(f.estado)) }), destino: { tabla: 'fic_instrumento_ambiental', maxNombre: 100 } });   // solo 'V' se ofrece en los desplegables (verificado en ADL ONE: WHERE estado = 'V')
  await catalogo({ tabla: 'mae_tipomuestreo', origen: 'mae_tipomuestreo', idCol: 'id_tipomuestreo', nombreCol: 'nombre_tipomuestreo', habCol: 'habilitado', extra: (f) => ({ aplicado_a: t(f.aplicado_a)?.slice(0, 50) }), clave: (f, n) => `${n}|${t(f.aplicado_a) || ''}`, destino: { tabla: 'fic_tipo_muestreo', maxNombre: 100 } });
  await catalogo({ tabla: 'mae_tipomuestra_ma', origen: 'mae_tipomuestra_ma', idCol: 'id_tipomuestra_ma', nombreCol: 'nombre_tipomuestra_ma', habCol: 'habilitado', destino: { tabla: 'fic_tipo_muestra', maxNombre: 100 } });
  const comp = await catalogo({ tabla: 'mae_tipomuestra', origen: 'mae_tipomuestra', idCol: 'id_tipomuestra', nombreCol: 'nombre_tipomuestra', habCol: 'activo', destino: { tabla: 'fic_componente', maxNombre: 100 },
    filtro: `id_tipomuestra IN (SELECT id_tipomuestra FROM mae_subarea WHERE id_tipomuestra > 0 UNION SELECT id_tipomuestra FROM App_Ma_FichaIngresoServicio_ENC WHERE id_tipomuestra > 0)` });
  await catalogo({ tabla: 'mae_subarea', origen: 'mae_subarea', idCol: 'id_subarea', nombreCol: 'nombre_subarea', habCol: 'activo', extra: (f) => ({ metodologia: t(f.metodologia)?.slice(0, 300), id_componente: comp.get(Number(f.id_tipomuestra)) }), destino: { tabla: 'fic_subarea', maxNombre: 150 } });
  await catalogo({ tabla: 'mae_actividadmuestreo', origen: 'mae_actividadmuestreo', idCol: 'id_actividadmuestreo', nombreCol: 'nombre_actividadmuestreo', habCol: 'activo', destino: { tabla: 'fic_actividad_muestreo', maxNombre: 100 } });
  await catalogo({ tabla: 'mae_tipodescarga', origen: 'mae_tipodescarga', idCol: 'id_tipodescarga', nombreCol: 'nombre_tipodescarga', habCol: 'habilitado', destino: { tabla: 'fic_tipo_descarga', maxNombre: 100 } });
  await catalogo({ tabla: 'mae_modalidad', origen: 'mae_modalidad', idCol: 'id_modalidad', nombreCol: 'nombre_modalidad', habCol: 'habilitado', destino: { tabla: 'fic_modalidad_caudal', maxNombre: 100 } });
  await catalogo({ tabla: 'mae_formacanal', origen: 'mae_formacanal', idCol: 'id_formacanal', nombreCol: 'nombre_formacanal', habCol: 'habilitado', destino: { tabla: 'fic_forma_canal', maxNombre: 100 } });
  await catalogo({ tabla: 'mae_dispositivohidraulico', origen: 'mae_dispositivohidraulico', idCol: 'id_dispositivohidraulico', nombreCol: 'nombre_dispositivohidraulico', habCol: 'habilitado', destino: { tabla: 'fic_dispositivo_hidraulico', maxNombre: 100 } });

  // Lugar de análisis de los usuarios (columna que usr_ dejó pendiente hasta tener el catálogo)
  const us = await L(`SELECT id_usuario, id_lugaranalisis FROM mae_usuario WHERE id_lugaranalisis IS NOT NULL AND id_usuario > 0`); let nUs = 0, sinLugar = 0;
  for (const u of us) { const lg = lugar.get(Number(u.id_lugaranalisis)); if (!lg) { sinLugar++; continue; } nUs += (await run(`UPDATE usr_usuario SET id_lugar_analisis=@l WHERE id=@u; SELECT @@ROWCOUNT AS n`, { l: lg, u: Number(u.id_usuario) }))[0].n; }

  console.log(`\n== Conciliación (${APPLY ? 'APLICAR' : 'ENSAYO'} en [${TEST_DB}]) ==`); console.table(resultado);
  console.log(`usuarios con lugar de análisis: ${nUs} de ${us.length} (sin equivalente: ${sinLugar})`);
  const sub = await run(`SELECT COUNT(*) n, COUNT(id_componente) c FROM fic_subarea`); console.log(`subáreas con componente: ${sub[0].c} de ${sub[0].n}`);
  console.log('\n== Advertencias =='); if (!warns.size) console.log('  (ninguna)'); for (const [k, w] of warns) console.log(`  ${w.n} × ${k}${w.ej.length ? '  ej: ' + w.ej.join(' | ') : ''}`);
  if (APPLY) { await tx.commit(); console.log('\nCOMMIT realizado.'); } else { await tx.rollback(); console.log('\nENSAYO: ROLLBACK (nada se guardó). Usa --apply para confirmar.'); }
} catch (e) { try { await tx.rollback(); } catch { /* cerrada */ } console.error('\nERROR (ROLLBACK):', e.message); process.exitCode = 1; }
finally { await leg.close(); await dst.close(); }
