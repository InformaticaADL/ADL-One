// Batería de pruebas del motor para los módulos per_, usr_ y eqp_ (base de PRUEBA).
//   node src/scripts/prueba-sync-personas-equipos.mjs
// Compara CONTENIDO LÓGICO (con nombres, no ids). Nunca imprime claves ni hashes.
import 'dotenv/config'; import sql from 'mssql'; import crypto from 'node:crypto';
import { ejecutarPasada } from '../sync/motor.js';
import { REGISTRO } from '../sync/registro.js';
import { verifyPassword, isBcryptHash } from '../utils/password.js';
// Tablas legado de los módulos que prueba este script: limpiar() SOLO debe tocar sus huellas. Antes borraba mig_sync_huella
// entero (sin filtrar tabla_legado): dejaba el resto del servidor (fic_, cli_, geo_, cat_, fac_, sol_, rut_) sin huellas y
// forzaba una recarga completa de TODO en la siguiente pasada real (~14 min, 23.232 filas, visto en vivo el 2026-09-28
// tras cargar los centros nuevos de LaboratorioADL — no fue un cuelgue ni corrupción, solo una recarga de verificación).
const TABLAS_PRUEBA = REGISTRO.filter((r) => ['per', 'usr', 'eqp'].includes(r.modulo)).map((r) => r.tabla);
const cfg = (d) => ({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: d, options: { encrypt: true, trustServerCertificate: true } });
const D = await new sql.ConnectionPool(cfg('ADL ONE TEST')).connect(), L = await new sql.ConnectionPool(cfg(process.env.DB_DATABASE)).connect();
const q = async (s, p = {}) => { const r = D.request(); for (const [k, v] of Object.entries(p)) r.input(k, v); return (await r.query(s)).recordset; };
const ql = async (s) => (await L.request().query(s)).recordset;
const ok = (n, c) => { console.log((c ? 'OK  ' : 'FALLA ') + n); if (!c) process.exitCode = 1; };
const sha = (x) => crypto.createHash('sha256').update(String(x ?? '')).digest('hex').slice(0, 10);
const hash = (rows) => `${rows.length}:${crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 12)}`;
const CONSULTAS = {
  per_categoria_cargo: `SELECT nombre FROM per_categoria_cargo ORDER BY nombre`,
  per_cargo: `SELECT c.nombre, (SELECT STRING_AGG(k.nombre, ',') WITHIN GROUP (ORDER BY k.nombre) FROM per_cargo_categoria cc JOIN per_categoria_cargo k ON k.id=cc.id_categoria WHERE cc.id_cargo=c.id) categorias FROM per_cargo c ORDER BY c.nombre`,
  per_competencia: `SELECT nombre, descripcion, orden, activo FROM per_competencia ORDER BY nombre`,
  per_persona: `SELECT nombre, email, rut, CASE WHEN clave_hash IS NULL THEN 'sin' ELSE 'con' END clave, firma_base64, firma_ruta, expo_push_token, notificaciones_push, notificaciones_email, en_entrenamiento, habilitado FROM per_persona ORDER BY nombre, email`,
  per_persona_rol: `SELECT p.nombre, r.rol, c.nombre cargo, r.habilitado FROM per_persona_rol r JOIN per_persona p ON p.id=r.id_persona LEFT JOIN per_cargo c ON c.id=r.id_cargo ORDER BY p.nombre, r.rol`,
  usr_rol: `SELECT id, nombre, descripcion, activo FROM usr_rol ORDER BY id`, usr_permiso: `SELECT id, codigo, nombre, modulo, submodulo, tipo, orden, habilitado FROM usr_permiso ORDER BY id`,
  usr_rol_permiso: `SELECT id_rol, id_permiso FROM usr_rol_permiso ORDER BY id_rol, id_permiso`, usr_usuario_rol: `SELECT id_usuario, id_rol FROM usr_usuario_rol ORDER BY id_usuario, id_rol`,
  usr_usuario: `SELECT u.id, u.nombre_usuario, u.email, u.nombre, CASE WHEN u.habilitado=1 THEN LEFT(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', u.clave_hash), 2), 10) ELSE 'x' END clave_habilitado, u.foto, p.nombre persona, c.nombre cargo, l.nombre lugar, u.habilitado, u.permisos_version, u.sigla_cargo FROM usr_usuario u LEFT JOIN per_persona p ON p.id=u.id_persona LEFT JOIN per_cargo c ON c.id=u.id_cargo LEFT JOIN fic_lugar_analisis l ON l.id=u.id_lugar_analisis ORDER BY u.id`,
  eqp_catalogo: `SELECT nombre, que_mide, unidad_medida_texto, tipo_equipo FROM eqp_catalogo ORDER BY nombre`,
  eqp_equipo: `SELECT e.codigo, c.nombre catalogo, e.sigla, e.correlativo, e.nombre, e.sede, p.nombre persona, l.nombre lugar, e.error_0, e.error_15, e.error_30, e.tiene_factor_correccion, e.es_fijo, e.aparece_en_informe, e.ultima_verificacion, e.siguiente_verificacion, e.fecha_vigencia, e.plazo_vigencia, e.equipo_asociado, e.observacion, e.estado, e.habilitado, e.visible_muestreador, e.version, e.esta_ocupado FROM eqp_equipo e JOIN eqp_catalogo c ON c.id=e.id_equipo_catalogo LEFT JOIN per_persona p ON p.id=e.id_persona_responsable LEFT JOIN eqp_lugar_guardado l ON l.id=e.id_lugar_guardado ORDER BY e.codigo`,
  eqp_historial: `SELECT e.codigo equipo, h.version, h.codigo, h.sigla, h.correlativo, h.nombre, h.sede, h.tiene_factor_correccion, h.error_0, h.error_15, h.error_30, h.ultima_verificacion, h.siguiente_verificacion, h.estado, h.motivo FROM eqp_historial h JOIN eqp_equipo e ON e.id=h.id_equipo ORDER BY e.codigo, h.version`,
  revision_duplicado: `SELECT entidad, criterio, JSON_VALUE(detalle_json,'$.a.nombre') a, JSON_VALUE(detalle_json,'$.b.nombre') b FROM revision_duplicado WHERE entidad IN ('PER_PERSONA','EQP_EQUIPO') ORDER BY entidad, criterio, 3, 4`,
};
const dump = async () => { const o = {}; for (const [t, s] of Object.entries(CONSULTAS)) o[t] = hash(await q(s)); return o; };
const mapas = async () => hash(await q(`SELECT tabla_legado, id_legado, tabla_nueva, id_nuevo FROM mig_id_map WHERE tabla_nueva LIKE 'per[_]%' OR tabla_nueva LIKE 'usr[_]%' OR tabla_nueva LIKE 'eqp[_]%' OR tabla_nueva LIKE '(sede)%' OR tabla_legado='mae_usuario' ORDER BY tabla_legado, id_legado`));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b); const dif = (a, b) => Object.keys(a).filter((k) => a[k] !== b[k]);
const listaTablas = TABLAS_PRUEBA.map((t) => `'${t}'`).join(',');
const limpiar = async () => { for (const t of ['mig_sync_error', 'mig_sync_estado', 'mig_sync_huella']) await q(`DELETE FROM ${t} WHERE tabla_legado IN (${listaTablas})`); };
const pasada = (m) => ejecutarPasada({ modulo: m, log: (x) => console.log(x) });
const todo = async () => { const a = await pasada('per'), b = await pasada('usr'), c = await pasada('eqp'); return { aplicados: a.aplicados + b.aplicados + c.aplicados, borrados: a.borrados + b.borrados + c.borrados, errores: a.errores + b.errores + c.errores }; };
const tamper = (tabla, clave) => q(`UPDATE mig_sync_huella SET hash1=hash1+1 WHERE tabla_legado=@t AND clave=@c`, { t: tabla, c: String(clave) });

