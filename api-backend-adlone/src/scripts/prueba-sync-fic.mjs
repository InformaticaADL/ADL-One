import 'dotenv/config'; import sql from 'mssql'; import crypto from 'node:crypto';
import { ejecutarPasada } from '../sync/motor.js';
const D = await new sql.ConnectionPool({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: 'ADL ONE TEST', requestTimeout: 120000, options: { encrypt: true, trustServerCertificate: true } }).connect();
const q = async (s, p = {}) => { const r = D.request(); for (const [k, v] of Object.entries(p)) r.input(k, v); return (await r.query(s)).recordset; };
const ok = (n, c) => console.log((c ? 'OK  ' : 'FALLA ') + n);
const TABLAS = ['fic_frecuencia', 'fic_laboratorio_ensayo', 'fic_tipo_entrega', 'fic_ficha', 'fic_ficha_analisis', 'fic_visita', 'fic_visita_proceso', 'fic_visita_medicion', 'fic_resultado', 'eqp_uso'];
// Se compara el contenido sin los ids (identity): tras una recarga los ids pueden cambiar; aquí no deberían, pero el contenido es lo que importa.
const snap = async () => { const o = {}; for (const t of TABLAS) { const r = await q(`SELECT * FROM ${t} ORDER BY id`); o[t] = `${r.length}:${crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex').slice(0, 12)}`; } return o; };
const detalle = async (t) => { const r = await q(`SELECT * FROM ${t} ORDER BY id`); return t === 'eqp_uso' ? r.map(({ id, ...x }) => x).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : r; };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pasada = async () => ejecutarPasada({ modulo: 'fic', log: (m) => console.log(m) });
const bump = (tabla, clave) => q(`UPDATE mig_sync_huella SET hash1 = hash1 + 1 WHERE tabla_legado=@t AND clave=@c`, { t: tabla, c: String(clave) });

const antes = {}; for (const t of TABLAS) antes[t] = await detalle(t); const S0 = await snap(); console.log('referencia (cargador):', JSON.stringify(S0));
// A) primera pasada: el motor debe reproducir lo que dejó el cargador (mismo contenido; ids conservados por clave natural)
let r = await pasada(); const S1 = await snap();
ok(`A. primera pasada: copió ${r.aplicados}, avisos=${r.avisos}, errores=${r.errores}`, r.errores === 0);
const cols = (a, b) => { const s = new Set(); a.forEach((x, i) => { for (const k of Object.keys(x)) if (JSON.stringify(x[k]) !== JSON.stringify(b[i]?.[k])) s.add(k); }); return [...s].join(','); };
for (const t of TABLAS) { const nuevo = await detalle(t); const dif = igual(nuevo, antes[t]); if (!dif) console.log('   columnas distintas:', cols(antes[t], nuevo)); ok(`A. ${t}: contenido ${dif ? 'idéntico al del cargador' : 'DIFIERE'} (${S1[t]} vs ${S0[t]})`, dif); }
r = await pasada(); ok(`B. segunda pasada sin cambios (copió ${r.aplicados}, borró ${r.borrados})`, r.aplicados === 0 && r.borrados === 0 && r.errores === 0);

// C) modificación en la base nueva → el motor restaura al legado (ficha, visita, resultado, uso)
const f1 = (await q(`SELECT TOP 1 f.id, f.punto_muestreo, m.id_legado FROM fic_ficha f JOIN mig_id_map m ON m.id_nuevo=f.id AND m.tabla_legado='App_Ma_FichaIngresoServicio_ENC' ORDER BY f.id`))[0];
await q(`UPDATE fic_ficha SET punto_muestreo=N'CAMBIADO' WHERE id=@i`, { i: f1.id }); await bump('App_Ma_FichaIngresoServicio_ENC', f1.id_legado);
r = await pasada(); ok(`C. ficha ${f1.id_legado} restaurada (copió ${r.aplicados})`, r.aplicados === 1 && (await q(`SELECT punto_muestreo p FROM fic_ficha WHERE id=@i`, { i: f1.id }))[0].p === f1.punto_muestreo);
const v1 = (await q(`SELECT TOP 1 id, id_agendamam_legacy a, id_estado_visita e, vdd FROM fic_visita ORDER BY id`))[0];
await q(`UPDATE fic_visita SET id_estado_visita=(SELECT TOP 1 id FROM fic_estado_visita WHERE id<>@e) WHERE id=@i`, { e: v1.e, i: v1.id }); await q(`DELETE FROM fic_visita_proceso WHERE id_visita=@i AND tipo IN (SELECT TOP 1 tipo FROM fic_visita_proceso WHERE id_visita=@i)`, { i: v1.id }).catch(() => {});
await bump('App_Ma_Agenda_MUESTREOS', v1.a);
r = await pasada(); ok(`C. visita ${v1.a} restaurada (copió ${r.aplicados}, errores=${r.errores})`, r.errores === 0 && igual(await detalle('fic_visita'), antes.fic_visita) && igual(await detalle('fic_visita_proceso'), antes.fic_visita_proceso));
const rs = (await q(`SELECT TOP 1 r.id, v.id_ficha, m.id_legado fl FROM fic_resultado r JOIN fic_visita v ON v.id=r.id_visita JOIN mig_id_map m ON m.id_nuevo=v.id_ficha AND m.tabla_legado='App_Ma_FichaIngresoServicio_ENC' ORDER BY r.id`))[0];
if (rs) { await q(`UPDATE fic_resultado SET valor_texto=N'999', cumple=NULL WHERE id=@i`, { i: rs.id }); await bump('App_Ma_Resultados', rs.fl);
  r = await pasada(); ok(`C. resultados de la ficha ${rs.fl} restaurados (copió ${r.aplicados}, errores=${r.errores})`, r.errores === 0 && igual(await detalle('fic_resultado'), antes.fic_resultado) && igual(await detalle('fic_visita'), antes.fic_visita)); }
