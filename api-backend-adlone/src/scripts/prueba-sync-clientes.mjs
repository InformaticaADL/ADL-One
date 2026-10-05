// Batería de pruebas del motor para el módulo cli_ (base de PRUEBA). Incluye una FUSIÓN REAL hecha con el servicio de la
// pantalla de revisión, para comprobar la regla: el cambio de la fila descartada NO pisa a la que quedó (queda un aviso).
//   node src/scripts/prueba-sync-clientes.mjs
import 'dotenv/config'; import sql from 'mssql'; import crypto from 'node:crypto';
import { ejecutarPasada } from '../sync/motor.js';
import { revisionDuplicadosService } from '../services/revisionDuplicados.service.js';
const cfg = (d) => ({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: d, options: { encrypt: true, trustServerCertificate: true } });
const D = await new sql.ConnectionPool(cfg('ADL ONE TEST')).connect();
const q = async (s, p = {}) => { const r = D.request(); for (const [k, v] of Object.entries(p)) r.input(k, v); return (await r.query(s)).recordset; };
const ok = (n, c) => { console.log((c ? 'OK  ' : 'FALLA ') + n); if (!c) process.exitCode = 1; };
// hash del contenido: las filas se ordenan por su propio texto (no por id: los ids cambian cuando una fila se recrea)
const hash = (rows) => { const t = rows.map((r) => JSON.stringify(r)).sort(); return `${rows.length}:${crypto.createHash('sha256').update(t.join('\n')).digest('hex').slice(0, 12)}`; };
const CONSULTAS = {
  cli_empresa: `SELECT rut, razon_social, nombre_fantasia, direccion, email, telefono, rlegal_nombre, rlegal_rut, rlegal_direccion, habilitado FROM cli_empresa`,
  cli_empresa_servicio: `SELECT e.rut empresa_rut, s.nombre, s.rut, s.direccion, s.email, s.telefono, s.giro, c.nombre comuna, s.contacto_nombre, s.contacto_email, s.contacto_telefono, s.email_facturacion, s.forma_pago_default, s.requiere_oc, s.requiere_hes, s.ciudad, s.esquema_precio, s.precio_especial, s.cobra_costo_operativo, s.factor_km, s.tablact, s.habilitado FROM cli_empresa_servicio s JOIN cli_empresa e ON e.id=s.id_empresa LEFT JOIN geo_comuna c ON c.id=s.id_comuna`,
  cli_centro: `SELECT c.nombre, c.codigo, co.nombre comuna, z.nombre zona, se.nombre sector, b.codigo barrio, ta.nombre tipo_agua, r.nombre region, c.latitud, c.longitud, c.utm_norte, c.utm_este, c.ubicacion, c.observaciones, c.nombre_corto, c.nombre_alternativo, c.habilitado FROM cli_centro c LEFT JOIN geo_comuna co ON co.id=c.id_comuna LEFT JOIN geo_zona z ON z.id=c.id_zona LEFT JOIN geo_sector se ON se.id=c.id_sector LEFT JOIN geo_barrio b ON b.id=c.id_barrio LEFT JOIN geo_tipo_agua ta ON ta.id=c.id_tipo_agua LEFT JOIN geo_region r ON r.id=c.id_region`,
  cli_empresa_centro: `SELECT c.nombre centro, c.codigo, s.nombre servicio, s.rut srv_rut, x.habilitado, x.fecha_inicio FROM cli_empresa_centro x JOIN cli_centro c ON c.id=x.id_centro JOIN cli_empresa_servicio s ON s.id=x.id_empresa_servicio`,
  cli_contacto: `SELECT s.nombre servicio, s.rut srv_rut, k.nombre, k.email, k.telefono, c.nombre cargo, k.habilitado FROM cli_contacto k JOIN cli_empresa_servicio s ON s.id=k.id_empresa_servicio LEFT JOIN per_cargo c ON c.id=k.id_cargo`,
  revision_cli: `SELECT entidad, criterio, distancia_metros, estado, detalle_json FROM revision_duplicado WHERE entidad LIKE 'CLI[_]%'`,
};
const dump = async () => { const o = {}; for (const [t, s] of Object.entries(CONSULTAS)) o[t] = hash(await q(s)); return o; };
// Para diagnosticar: qué filas cambiaron entre dos lecturas de una vista (muestra las 3 primeras de cada lado)
const filas = async (t) => (await q(CONSULTAS[t])).map((r) => JSON.stringify(r)).sort();
const muestraDif = async (tabla, antes) => { const ahora = await filas(tabla); const a = new Set(antes), b = new Set(ahora);
  console.log(`   diferencias en ${tabla}: ${antes.filter((x) => !b.has(x)).length} filas ya no están, ${ahora.filter((x) => !a.has(x)).length} filas nuevas`);
  for (const x of antes.filter((x) => !b.has(x)).slice(0, 2)) console.log('     antes :', x.slice(0, 260)); for (const x of ahora.filter((x) => !a.has(x)).slice(0, 2)) console.log('     ahora :', x.slice(0, 260)); };