// ---- comprobación de claves (no imprime nada sensible)
const claves = async () => {
  let mal = 0, n = 0, planas = 0;
  const mue = await ql(`SELECT id_muestreador id, clave_usuario FROM mae_muestreador WHERE LEN(RTRIM(ISNULL(clave_usuario,'')))>0`); const mapaM = new Map((await q(`SELECT id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado='mae_muestreador' AND id_nuevo>0`)).map((x) => [Number(x.id_legado), x.id_nuevo]));
  const hashesP = new Map((await q(`SELECT id, clave_hash FROM per_persona`)).map((x) => [x.id, x.clave_hash]));
  for (const m of mue) { const idP = mapaM.get(Number(m.id)); if (!idP) continue; const h = hashesP.get(idP); const pin = String(m.clave_usuario).trim(); n++; if (!h || !isBcryptHash(h)) { planas++; continue; } if (!isBcryptHash(pin) && !(await verifyPassword(pin, h)).match) mal++; if (isBcryptHash(pin) && pin !== h) mal++; }
  const us = await ql(`SELECT id_usuario id, clave_usuario FROM mae_usuario WHERE habilitado='S' AND LEN(RTRIM(ISNULL(clave_usuario,'')))>0`); const hashesU = new Map((await q(`SELECT id, clave_hash FROM usr_usuario`)).map((x) => [x.id, x.clave_hash]));
  for (const u of us) { const h = hashesU.get(Number(u.id)); const pw = String(u.clave_usuario).trim(); n++; if (!h || !isBcryptHash(h)) { planas++; continue; } if (!isBcryptHash(pw) && !(await verifyPassword(pw, h)).match) mal++; if (isBcryptHash(pw) && pw !== h) mal++; }
  return { n, mal, planas };
};

