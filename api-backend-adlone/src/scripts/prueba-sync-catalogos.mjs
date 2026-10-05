// Batería de pruebas del motor de sincronización para los módulos geo_ y cat_ (base de PRUEBA).
//   node src/scripts/prueba-sync-catalogos.mjs
// Compara el CONTENIDO LÓGICO (con nombres, no ids) porque los ids identity cambian cuando una fila se vuelve a crear.
import 'dotenv/config'; import sql from 'mssql'; import crypto from 'node:crypto';
import { ejecutarPasada } from '../sync/motor.js';
const D = await new sql.ConnectionPool({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: 'ADL ONE TEST', options: { encrypt: true, trustServerCertificate: true } }).connect();
const q = async (s, p = {}) => { const r = D.request(); for (const [k, v] of Object.entries(p)) r.input(k, v); return (await r.query(s)).recordset; };
const ok = (n, c) => { console.log((c ? 'OK  ' : 'FALLA ') + n); if (!c) process.exitCode = 1; };
const hash = (rows) => `${rows.length}:${crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 12)}`;
const CONSULTAS = {
  geo_region: `SELECT nombre, numero_romano, habilitado FROM geo_region ORDER BY nombre`,
  geo_comuna: `SELECT c.nombre, r.nombre region, c.habilitado FROM geo_comuna c JOIN geo_region r ON r.id=c.id_region ORDER BY r.nombre, c.nombre`,
  geo_zona: `SELECT nombre FROM geo_zona ORDER BY nombre`, geo_sector: `SELECT nombre FROM geo_sector ORDER BY nombre`,
  geo_tipo_agua: `SELECT nombre, grupo FROM geo_tipo_agua ORDER BY nombre`, geo_zona_utm: `SELECT nombre, habilitado FROM geo_zona_utm ORDER BY nombre`,
  geo_unidad_medida: `SELECT nombre FROM geo_unidad_medida ORDER BY nombre`, geo_barrio: `SELECT codigo, nombre FROM geo_barrio ORDER BY codigo`,
  cat_tipo_tecnica: `SELECT nombre, grupo FROM cat_tipo_tecnica ORDER BY nombre`, cat_seccion_laboratorio: `SELECT nombre, centro_costo FROM cat_seccion_laboratorio ORDER BY nombre`,
  cat_tecnica: `SELECT t.nombre, tt.nombre tipo, s.nombre seccion, u.nombre unidad, t.tiempo_respuesta_hrs, t.metodologia, t.costo_operativo_uf FROM cat_tecnica t LEFT JOIN cat_tipo_tecnica tt ON tt.id=t.id_tipo_tecnica LEFT JOIN cat_seccion_laboratorio s ON s.id=t.id_seccion LEFT JOIN geo_unidad_medida u ON u.id=t.id_unidad_medida ORDER BY t.nombre`,
  cat_normativa: `SELECT nombre, habilitado FROM cat_normativa ORDER BY nombre`,
  cat_normativa_referencia: `SELECT n.nombre normativa, r.nombre, r.habilitado FROM cat_normativa_referencia r JOIN cat_normativa n ON n.id=r.id_normativa ORDER BY n.nombre, r.nombre`,
  cat_referencia_analisis: `SELECT t.nombre tecnica, n.nombre normativa, nr.nombre ref, r.limite_max_d, r.limite_max_h, r.lleva_error, r.error_min, r.error_max, r.lleva_traduccion, r.traduccion_0, r.traduccion_1, r.marca, r.habilitado FROM cat_referencia_analisis r JOIN cat_tecnica t ON t.id=r.id_tecnica JOIN cat_normativa n ON n.id=r.id_normativa JOIN cat_normativa_referencia nr ON nr.id=r.id_normativa_referencia ORDER BY t.nombre, n.nombre, nr.nombre`,
};
const dump = async () => { const o = {}; for (const [t, s] of Object.entries(CONSULTAS)) o[t] = hash(await q(s)); return o; };
// pares (id legado → id nuevo) de los módulos: no deben moverse en una pasada sin cambios
const mapas = async () => hash(await q(`SELECT tabla_legado, id_legado, tabla_nueva, id_nuevo FROM mig_id_map WHERE tabla_nueva LIKE 'geo[_]%' OR tabla_nueva LIKE 'cat[_]%' ORDER BY tabla_legado, id_legado`));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const limpiar = async () => { for (const t of ['mig_sync_error', 'mig_sync_estado', 'mig_sync_huella']) await q(`DELETE FROM ${t}`); };
const pasada = (m) => ejecutarPasada({ modulo: m, log: (x) => console.log(x) });
const dif = (a, b) => Object.keys(a).filter((k) => a[k] !== b[k]);