const mapas = async () => hash(await q(`SELECT tabla_legado, id_legado, tabla_nueva, id_nuevo, nota FROM mig_id_map WHERE tabla_nueva LIKE 'cli[_]%'`));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b); const dif = (a, b) => Object.keys(a).filter((k) => a[k] !== b[k]);
const limpiar = async () => { for (const t of ['mig_sync_error', 'mig_sync_estado', 'mig_sync_huella']) await q(`DELETE FROM ${t}`); };
const pasada = () => ejecutarPasada({ modulo: 'cli', log: (x) => { if (!/^  !/.test(x)) console.log(x); } });
const tamper = (tabla, clave) => q(`UPDATE mig_sync_huella SET hash1=hash1+1 WHERE tabla_legado=@t AND clave=@c`, { t: tabla, c: String(clave) });
const legadoDe = async (tabla, nuevo, tn) => (await q(`SELECT TOP 1 id_legado FROM mig_id_map WHERE tabla_legado=@t AND tabla_nueva=@n AND id_nuevo=@i ORDER BY id_legado`, { t: tabla, n: tn, i: nuevo }))[0]?.id_legado;

const SIN_A = process.argv.includes('--sin-A');   // reutiliza el estado y las huellas de una corrida anterior de la prueba A (ahorra ~8 min)
if (!SIN_A) await limpiar(); const S0 = await dump(), M0 = await mapas(); const FILAS0 = {}; for (const t of Object.keys(CONSULTAS)) FILAS0[t] = await filas(t);
// ¿el contenido actual es igual al de referencia? Si no, muestra qué filas cambiaron.
const mismo = async () => { const d = await dump(); const malas = dif(S0, d); if (!malas.length) return true; for (const t of malas) await muestraDif(t, FILAS0[t]); return false; }; const P0 = (await q(`SELECT COUNT(*) n FROM revision_duplicado WHERE entidad LIKE 'CLI[_]%'`))[0].n;
console.log('referencia (filas):', JSON.stringify(Object.fromEntries(Object.entries(S0).map(([k, v]) => [k, Number(v.split(':')[0])]))));

// A) idempotencia
let r = SIN_A ? { aplicados: 12779, avisos: 2, errores: 0 } : await pasada(); const A = SIN_A ? S0 : await dump();
ok(`A. pasada sobre datos ya cargados: copió ${r.aplicados}, avisos ${r.avisos}, errores ${r.errores}`, r.errores === 0 && r.aplicados === 12779 && r.avisos === 2);
ok(`A. contenido lógico de las 6 vistas sin cambios${dif(S0, A).length ? ' → distintas: ' + dif(S0, A).join(', ') : ''}`, igual(S0, A));
for (const t of dif(S0, A)) if (FILAS0[t]) await muestraDif(t, FILAS0[t]);
ok(`A. mig_id_map sin cambios`, (await mapas()) === M0);
const av = await q(`SELECT LEFT(mensaje, 80) m FROM mig_sync_error WHERE resuelto_en IS NULL`); console.log('   avisos abiertos:', JSON.stringify(av.map((x) => x.m)));
r = await pasada(); ok(`A. segunda pasada sin cambios (copió ${r.aplicados}, avisos ${r.avisos}, borró ${r.borrados})`, r.aplicados === 0 && r.avisos === 0 && r.borrados === 0);

