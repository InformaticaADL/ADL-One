import 'dotenv/config'; import sql from 'mssql'; import crypto from 'node:crypto';
import { ejecutarPasada } from '../sync/motor.js';
const D = await new sql.ConnectionPool({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: 'ADL ONE TEST', options: { encrypt: true, trustServerCertificate: true } }).connect();
const q = async (s, p = {}) => { const r = D.request(); for (const [k, v] of Object.entries(p)) r.input(k, v); return (await r.query(s)).recordset; };
const ok = (n, c) => console.log((c ? 'OK  ' : 'FALLA ') + n);
const TABLAS = ['sol_tipo', 'sol_tipo_permiso', 'sol_tipo_notificacion', 'sol_solicitud', 'sol_historial'];
// contenido sin el id (los ids identity de algunas tablas cambian al recargar) y sin la fecha de sincronización
const snap = async () => { const o = {}; for (const t of TABLAS) { const r = await q(`SELECT * FROM ${t} ORDER BY id`); const filas = r.map((x) => { const c = { ...x }; if (!['sol_tipo', 'sol_solicitud'].includes(t)) delete c.id; return c; }); o[t] = `${filas.length}:${crypto.createHash('sha256').update(JSON.stringify(filas)).digest('hex').slice(0, 12)}`; } return o; };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const limpiarEstado = async () => { for (const t of ['mig_sync_error', 'mig_sync_estado', 'mig_sync_huella']) await q(`DELETE FROM ${t}`); };
const pasada = async () => ejecutarPasada({ modulo: 'sol', log: (m) => console.log(m) });

const S0 = await snap(); console.log('referencia (cargador):', JSON.stringify(S0));

// A) fila ya cargada SIN mapa: se reconoce por su clave natural, sin duplicar
await q(`DELETE FROM mig_id_map WHERE tabla_nueva IN ('sol_tipo_permiso','sol_tipo_notificacion','sol_historial')`); await limpiarEstado();
let r = await pasada(); const A = await snap();
ok(`A. sin mapas previos: copió ${r.aplicados}, sin duplicar filas y con el mismo contenido (errores=${r.errores})`, igual(A, S0) && r.errores === 0);
ok(`A. los mapas se reconstruyeron (permiso 74, notificación 11, historial 4)`, JSON.stringify((await q(`SELECT tabla_legado, COUNT(*) n FROM mig_id_map WHERE tabla_nueva LIKE 'sol[_]%' GROUP BY tabla_legado ORDER BY 1`)).map((x) => `${x.tabla_legado}=${x.n}`)) === JSON.stringify(['mae_solicitud=5', 'mae_solicitud_historial=4', 'mae_solicitud_tipo=15', 'rel_solicitud_tipo_notificacion=11', 'rel_solicitud_tipo_permiso=74']));

// B) desde cero: vaciar sol_ y sincronizar == cargador
for (const t of ['sol_archivo', 'sol_derivacion', 'sol_historial', 'sol_comentario', 'sol_equipo_solicitud', 'sol_solicitud', 'sol_tipo_notificacion', 'sol_tipo_permiso', 'sol_tipo']) await q(`DELETE FROM ${t}`);
await q(`DELETE FROM mig_id_map WHERE tabla_nueva LIKE 'sol[_]%'`); await limpiarEstado();
r = await pasada(); const B = await snap();
ok(`B. desde cero: copió ${r.aplicados} filas y el contenido es idéntico al del cargador (errores=${r.errores})`, igual(B, S0) && r.aplicados === 109 && r.errores === 0);
r = await pasada(); ok(`B. segunda pasada sin cambios (copió ${r.aplicados}, borró ${r.borrados})`, r.aplicados === 0 && r.borrados === 0);

// C) modificación: alterar una fila a mano en la base nueva y manipular su huella → el motor la restaura al valor del legado
const antesObs = (await q(`SELECT estado, observaciones FROM sol_solicitud WHERE id=3`))[0];
await q(`UPDATE sol_solicitud SET estado='X_MANUAL', observaciones=N'cambiada a mano' WHERE id=3`);
await q(`UPDATE mig_sync_huella SET hash1 = hash1 + 1 WHERE tabla_legado='mae_solicitud' AND clave='3'`);
r = await pasada(); const desp = (await q(`SELECT estado, observaciones FROM sol_solicitud WHERE id=3`))[0];
ok(`C. modificación: copió ${r.aplicados} fila y la restauró (estado ${desp.estado}, observaciones original=${desp.observaciones === antesObs.observaciones})`, r.aplicados === 1 && desp.estado === antesObs.estado && desp.observaciones === antesObs.observaciones);