await limpiar(); const S0 = await dump(), M0 = await mapas(); console.log('referencia:', JSON.stringify(Object.fromEntries(Object.entries(S0).map(([k, v]) => [k, v.split(':')[0]]))));

// A) idempotencia sobre lo que cargó el cargador
let rg = await pasada('geo'), rc = await pasada('cat'); const A = await dump();
ok(`A. pasada sobre datos ya cargados: copió geo ${rg.aplicados} + cat ${rc.aplicados} filas, errores ${rg.errores + rc.errores}`, rg.errores + rc.errores === 0 && rg.aplicados === 1712 && rc.aplicados === 2028);
ok(`A. el contenido lógico de las 13 tablas no cambió${dif(S0, A).length ? ' → distintas: ' + dif(S0, A).join(', ') : ''}`, igual(S0, A));
ok(`A. los pares id legado → id nuevo no se movieron`, (await mapas()) === M0);
rg = await pasada('geo'); rc = await pasada('cat'); ok(`A. segunda pasada sin cambios (geo ${rg.aplicados}, cat ${rc.aplicados}, borrados ${rg.borrados + rc.borrados})`, rg.aplicados + rc.aplicados + rg.borrados + rc.borrados === 0);

// C) modificación: cambiar a mano una comuna y una técnica → el motor las restaura
const com = (await q(`SELECT TOP 1 m.id_legado, c.id, c.nombre FROM mig_id_map m JOIN geo_comuna c ON c.id=m.id_nuevo WHERE m.tabla_legado='mae_comuna' AND m.nota NOT LIKE 'fusionado%' ORDER BY m.id_legado`))[0];
const tec = (await q(`SELECT TOP 1 m.id_legado, t.id, t.nombre FROM mig_id_map m JOIN cat_tecnica t ON t.id=m.id_nuevo WHERE m.tabla_legado='mae_tecnica' ORDER BY m.id_legado`))[0];
await q(`UPDATE geo_comuna SET nombre=N'X_MANUAL' WHERE id=@i`, { i: com.id }); await q(`UPDATE cat_tecnica SET nombre=N'X_MANUAL', costo_operativo_uf=99 WHERE id=@i`, { i: tec.id });
await q(`UPDATE mig_sync_huella SET hash1=hash1+1 WHERE (tabla_legado='mae_comuna' AND clave=@a) OR (tabla_legado='mae_tecnica' AND clave=@b)`, { a: String(com.id_legado), b: String(tec.id_legado) });
rg = await pasada('geo'); rc = await pasada('cat');
ok(`C. modificación: restauró comuna "${com.nombre}" y técnica "${tec.nombre}" (copió ${rg.aplicados}+${rc.aplicados}, errores ${rg.errores + rc.errores})`, rg.aplicados === 1 && rc.aplicados === 1 && igual(await dump(), S0));