// B) protección de fac_cliente_config: si el servicio tiene configuración, requiere_oc no se pisa con el valor del legado
const conCfg = (await q(`SELECT s.id, m.id_legado FROM cli_empresa_servicio s JOIN fac_cliente_config f ON f.id_empresa_servicio=s.id JOIN mig_id_map m ON m.tabla_legado='mae_empresaservicios' AND m.id_nuevo=s.id`))[0];
if (conCfg) {
  const antes = (await q(`SELECT requiere_oc, requiere_hes, email_facturacion, forma_pago_default FROM cli_empresa_servicio WHERE id=@i`, { i: conCfg.id }))[0];
  await q(`UPDATE cli_empresa_servicio SET requiere_oc=~requiere_oc WHERE id=@i`, { i: conCfg.id }); await tamper('mae_empresaservicios', conCfg.id_legado); r = await pasada();
  const desp = (await q(`SELECT requiere_oc, requiere_hes, email_facturacion, forma_pago_default FROM cli_empresa_servicio WHERE id=@i`, { i: conCfg.id }))[0];
  ok(`B. servicio con configuración de facturación: sus 4 campos NO se pisan (requiere_oc quedó en ${desp.requiere_oc}, no en el valor del legado)`, r.errores === 0 && desp.requiere_oc === !antes.requiere_oc && desp.requiere_hes === antes.requiere_hes && desp.email_facturacion === antes.email_facturacion && desp.forma_pago_default === antes.forma_pago_default);
  await q(`UPDATE cli_empresa_servicio SET requiere_oc=@v WHERE id=@i`, { i: conCfg.id, v: antes.requiere_oc });
} else console.log('B. omitida: no hay servicio con configuración');

// C) modificación
const pick = async (tabla, tn) => (await q(`SELECT TOP 1 m.id_legado, x.id FROM mig_id_map m JOIN ${tn} x ON x.id=m.id_nuevo WHERE m.tabla_legado=@t AND ISNULL(m.nota,'') NOT LIKE 'FUSIONADO%' ORDER BY m.id_legado`, { t: tabla }))[0];
const em = await pick('mae_empresa', 'cli_empresa'), sv = await pick('mae_empresaservicios', 'cli_empresa_servicio'), ce = await pick('mae_centro', 'cli_centro'), co = await pick('mae_contacto', 'cli_contacto');
await q(`UPDATE cli_empresa SET razon_social=N'X_MANUAL', habilitado=~habilitado WHERE id=@i`, { i: em.id }); await q(`UPDATE cli_empresa_servicio SET nombre=N'X_MANUAL', factor_km=9 WHERE id=@i`, { i: sv.id });
await q(`UPDATE cli_centro SET nombre=N'X_MANUAL', latitud=-1, id_comuna=NULL WHERE id=@i`, { i: ce.id }); await q(`UPDATE cli_contacto SET nombre=N'X_MANUAL', email=N'x@x' WHERE id=@i`, { i: co.id });
await tamper('mae_empresa', em.id_legado); await tamper('mae_empresaservicios', sv.id_legado); await tamper('mae_centro', ce.id_legado); await tamper('mae_contacto', co.id_legado);
r = await pasada(); ok(`C. modificación: restauró empresa, servicio, centro y contacto (copió ${r.aplicados}, errores ${r.errores})`, r.aplicados === 4 && r.errores === 0 && await mismo());