const eu = (await q(`SELECT TOP 1 u.id, m.id_legado fl FROM eqp_uso u JOIN fic_visita v ON v.id=u.id_visita JOIN mig_id_map m ON m.id_nuevo=v.id_ficha AND m.tabla_legado='App_Ma_FichaIngresoServicio_ENC' ORDER BY u.id`))[0];
if (eu) { await q(`DELETE FROM eqp_uso WHERE id=@i`, { i: eu.id }); await bump('App_Ma_Equipos_MUESTREOS', eu.fl); r = await pasada();
  ok(`C. uso de equipos de la ficha ${eu.fl} rehecho (copió ${r.aplicados}, errores=${r.errores})`, r.errores === 0 && (await q(`SELECT COUNT(*) n FROM eqp_uso`))[0].n === antes.eqp_uso.length); }
const an = (await q(`SELECT TOP 1 a.id, a.snap_precio_uf, m.id_legado fl FROM fic_ficha_analisis a JOIN mig_id_map m ON m.id_nuevo=a.id_ficha AND m.tabla_legado='App_Ma_FichaIngresoServicio_ENC' ORDER BY a.id`))[0];
await q(`UPDATE fic_ficha_analisis SET snap_precio_uf=99 WHERE id=@i`, { i: an.id }); await bump('App_Ma_FichaIngresoServicio_DET', an.fl); r = await pasada();
ok(`C. análisis de la ficha ${an.fl} restaurados (copió ${r.aplicados}, errores=${r.errores})`, r.errores === 0 && igual(await detalle('fic_ficha_analisis'), antes.fic_ficha_analisis));