// F) alta: una fila nueva sin referencias desaparece de la base nueva y el motor la vuelve a crear
const zona = (await q(`SELECT TOP 1 z.id, m.id_legado, z.nombre FROM geo_zona z JOIN mig_id_map m ON m.tabla_nueva='geo_zona' AND m.id_nuevo=z.id AND m.nota IS NULL WHERE NOT EXISTS (SELECT 1 FROM cli_centro c WHERE c.id_zona=z.id) AND (SELECT COUNT(*) FROM mig_id_map x WHERE x.tabla_nueva='geo_zona' AND x.id_nuevo=z.id)=1 ORDER BY m.id_legado`))[0];
if (zona) {
  await q(`DELETE FROM mig_id_map WHERE tabla_nueva='geo_zona' AND id_nuevo=@i`, { i: zona.id }); await q(`DELETE FROM geo_zona WHERE id=@i`, { i: zona.id }); await q(`DELETE FROM mig_sync_huella WHERE tabla_legado='mae_zonas' AND clave=@c`, { c: String(zona.id_legado) });
  rg = await pasada('geo'); const nueva = (await q(`SELECT z.id FROM geo_zona z JOIN mig_id_map m ON m.tabla_nueva='geo_zona' AND m.id_nuevo=z.id AND m.id_legado=@l WHERE z.nombre=@n`, { l: zona.id_legado, n: zona.nombre }))[0];
  ok(`F. alta: recreó la zona "${zona.nombre}" con su mapa (copió ${rg.aplicados}, errores ${rg.errores})`, rg.aplicados === 1 && !!nueva && igual(await dump(), S0));
} else console.log('F. omitida: no hay una zona sin referencias para probar el alta');

// D) borrado: una fila que ya no existe en el legado (fila, mapa y huella falsos) se elimina
const idFalso = (await q(`INSERT INTO geo_zona (nombre) OUTPUT INSERTED.id VALUES (N'ZONA FALSA DE PRUEBA')`))[0].id;
await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_zonas', 99999, 'geo_zona', @i)`, { i: idFalso }); await q(`INSERT INTO mig_sync_huella (tabla_legado, clave, hash1, hash2, filas) VALUES ('mae_zonas', '99999', 1, 1, 1)`);
rg = await pasada('geo'); const q2 = (await q(`SELECT (SELECT COUNT(*) FROM geo_zona WHERE id=@i) z, (SELECT COUNT(*) FROM mig_id_map WHERE id_legado=99999 AND tabla_legado='mae_zonas') m, (SELECT COUNT(*) FROM mig_sync_huella WHERE clave='99999' AND tabla_legado='mae_zonas') h`, { i: idFalso }))[0];
ok(`D. borrado: eliminó la zona falsa (borró ${rg.borrados}, quedan fila=${q2.z} mapa=${q2.m} huella=${q2.h}, errores ${rg.errores})`, rg.borrados === 1 && !q2.z && !q2.m && !q2.h && igual(await dump(), S0));

// E) error: una comuna cuya región no está cargada se encola; al corregirlo se aplica sola
const reg13 = (await q(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado='mae_region' AND id_legado=13`))[0]; const com13 = (await q(`SELECT TOP 1 id_legado FROM mig_id_map WHERE tabla_legado='mae_comuna' AND nota NOT LIKE 'fusionado%' ORDER BY id_legado DESC`))[0];
const regDeCom = (await import('../sync/datos/regionDeComuna.js')).REGION_DE_COMUNA.get(Number(com13.id_legado)); const mapaRegion = (await q(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado='mae_region' AND id_legado=@r`, { r: regDeCom }))[0];
await q(`DELETE FROM mig_id_map WHERE tabla_legado='mae_region' AND id_legado=@r`, { r: regDeCom }); await q(`UPDATE mig_sync_huella SET hash1=hash1+1 WHERE tabla_legado='mae_comuna' AND clave=@c`, { c: String(com13.id_legado) });
rg = await pasada('geo'); const cola = await q(`SELECT tabla_legado, clave, LEFT(mensaje,80) m FROM mig_sync_error WHERE resuelto_en IS NULL`);
ok(`E. error encolado sin detener la pasada (errores ${rg.errores}; "${cola[0]?.m}")`, rg.errores === 1 && cola.length === 1);
await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_region', @r, 'geo_region', @i)`, { r: regDeCom, i: mapaRegion.id_nuevo });
rg = await pasada('geo'); ok(`E. al corregir la causa se aplica sola (copió ${rg.aplicados}, cola abierta ${(await q(`SELECT COUNT(*) n FROM mig_sync_error WHERE resuelto_en IS NULL`))[0].n})`, rg.aplicados === 1 && rg.errores === 0);
ok(`E. contenido final igual a la referencia`, igual(await dump(), S0));
await D.close(); process.exit(process.exitCode || 0);