// D) borrado: una fila que "ya no existe en el legado" (fila y huella falsas) se elimina en la base nueva
await q(`SET IDENTITY_INSERT sol_solicitud ON; INSERT INTO sol_solicitud (id, id_tipo, id_persona_solicitante, estado, prioridad, datos_json) VALUES (99999, 16, (SELECT TOP 1 id FROM per_persona), 'PENDIENTE', 'NORMAL', '{}'); SET IDENTITY_INSERT sol_solicitud OFF;`);
await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_solicitud', 99999, 'sol_solicitud', 99999)`);
await q(`INSERT INTO mig_sync_huella (tabla_legado, clave, hash1, hash2, filas) VALUES ('mae_solicitud', '99999', 1, 1, 1)`);
await q(`INSERT INTO sol_historial (id_solicitud, accion) VALUES (99999, 'FALSO')`); await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) SELECT 'mae_solicitud_historial', 99999, 'sol_historial', MAX(id) FROM sol_historial`);
await q(`INSERT INTO mig_sync_huella (tabla_legado, clave, hash1, hash2, filas) VALUES ('mae_solicitud_historial', '99999', 1, 1, 1)`);
r = await pasada();
const quedan = (await q(`SELECT (SELECT COUNT(*) FROM sol_solicitud WHERE id=99999) s, (SELECT COUNT(*) FROM sol_historial WHERE accion='FALSO') h, (SELECT COUNT(*) FROM mig_sync_huella WHERE clave='99999') hu, (SELECT COUNT(*) FROM mig_id_map WHERE id_legado=99999) m`))[0];
ok(`D. borrado: hijo antes que padre, sin error (borró ${r.borrados}, errores=${r.errores}; quedan solicitud=${quedan.s} historial=${quedan.h} huellas=${quedan.hu} mapas=${quedan.m})`, r.borrados === 2 && r.errores === 0 && !quedan.s && !quedan.h && !quedan.hu && !quedan.m);
ok(`D. el resto sigue intacto`, igual(await snap(), S0));

// E) cola de errores: un cambio cuyo actor no se puede resolver se encola; al resolverse se aplica solo en la pasada siguiente
const mapaMue = (await q(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado='mae_muestreador' AND id_legado=229`))[0]; await q(`DELETE FROM mig_id_map WHERE tabla_legado='mae_muestreador' AND id_legado=229`);
await q(`UPDATE mig_sync_huella SET hash1 = hash1 + 1 WHERE tabla_legado='mae_solicitud' AND clave='2'`);
r = await pasada(); const err = await q(`SELECT tabla_legado, clave, operacion, reintentos, resuelto_en, LEFT(mensaje, 90) m FROM mig_sync_error`);
ok(`E. error encolado sin detener la pasada (errores=${r.errores}; cola: ${JSON.stringify(err.map((e) => `${e.tabla_legado}/${e.clave}`))})`, r.errores === 1 && err.length === 1 && !err[0].resuelto_en); console.log('    mensaje:', err[0]?.m);
r = await pasada(); ok(`E. mismo error, 2.ª pasada: reintentos=${(await q(`SELECT reintentos FROM mig_sync_error`))[0].reintentos}`, r.errores === 1);
await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_muestreador', 229, 'per_persona', @i)`, { i: mapaMue.id_nuevo });
r = await pasada(); const cola = (await q(`SELECT COUNT(*) n, SUM(CASE WHEN resuelto_en IS NULL THEN 1 ELSE 0 END) abiertos FROM mig_sync_error`))[0];
ok(`E. al corregir la causa se aplica solo (copió ${r.aplicados}, errores=${r.errores}; cola abiertos=${cola.abiertos})`, r.aplicados === 1 && r.errores === 0 && cola.abiertos === 0);
ok(`E. contenido final igual al del cargador`, igual(await snap(), S0));
console.table(await q(`SELECT tabla_legado, aplicados, borrados, errores, pasadas FROM mig_sync_estado ORDER BY 1`));
await D.close(); process.exit(0);