await limpiar(); const S0 = await dump(), M0 = await mapas(); const H0 = (await q(`SELECT id, clave_hash FROM per_persona ORDER BY id`)).map((x) => sha(x.clave_hash)).join(); const HU0 = (await q(`SELECT id, clave_hash FROM usr_usuario ORDER BY id`)).map((x) => sha(x.clave_hash)).join();
console.log('referencia (filas):', JSON.stringify(Object.fromEntries(Object.entries(S0).map(([k, v]) => [k, Number(v.split(':')[0])]))));
const C0 = await claves(); ok(`0. antes de sincronizar: ${C0.n} claves comprobadas validan contra su hash (fallas ${C0.mal}, en texto plano ${C0.planas})`, C0.mal === 0 && C0.planas === 0);

// A) idempotencia — cuánto espera copiar la primera pasada (huellas recién borradas: todo el legado de per_/usr_/eqp_,
// calculado en vivo en vez de un número fijo, que quedaba desactualizado cada vez que el legado sumaba filas — ej. el
// equipo agregando versiones nuevas en mae_equipo_historial).
const esperado = async () => { const s = await Promise.all(['per', 'usr', 'eqp'].map((m) => ejecutarPasada({ modulo: m, simular: true }))); return s.reduce((a, x) => a + x.resumen.reduce((b, f) => b + f.por_copiar, 0), 0); };
const esperadas = await esperado();
let r = await todo(); const A = await dump();
ok(`A. pasada sobre datos ya cargados: copió ${r.aplicados}, errores ${r.errores} (esperadas ${esperadas})`, r.errores === 0 && r.aplicados === esperadas);
ok(`A. contenido lógico de las ${Object.keys(S0).length} vistas sin cambios${dif(S0, A).length ? ' → distintas: ' + dif(S0, A).join(', ') : ''}`, igual(S0, A));
ok(`A. mig_id_map sin cambios`, (await mapas()) === M0);
ok(`A. los hashes de clave NO se reescribieron (per_ y usr_ idénticos)`, (await q(`SELECT id, clave_hash FROM per_persona ORDER BY id`)).map((x) => sha(x.clave_hash)).join() === H0 && (await q(`SELECT id, clave_hash FROM usr_usuario ORDER BY id`)).map((x) => sha(x.clave_hash)).join() === HU0);
r = await todo(); ok(`A. segunda pasada sin cambios (copió ${r.aplicados}, borró ${r.borrados})`, r.aplicados === 0 && r.borrados === 0);

// C) modificación: se altera a mano una persona, un usuario y un equipo → el motor los restaura (y la clave se conserva)
const mue = (await q(`SELECT TOP 1 m.id_legado, p.id, p.nombre FROM mig_id_map m JOIN per_persona p ON p.id=m.id_nuevo WHERE m.tabla_legado='mae_muestreador' AND m.nota IS NULL ORDER BY m.id_legado`))[0];
const usr = (await q(`SELECT TOP 1 id, nombre FROM usr_usuario WHERE habilitado=1 ORDER BY id`))[0]; const eq = (await q(`SELECT TOP 1 m.id_legado, e.id, e.codigo, e.estado FROM mig_id_map m JOIN eqp_equipo e ON e.id=m.id_nuevo WHERE m.tabla_legado='mae_equipo' ORDER BY m.id_legado`))[0];
await q(`UPDATE per_persona SET nombre=N'X_MANUAL', en_entrenamiento=1 WHERE id=@i`, { i: mue.id }); await q(`UPDATE usr_usuario SET nombre=N'X_MANUAL' WHERE id=@i`, { i: usr.id }); await q(`UPDATE eqp_equipo SET estado='Dado de Baja', observacion=N'x' WHERE id=@i`, { i: eq.id });
await tamper('mae_muestreador', mue.id_legado); await tamper('mae_usuario', usr.id); await tamper('mae_equipo', eq.id_legado);
r = await todo(); ok(`C. modificación: restauró persona "${mue.nombre}", usuario "${usr.nombre}" y equipo "${eq.codigo}" (copió ${r.aplicados}, errores ${r.errores})`, r.aplicados === 3 && r.errores === 0 && igual(await dump(), S0));

