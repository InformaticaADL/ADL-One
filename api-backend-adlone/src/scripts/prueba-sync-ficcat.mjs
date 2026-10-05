import 'dotenv/config'; import sql from 'mssql'; import crypto from 'node:crypto';
import { ejecutarPasada } from '../sync/motor.js';
const D = await new sql.ConnectionPool({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: 'ADL ONE TEST', requestTimeout: 120000, options: { encrypt: true, trustServerCertificate: true } }).connect();
const q = async (s, p = {}) => { const r = D.request(); for (const [k, v] of Object.entries(p)) r.input(k, v); return (await r.query(s)).recordset; };
const ok = (n, c) => console.log((c ? 'OK  ' : 'FALLA ') + n);
const CAT = [['fic_lugar_analisis', 'mae_lugaranalisis'], ['fic_objetivo_muestreo', 'mae_objetivomuestreo_ma'], ['fic_instrumento_ambiental', 'mae_instrumentoambiental'], ['fic_tipo_muestreo', 'mae_tipomuestreo'], ['fic_tipo_muestra', 'mae_tipomuestra_ma'],
  ['fic_componente', 'mae_tipomuestra'], ['fic_subarea', 'mae_subarea'], ['fic_actividad_muestreo', 'mae_actividadmuestreo'], ['fic_tipo_descarga', 'mae_tipodescarga'], ['fic_modalidad_caudal', 'mae_modalidad'], ['fic_forma_canal', 'mae_formacanal'], ['fic_dispositivo_hidraulico', 'mae_dispositivohidraulico']];
const det = async (t) => (await q(`SELECT * FROM ${t} ORDER BY id`)); const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pasada = (tabla) => ejecutarPasada({ modulo: 'fic', tabla, log: (m) => console.log(m) });
const bump = (tabla, clave) => q(`UPDATE mig_sync_huella SET hash1 = hash1 + 1 WHERE tabla_legado=@t AND clave=@c`, { t: tabla, c: String(clave) });
const antes = {}; for (const [t] of CAT) antes[t] = await det(t);
const usrAntes = await q(`SELECT id, id_lugar_analisis FROM usr_usuario ORDER BY id`);
let r = await ejecutarPasada({ modulo: 'fic', log: (m) => console.log(m) });
ok(`A. primera pasada del módulo: copió ${r.aplicados}, errores=${r.errores}`, r.errores === 0);
for (const [t] of CAT) { const d = await det(t); const dif = igual(d, antes[t]); if (!dif) { const s = new Set(); d.forEach((x, i) => { for (const k of Object.keys(x)) if (JSON.stringify(x[k]) !== JSON.stringify(antes[t][i]?.[k])) s.add(k); }); console.log('   columnas distintas:', [...s].join(','), `(${d.length} vs ${antes[t].length})`); } ok(`A. ${t}: idéntica al cargador`, dif); }
ok('A. lugar de análisis de los usuarios idéntico', igual(await q(`SELECT id, id_lugar_analisis FROM usr_usuario ORDER BY id`), usrAntes));
r = await ejecutarPasada({ modulo: 'fic', log: (m) => console.log(m) }); ok(`B. segunda pasada sin cambios (copió ${r.aplicados}, borró ${r.borrados})`, r.aplicados === 0 && r.borrados === 0 && r.errores === 0);

// C) modificación a mano en cada catálogo → se restaura
for (const [t, tl] of CAT) {
  const f = (await q(`SELECT TOP 1 m.id_legado l, c.id, c.nombre, c.habilitado FROM mig_id_map m JOIN ${t} c ON c.id=m.id_nuevo WHERE m.tabla_legado=@t ORDER BY m.id_legado`, { t: tl }))[0]; if (!f) { ok(`C. ${t}: sin filas mapeadas`, false); continue; }
  await q(`UPDATE ${t} SET nombre=N'CAMBIADO', habilitado=CASE WHEN habilitado=1 THEN 0 ELSE 1 END WHERE id=@i`, { i: f.id }); await bump(tl, f.l);
  r = await pasada(tl); const d = (await q(`SELECT nombre, habilitado FROM ${t} WHERE id=@i`, { i: f.id }))[0];
  ok(`C. ${t}: restaurada la fila ${f.l} (copió ${r.aplicados})`, r.aplicados === 1 && d.nombre === f.nombre && d.habilitado === f.habilitado);
}
// D) alta: una fila no referenciada por fichas (tipo de descarga, modalidad, canal o dispositivo) se borra con su mapa y huella → se recrea
const usados = { fic_tipo_descarga: 'id_tipo_descarga', fic_modalidad_caudal: 'id_modalidad_caudal', fic_forma_canal: 'id_forma_canal', fic_dispositivo_hidraulico: 'id_dispositivo_hidraulico' };
let hecho = false;
for (const [t, tl] of CAT.filter(([x]) => usados[x])) {
  const f = (await q(`SELECT TOP 1 m.id_legado l, c.id, c.nombre FROM mig_id_map m JOIN ${t} c ON c.id=m.id_nuevo WHERE m.tabla_legado=@t AND NOT EXISTS (SELECT 1 FROM fic_ficha WHERE ${usados[t]}=c.id) ORDER BY m.id_legado`, { t: tl }))[0]; if (!f) continue;
  await q(`DELETE FROM ${t} WHERE id=@i`, { i: f.id }); await q(`DELETE FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: tl, l: f.l }); await q(`DELETE FROM mig_sync_huella WHERE tabla_legado=@t AND clave=@c`, { t: tl, c: String(f.l) });
  r = await pasada(tl); ok(`D. ${t}: alta de la fila ${f.l} "${f.nombre}" (copió ${r.aplicados}, errores=${r.errores})`, r.aplicados === 1 && (await q(`SELECT COUNT(*) n FROM ${t} WHERE nombre=@n`, { n: f.nombre }))[0].n === 1); hecho = true; break;
}
if (!hecho) console.log('   D. omitido: todas las filas están referenciadas');
// E) borrado: fila falsa con huella se elimina
await q(`INSERT INTO fic_actividad_muestreo (nombre, habilitado) VALUES (N'FALSA', 1)`); const fal = (await q(`SELECT id FROM fic_actividad_muestreo WHERE nombre=N'FALSA'`))[0].id;
await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_actividadmuestreo', 99999, 'fic_actividad_muestreo', @i)`, { i: fal }); await q(`INSERT INTO mig_sync_huella (tabla_legado, clave, hash1, hash2, filas) VALUES ('mae_actividadmuestreo','99999',1,1,1)`);
r = await pasada('mae_actividadmuestreo'); ok(`E. borrado (borró ${r.borrados})`, r.borrados === 1 && (await q(`SELECT COUNT(*) n FROM fic_actividad_muestreo WHERE id=@i`, { i: fal }))[0].n === 0);
for (const [t] of CAT) if (!igual(await det(t), antes[t])) ok(`final: ${t} igual al cargador`, false); else ok(`final: ${t} igual al cargador`, true);
await D.close(); process.exit(0);