// F) alta: una empresa, un servicio y un centro hoja se borran (con sus pares de revisión) y el motor los recrea, incluidos los pares
const hoja = async (sqlSel) => (await q(sqlSel))[0];
const eh = await hoja(`SELECT TOP 1 e.id, m.id_legado FROM cli_empresa e JOIN mig_id_map m ON m.tabla_legado='mae_empresa' AND m.id_nuevo=e.id AND m.nota IS NULL WHERE EXISTS (SELECT 1 FROM revision_duplicado d WHERE d.entidad='CLI_EMPRESA' AND d.id_registro_b=e.id) AND NOT EXISTS (SELECT 1 FROM cli_empresa_servicio s WHERE s.id_empresa=e.id) AND NOT EXISTS (SELECT 1 FROM fic_ficha f WHERE f.id_empresa=e.id) AND NOT EXISTS (SELECT 1 FROM fac_prefactura f WHERE f.id_empresa=e.id) AND NOT EXISTS (SELECT 1 FROM fac_cotizacion f WHERE f.id_empresa=e.id) AND (SELECT COUNT(*) FROM mig_id_map x WHERE x.tabla_nueva='cli_empresa' AND x.id_nuevo=e.id)=1 ORDER BY m.id_legado DESC`);
if (eh) {
  await q(`DELETE FROM revision_duplicado WHERE entidad='CLI_EMPRESA' AND (id_registro_a=@i OR id_registro_b=@i)`, { i: eh.id }); await q(`DELETE FROM mig_id_map WHERE tabla_nueva='cli_empresa' AND id_nuevo=@i`, { i: eh.id }); await q(`DELETE FROM cli_empresa WHERE id=@i`, { i: eh.id }); await q(`DELETE FROM mig_sync_huella WHERE tabla_legado='mae_empresa' AND clave=@c`, { c: String(eh.id_legado) });
  r = await pasada(); ok(`F. alta de empresa ${eh.id_legado}: se recreó con sus pares de revisión (copió ${r.aplicados}, errores ${r.errores})`, r.errores === 0 && r.aplicados === 1 && await mismo());
} else console.log('F. omitida (empresa): no hay una empresa hoja con pares');
const sh = await hoja(`SELECT TOP 1 s.id, m.id_legado FROM cli_empresa_servicio s JOIN mig_id_map m ON m.tabla_legado='mae_empresaservicios' AND m.id_nuevo=s.id WHERE EXISTS (SELECT 1 FROM revision_duplicado d WHERE d.entidad='CLI_SERVICIO' AND d.id_registro_b=s.id) AND NOT EXISTS (SELECT 1 FROM cli_contacto k WHERE k.id_empresa_servicio=s.id) AND NOT EXISTS (SELECT 1 FROM cli_empresa_centro x WHERE x.id_empresa_servicio=s.id) AND NOT EXISTS (SELECT 1 FROM fic_ficha f WHERE f.id_empresa_servicio=s.id) AND NOT EXISTS (SELECT 1 FROM fac_convenio v WHERE v.id_empresa_servicio=s.id) AND NOT EXISTS (SELECT 1 FROM fac_cotizacion v WHERE v.id_empresa_servicio=s.id) AND NOT EXISTS (SELECT 1 FROM fac_prefactura v WHERE v.id_empresa_servicio=s.id) AND NOT EXISTS (SELECT 1 FROM fac_cliente_config v WHERE v.id_empresa_servicio=s.id) ORDER BY m.id_legado DESC`);
if (sh) {
  await q(`DELETE FROM revision_duplicado WHERE entidad='CLI_SERVICIO' AND (id_registro_a=@i OR id_registro_b=@i)`, { i: sh.id }); await q(`DELETE FROM mig_id_map WHERE tabla_nueva='cli_empresa_servicio' AND id_nuevo=@i`, { i: sh.id }); await q(`DELETE FROM cli_empresa_servicio WHERE id=@i`, { i: sh.id }); await q(`DELETE FROM mig_sync_huella WHERE tabla_legado='mae_empresaservicios' AND clave=@c`, { c: String(sh.id_legado) });
  r = await pasada(); ok(`F. alta de servicio ${sh.id_legado}: se recreó con sus pares de revisión (copió ${r.aplicados}, errores ${r.errores})`, r.errores === 0 && r.aplicados === 1 && await mismo());
} else console.log('F. omitida (servicio): no hay un servicio hoja con pares');
const ch = await hoja(`SELECT TOP 1 c.id, m.id_legado FROM cli_centro c JOIN mig_id_map m ON m.tabla_legado='mae_centro' AND m.id_nuevo=c.id AND m.nota IS NULL WHERE EXISTS (SELECT 1 FROM revision_duplicado d WHERE d.entidad='CLI_CENTRO' AND d.criterio='COORDENADAS_CERCANAS' AND d.id_registro_b=c.id) AND NOT EXISTS (SELECT 1 FROM fic_ficha f WHERE f.id_centro=c.id) AND NOT EXISTS (SELECT 1 FROM fac_convenio v WHERE v.id_centro=c.id) AND NOT EXISTS (SELECT 1 FROM fac_cotizacion v WHERE v.id_centro=c.id) ORDER BY m.id_legado DESC`);
const ch2 = await hoja(`SELECT TOP 1 c.id, m.id_legado FROM cli_centro c JOIN mig_id_map m ON m.tabla_legado='mae_centro' AND m.id_nuevo=c.id AND m.nota IS NULL WHERE EXISTS (SELECT 1 FROM revision_duplicado d WHERE d.entidad='CLI_CENTRO' AND d.criterio='MISMO_NOMBRE_MISMA_EMPRESA' AND d.id_registro_b=c.id) AND NOT EXISTS (SELECT 1 FROM fic_ficha f WHERE f.id_centro=c.id) AND NOT EXISTS (SELECT 1 FROM fac_convenio v WHERE v.id_centro=c.id) AND NOT EXISTS (SELECT 1 FROM fac_cotizacion v WHERE v.id_centro=c.id) ORDER BY m.id_legado DESC`);
for (const [c, etiqueta] of [[ch, 'coordenadas cercanas'], [ch2, 'mismo nombre y empresa']]) {
  if (!c) { console.log(`F. omitida (centro, ${etiqueta}): no hay candidato`); continue; }
  await q(`DELETE FROM revision_duplicado WHERE entidad='CLI_CENTRO' AND (id_registro_a=@i OR id_registro_b=@i)`, { i: c.id }); await q(`DELETE FROM cli_empresa_centro WHERE id_centro=@i`, { i: c.id }); await q(`DELETE FROM mig_id_map WHERE tabla_nueva='cli_centro' AND id_nuevo=@i`, { i: c.id }); await q(`DELETE FROM cli_centro WHERE id=@i`, { i: c.id }); await q(`DELETE FROM mig_sync_huella WHERE tabla_legado='mae_centro' AND clave=@c`, { c: String(c.id_legado) });
  r = await pasada(); ok(`F. alta de centro ${c.id_legado} (${etiqueta}): se recreó con su vínculo y sus pares de revisión (copió ${r.aplicados}, errores ${r.errores})`, r.errores === 0 && r.aplicados === 1 && await mismo());
}