// D) alta: una ficha (con todo lo suyo) borrada de la base nueva se recrea desde el legado
const alta = (await q(`SELECT TOP 1 m.id_legado fl, m.id_nuevo fn FROM mig_id_map m WHERE m.tabla_legado='App_Ma_FichaIngresoServicio_ENC' AND NOT EXISTS (SELECT 1 FROM fac_prefactura_caso c JOIN fic_visita v ON v.id=c.id_visita WHERE v.id_ficha=m.id_nuevo) AND EXISTS (SELECT 1 FROM fic_visita v WHERE v.id_ficha=m.id_nuevo) ORDER BY m.id_legado DESC`))[0];
const nFac = (await q(`SELECT COUNT(*) n FROM fac_prefactura_caso c JOIN fic_visita v ON v.id=c.id_visita WHERE v.id_ficha=@f`, { f: alta.fn }))[0].n;
if (nFac === 0) {
  await q(`DELETE FROM eqp_uso WHERE id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@f)`, { f: alta.fn }); await q(`DELETE FROM fic_resultado WHERE id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@f)`, { f: alta.fn });
  await q(`DELETE FROM fic_visita_medicion WHERE id_proceso IN (SELECT p.id FROM fic_visita_proceso p JOIN fic_visita v ON v.id=p.id_visita WHERE v.id_ficha=@f)`, { f: alta.fn });
  for (const t of ['fic_visita_proceso', 'fic_visita_evento', 'fic_visita_documento']) await q(`DELETE FROM ${t} WHERE id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@f)`, { f: alta.fn });
  const ags = (await q(`SELECT id_agendamam_legacy a FROM fic_visita WHERE id_ficha=@f`, { f: alta.fn })).map((x) => String(x.a));
  for (const a of ags) await q(`DELETE FROM mig_sync_huella WHERE tabla_legado='App_Ma_Agenda_MUESTREOS' AND clave=@c`, { c: a });
  // rut_planificada_detalle/rut_ejecucion_detalle (fila) referencian id_ficha (y esta última, id_visita) — igual que
  // mae_ficha_historial más abajo, hay que borrar sus filas y su huella (por su propio id) antes de tocar fic_ficha/fic_visita.
  const rutPlanD = (await q(`SELECT m.id_legado FROM rut_planificada_detalle d JOIN mig_id_map m ON m.id_nuevo=d.id AND m.tabla_legado='mae_rutas_planificadas_detalle' WHERE d.id_ficha=@f`, { f: alta.fn })).map((x) => String(x.id_legado));
  await q(`DELETE FROM rut_planificada_detalle WHERE id_ficha=@f`, { f: alta.fn });
  await q(`DELETE FROM mig_id_map WHERE tabla_legado='mae_rutas_planificadas_detalle' AND id_legado IN (${rutPlanD.map((x) => `'${x}'`).join(',') || 'NULL'})`);
  await q(`DELETE FROM mig_sync_huella WHERE tabla_legado='mae_rutas_planificadas_detalle' AND clave IN (${rutPlanD.map((x) => `'${x}'`).join(',') || 'NULL'})`);
  const rutEjecD = (await q(`SELECT m.id_legado FROM rut_ejecucion_detalle d JOIN mig_id_map m ON m.id_nuevo=d.id AND m.tabla_legado='mae_rutas_ejecuciones_detalle' WHERE d.id_ficha=@f OR d.id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@f)`, { f: alta.fn })).map((x) => String(x.id_legado));
  await q(`DELETE FROM rut_ejecucion_detalle WHERE id_ficha=@f OR id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@f)`, { f: alta.fn });
  await q(`DELETE FROM mig_id_map WHERE tabla_legado='mae_rutas_ejecuciones_detalle' AND id_legado IN (${rutEjecD.map((x) => `'${x}'`).join(',') || 'NULL'})`);
  await q(`DELETE FROM mig_sync_huella WHERE tabla_legado='mae_rutas_ejecuciones_detalle' AND clave IN (${rutEjecD.map((x) => `'${x}'`).join(',') || 'NULL'})`);
  await q(`DELETE FROM fic_visita WHERE id_ficha=@f`, { f: alta.fn }); await q(`DELETE FROM fic_ficha_analisis WHERE id_ficha=@f`, { f: alta.fn });
  // Añadida después de escribir este test: mae_ficha_historial (fila, no grupo) — sin borrar sus filas y su huella (por id_historial,
  // no por ficha) el DELETE de fic_ficha de más abajo choca con su FK, y si solo se borran las filas quedan "sincronizadas" de mentira.
  const historiales = (await q(`SELECT m.id_legado FROM fic_ficha_historial h JOIN mig_id_map m ON m.id_nuevo=h.id AND m.tabla_legado='mae_ficha_historial' WHERE h.id_ficha=@f`, { f: alta.fn })).map((x) => String(x.id_legado));
  await q(`DELETE FROM fic_ficha_historial WHERE id_ficha=@f`, { f: alta.fn });
  await q(`DELETE FROM mig_id_map WHERE tabla_legado='mae_ficha_historial' AND id_legado IN (${historiales.map((x) => `'${x}'`).join(',') || 'NULL'})`);
  await q(`DELETE FROM mig_sync_huella WHERE tabla_legado='mae_ficha_historial' AND clave IN (${historiales.map((x) => `'${x}'`).join(',') || 'NULL'})`);
  await q(`UPDATE fic_ficha SET id_ficha_original=NULL WHERE id_ficha_original=@f`, { f: alta.fn }); await q(`DELETE FROM fic_ficha WHERE id=@f`, { f: alta.fn });
  await q(`DELETE FROM mig_id_map WHERE tabla_legado='App_Ma_FichaIngresoServicio_ENC' AND id_legado=@l`, { l: alta.fl });
  await q(`DELETE FROM mig_sync_huella WHERE tabla_legado IN ('App_Ma_FichaIngresoServicio_ENC','App_Ma_FichaIngresoServicio_DET','App_Ma_Resultados','App_Ma_Equipos_MUESTREOS') AND clave=@c`, { c: String(alta.fl) });
  r = await pasada(); const S2 = await snap();
  ok(`D. alta: recreó la ficha ${alta.fl} con sus visitas (copió ${r.aplicados}, errores=${r.errores})`, r.errores === 0 && ['fic_ficha', 'fic_ficha_analisis', 'fic_visita', 'fic_visita_proceso', 'fic_visita_medicion', 'fic_resultado', 'eqp_uso'].every((t) => S2[t].split(':')[0] === S0[t].split(':')[0]));
  ok('D. la ficha recreada quedó mapeada', (await q(`SELECT COUNT(*) n FROM fic_ficha f JOIN mig_id_map m ON m.id_nuevo=f.id AND m.tabla_legado='App_Ma_FichaIngresoServicio_ENC' AND m.id_legado=@l`, { l: alta.fl }))[0].n === 1);
} else console.log('   D. omitido: la última ficha tiene casos de prefactura');
console.table(await q(`SELECT tabla_legado, aplicados, borrados, errores, pasadas FROM mig_sync_estado WHERE tabla_legado LIKE 'App_Ma%' ORDER BY 1`));
await D.close(); process.exit(0);