// F) alta: un equipo hoja (sin usos) y un usuario deshabilitado sin referencias desaparecen y el motor los recrea
const eqh = (await q(`SELECT TOP 1 m.id_legado, e.id, e.codigo FROM mig_id_map m JOIN eqp_equipo e ON e.id=m.id_nuevo WHERE m.tabla_legado='mae_equipo' AND NOT EXISTS (SELECT 1 FROM eqp_uso u WHERE u.id_equipo=e.id) AND NOT EXISTS (SELECT 1 FROM eqp_reserva r WHERE r.id_equipo=e.id) AND NOT EXISTS (SELECT 1 FROM revision_duplicado d WHERE d.entidad='EQP_EQUIPO' AND (d.id_registro_a=e.id OR d.id_registro_b=e.id)) ORDER BY m.id_legado DESC`))[0];
if (eqh) {
  const his = await q(`SELECT m.id_legado FROM mig_id_map m JOIN eqp_historial h ON h.id=m.id_nuevo WHERE m.tabla_nueva='eqp_historial' AND h.id_equipo=@e AND m.tabla_legado='mae_equipo_historial'`, { e: eqh.id });
  await q(`DELETE FROM mig_id_map WHERE tabla_nueva='eqp_historial' AND id_nuevo IN (SELECT id FROM eqp_historial WHERE id_equipo=@e)`, { e: eqh.id }); await q(`DELETE FROM eqp_historial WHERE id_equipo=@e`, { e: eqh.id });
  await q(`DELETE FROM mig_id_map WHERE tabla_legado='mae_equipo' AND id_legado=@l`, { l: eqh.id_legado }); await q(`DELETE FROM eqp_equipo WHERE id=@i`, { i: eqh.id });
  await q(`DELETE FROM mig_sync_huella WHERE (tabla_legado='mae_equipo' AND clave=@c) ${his.length ? `OR (tabla_legado='mae_equipo_historial' AND clave IN (${his.map((h) => `'${h.id_legado}'`).join(',')}))` : ''}`, { c: String(eqh.id_legado) });
  r = await todo(); ok(`F. alta: recreó el equipo "${eqh.codigo}" con ${his.length} versión(es) de historial y su línea base (copió ${r.aplicados}, errores ${r.errores})`, r.errores === 0 && r.aplicados >= 1 && igual(await dump(), S0));
} else console.log('F. omitida (equipo): no hay un equipo sin usos para probar');
const uh = (await q(`SELECT TOP 1 u.id, u.nombre_usuario FROM usr_usuario u WHERE u.habilitado=0 AND NOT EXISTS (SELECT 1 FROM usr_usuario_rol r WHERE r.id_usuario=u.id) AND u.id_persona IS NULL AND NOT EXISTS (SELECT 1 FROM fic_visita v WHERE v.id_usuario_programo=u.id OR v.id_usuario_confirma_caso=u.id) AND NOT EXISTS (SELECT 1 FROM sol_solicitud s WHERE s.id_solicitante=u.id) AND NOT EXISTS (SELECT 1 FROM sol_tipo_permiso p WHERE p.id_usuario=u.id) ORDER BY u.id`))[0];
if (uh) {
  await q(`DELETE FROM mig_id_map WHERE tabla_legado='mae_usuario#usr' AND id_legado=@i`, { i: uh.id }); await q(`DELETE FROM usr_usuario WHERE id=@i`, { i: uh.id }); await q(`DELETE FROM mig_sync_huella WHERE tabla_legado='mae_usuario' AND clave=@c`, { c: String(uh.id) });
  r = await todo(); ok(`F. alta: recreó el usuario deshabilitado "${uh.nombre_usuario}" (copió ${r.aplicados}, errores ${r.errores})`, r.errores === 0 && r.aplicados === 1 && igual(await dump(), S0));
}