// D) borrado, incluida una fila compartida por dos ids del legado (la fila nueva solo se borra al quitar el último)
const idF = (await q(`INSERT INTO cli_empresa (rut, razon_social) OUTPUT INSERTED.id VALUES ('FALSO-1', N'EMPRESA FALSA')`))[0].id;
for (const l of [99998, 99999]) { await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_empresa', @l, 'cli_empresa', @i)`, { l, i: idF }); await q(`INSERT INTO mig_sync_huella (tabla_legado, clave, hash1, hash2, filas) VALUES ('mae_empresa', @c, 1, 1, 1)`, { c: String(l) }); }
r = await pasada(); const q1 = (await q(`SELECT (SELECT COUNT(*) FROM cli_empresa WHERE id=@i) fila, (SELECT COUNT(*) FROM mig_id_map WHERE id_legado IN (99998,99999)) mapas`, { i: idF }))[0];
ok(`D. borrado de una fila compartida: se quitaron sus 2 ids del legado y la fila nueva también al desaparecer el último (borró ${r.borrados}; fila=${q1.fila} mapas=${q1.mapas}; errores ${r.errores})`, r.borrados === 2 && q1.fila === 0 && q1.mapas === 0 && r.errores === 0 && await mismo());
const idG = (await q(`INSERT INTO cli_empresa (rut, razon_social) OUTPUT INSERTED.id VALUES ('FALSO-2', N'EMPRESA FALSA 2')`))[0].id;
await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_empresa', 99997, 'cli_empresa', @i)`, { i: idG }); await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo, nota) VALUES ('mae_empresa', 99996, 'cli_empresa', @i, 'FUSIONADO_REVISION')`, { i: idG });
await q(`INSERT INTO mig_sync_huella (tabla_legado, clave, hash1, hash2, filas) VALUES ('mae_empresa','99996',1,1,1)`); r = await pasada();
const q2 = (await q(`SELECT (SELECT COUNT(*) FROM cli_empresa WHERE id=@i) fila`, { i: idG }))[0].fila; ok(`D. desaparece solo el id fusionado: la fila nueva se conserva porque otro id del legado sigue apuntando a ella (fila=${q2})`, q2 === 1 && r.errores === 0);
await q(`DELETE FROM mig_id_map WHERE id_legado=99997`); await q(`DELETE FROM cli_empresa WHERE id=@i`, { i: idG }); await q(`DELETE FROM mig_sync_huella WHERE clave IN ('99996','99997')`);

// E) error: un servicio cuya empresa padre no está mapeada se encola; al corregirlo se aplica solo
const s2 = (await q(`SELECT TOP 1 m.id_legado, s.id FROM mig_id_map m JOIN cli_empresa_servicio s ON s.id=m.id_nuevo WHERE m.tabla_legado='mae_empresaservicios' AND ISNULL(m.nota,'') NOT LIKE 'FUSIONADO%' AND EXISTS (SELECT 1 FROM cli_contacto k WHERE k.id_empresa_servicio=s.id) ORDER BY m.id_legado`))[0];
const L = await new sql.ConnectionPool(cfg(process.env.DB_DATABASE)).connect(); const padreLeg = (await L.request().query(`SELECT TOP 1 id_empresa FROM mae_empresa WHERE id_empresaservicio=${Number(s2.id_legado)} ORDER BY id_empresa`)).recordset[0]; await L.close();
const mapaPadre = (await q(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado='mae_empresa' AND id_legado=@l`, { l: Number(padreLeg.id_empresa) }))[0];
await q(`DELETE FROM mig_id_map WHERE tabla_legado='mae_empresa' AND id_legado=@l`, { l: Number(padreLeg.id_empresa) }); await tamper('mae_empresaservicios', s2.id_legado);
r = await pasada(); const cola = await q(`SELECT LEFT(mensaje,80) m FROM mig_sync_error WHERE resuelto_en IS NULL AND mensaje NOT LIKE 'AVISO:%'`);
ok(`E. error encolado sin detener la pasada (errores ${r.errores}; "${cola[0]?.m}")`, r.errores === 1 && cola.length === 1);
await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_empresa', @l, 'cli_empresa', @i)`, { l: Number(padreLeg.id_empresa), i: mapaPadre.id_nuevo });
r = await pasada(); ok(`E. al corregir la causa se aplica solo (copió ${r.aplicados}, errores ${r.errores})`, r.aplicados === 1 && r.errores === 0 && await mismo());

// M) FUSIÓN REAL con el servicio de la pantalla de revisión: el cambio de la fila descartada NO pisa a la que quedó
const par = (await q(`SELECT TOP 1 d.id, d.id_registro_a a, d.id_registro_b b, d.observacion FROM revision_duplicado d WHERE d.entidad='CLI_EMPRESA' AND d.criterio='MISMO_RUT' AND d.estado='PENDIENTE' AND NOT EXISTS (SELECT 1 FROM cli_empresa_servicio s WHERE s.id_empresa=d.id_registro_b) AND NOT EXISTS (SELECT 1 FROM fic_ficha f WHERE f.id_empresa=d.id_registro_b) AND NOT EXISTS (SELECT 1 FROM fac_prefactura f WHERE f.id_empresa=d.id_registro_b) AND NOT EXISTS (SELECT 1 FROM fac_cotizacion f WHERE f.id_empresa=d.id_registro_b) AND (SELECT COUNT(*) FROM mig_id_map x WHERE x.tabla_nueva='cli_empresa' AND x.id_nuevo=d.id_registro_b)=1 AND (SELECT COUNT(*) FROM revision_duplicado y WHERE y.entidad='CLI_EMPRESA' AND (y.id_registro_a=d.id_registro_b OR y.id_registro_b=d.id_registro_b))=1 ORDER BY d.id`))[0];
if (par) {
  const idPierde = await legadoDe('mae_empresa', par.b, 'cli_empresa'), idQueda = await legadoDe('mae_empresa', par.a, 'cli_empresa');
  const antes = (await q(`SELECT razon_social, rut FROM cli_empresa WHERE id=@i`, { i: par.a }))[0];
  await revisionDuplicadosService.resolver(par.id, { accion: 'FUSIONAR', mantener: 'A', observacion: 'prueba de sincronización' }, 1);
  const nota = (await q(`SELECT nota FROM mig_id_map WHERE tabla_legado='mae_empresa' AND id_legado=@l`, { l: idPierde }))[0].nota;
  ok(`M. la fusión marcó la fila descartada del legado (${idPierde}) como "${nota}" y apunta a la que quedó (${idQueda})`, nota === 'FUSIONADO_REVISION');
  await q(`UPDATE cli_empresa SET razon_social=N'NOMBRE ELEGIDO EN LA REVISION' WHERE id=@i`, { i: par.a });   // una decisión de la persona sobre la fila que quedó
  await tamper('mae_empresa', idPierde); r = await pasada();
  const desp = (await q(`SELECT razon_social FROM cli_empresa WHERE id=@i`, { i: par.a }))[0].razon_social; const avisos = await q(`SELECT mensaje FROM mig_sync_error WHERE resuelto_en IS NULL AND mensaje LIKE 'AVISO:%fusionada%'`);
  ok(`M. el cambio de la fila DESCARTADA no pisó a la que quedó (nombre "${desp}") y quedó registrado como aviso (avisos ${r.avisos}, errores ${r.errores})`, desp === 'NOMBRE ELEGIDO EN LA REVISION' && r.avisos === 1 && r.aplicados === 0 && r.errores === 0 && avisos.length === 1);
  await tamper('mae_empresa', idQueda); r = await pasada(); const desp2 = (await q(`SELECT razon_social FROM cli_empresa WHERE id=@i`, { i: par.a }))[0].razon_social;
  ok(`M. el cambio de la fila que QUEDÓ sí se aplica (nombre vuelve a "${desp2}")`, desp2 === antes.razon_social && r.aplicados === 1);
  // restauración: la descartada se recrea como fila propia y la cola vuelve a su estado original
  await q(`DELETE FROM mig_id_map WHERE tabla_legado='mae_empresa' AND id_legado=@l`, { l: idPierde }); await q(`DELETE FROM mig_sync_huella WHERE tabla_legado='mae_empresa' AND clave=@c`, { c: String(idPierde) });
  await q(`UPDATE mig_sync_error SET resuelto_en=SYSDATETIME() WHERE mensaje LIKE 'AVISO:%fusionada%'`); r = await pasada();
  const nueva = (await q(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado='mae_empresa' AND id_legado=@l`, { l: idPierde }))[0];
  await q(`DELETE FROM revision_duplicado WHERE id=@i`, { i: par.id });   // la resolución FUSIONAR de la prueba
  ok(`M. restauración: la fila descartada se recreó (${nueva ? 'sí' : 'NO'}) y la cola de revisión quedó como al principio`, !!nueva && r.errores === 0 && await mismo());
} else console.log('M. omitida: no hay un par de empresas con la fila descartada sin dependientes');

const P1 = (await q(`SELECT COUNT(*) n FROM revision_duplicado WHERE entidad LIKE 'CLI[_]%'`))[0].n; ok(`Z. pares de revisión de cli_ al final: ${P1} (al principio ${P0})`, P1 === P0);
await D.close(); process.exit(process.exitCode || 0);