// D) borrado: filas que ya no existen en el legado (rol, catálogo de equipos y muestreador falsos)
await q(`SET IDENTITY_INSERT usr_rol ON; INSERT INTO usr_rol (id, nombre) VALUES (99999, N'ROL FALSO'); SET IDENTITY_INSERT usr_rol OFF;`); await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_rol', 99999, 'usr_rol', 99999)`); await q(`INSERT INTO mig_sync_huella (tabla_legado, clave, hash1, hash2, filas) VALUES ('mae_rol','99999',1,1,1)`);
const idCatF = (await q(`INSERT INTO eqp_catalogo (nombre) OUTPUT INSERTED.id VALUES (N'CATALOGO FALSO')`))[0].id; await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_equipo_catalogo', 99999, 'eqp_catalogo', @i)`, { i: idCatF }); await q(`INSERT INTO mig_sync_huella (tabla_legado, clave, hash1, hash2, filas) VALUES ('mae_equipo_catalogo','99999',1,1,1)`);
const idPF = (await q(`INSERT INTO per_persona (nombre) OUTPUT INSERTED.id VALUES (N'PERSONA FALSA')`))[0].id; await q(`INSERT INTO per_persona_rol (id_persona, rol) VALUES (@i, 'MUESTREADOR')`, { i: idPF }); await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_muestreador', 99999, 'per_persona', @i)`, { i: idPF }); await q(`INSERT INTO mig_sync_huella (tabla_legado, clave, hash1, hash2, filas) VALUES ('mae_muestreador','99999',1,1,1)`);
r = await todo(); const q3 = (await q(`SELECT (SELECT COUNT(*) FROM usr_rol WHERE id=99999) rol, (SELECT COUNT(*) FROM eqp_catalogo WHERE id=@c) cat, (SELECT COUNT(*) FROM per_persona WHERE id=@p) per, (SELECT COUNT(*) FROM per_persona_rol WHERE id_persona=@p) perrol, (SELECT COUNT(*) FROM mig_id_map WHERE id_legado=99999) mapas, (SELECT COUNT(*) FROM mig_sync_huella WHERE clave='99999') huellas`, { c: idCatF, p: idPF }))[0];
ok(`D. borrado: eliminó rol, catálogo y persona falsos (borró ${r.borrados}; quedan ${JSON.stringify(q3)}; errores ${r.errores})`, r.borrados === 3 && r.errores === 0 && Object.values(q3).every((v) => v === 0) && igual(await dump(), S0));

// E) error: un equipo cuyo catálogo no está mapeado se encola; al corregirlo se aplica solo
const e2 = (await q(`SELECT TOP 1 m.id_legado, e.id, e.id_equipo_catalogo FROM mig_id_map m JOIN eqp_equipo e ON e.id=m.id_nuevo WHERE m.tabla_legado='mae_equipo' ORDER BY m.id_legado`))[0];
const cLeg = (await ql(`SELECT id_equipocatalogo c FROM mae_equipo WHERE id_equipo=${Number(e2.id_legado)}`))[0].c; const mapaCat = (await q(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado='mae_equipo_catalogo' AND id_legado=@l`, { l: Number(cLeg) }))[0];
await q(`DELETE FROM mig_id_map WHERE tabla_legado='mae_equipo_catalogo' AND id_legado=@l`, { l: Number(cLeg) }); await tamper('mae_equipo', e2.id_legado);
// Filtrado por tabla_legado='mae_equipo': mig_sync_error también guarda los AVISOS de otros módulos (ej. los 46 de
// App_Ma_Documentos_Enviados/contactos sin servicio) en la misma tabla, sin filtrar por tabla se contaban también esos.
r = await pasada('eqp'); const cola = await q(`SELECT LEFT(mensaje,70) m FROM mig_sync_error WHERE resuelto_en IS NULL AND tabla_legado='mae_equipo'`);
ok(`E. error encolado sin detener la pasada (errores ${r.errores}; "${cola[0]?.m}")`, r.errores === 1 && cola.length === 1);
await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_equipo_catalogo', @l, 'eqp_catalogo', @i)`, { l: Number(cLeg), i: mapaCat.id_nuevo });
r = await pasada('eqp'); ok(`E. al corregir la causa se aplica solo (copió ${r.aplicados}, cola abierta ${(await q(`SELECT COUNT(*) n FROM mig_sync_error WHERE resuelto_en IS NULL AND tabla_legado='mae_equipo'`))[0].n})`, r.aplicados === 1 && r.errores === 0);
ok(`E. contenido final igual a la referencia`, igual(await dump(), S0));
const C1 = await claves(); ok(`Z. al final: ${C1.n} claves siguen validando (fallas ${C1.mal}, en texto plano ${C1.planas})`, C1.mal === 0 && C1.planas === 0);
await D.close(); await L.close(); process.exit(process.exitCode || 0);
