import 'dotenv/config'; import sql from 'mssql'; import crypto from 'node:crypto';
import { ejecutarPasada } from '../sync/motor.js';
const D = await new sql.ConnectionPool({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: 'ADL ONE TEST', options: { encrypt: true, trustServerCertificate: true } }).connect();
const q = async (s, p = {}) => { const r = D.request(); for (const [k, v] of Object.entries(p)) r.input(k, v); return (await r.query(s)).recordset; };
const ok = (n, c) => console.log((c ? 'OK  ' : 'FALLA ') + n);
const TABLAS = ['fac_valor_uf', 'fac_cliente_config', 'fac_lote_emision', 'fac_cotizacion', 'fac_cotizacion_seccion', 'fac_cotizacion_item', 'fac_cotizacion_portal_solicitud', 'fac_prefactura', 'fac_prefactura_caso', 'fac_orden_compra', 'fac_emision', 'fac_oc_candidato', 'fac_historial', 'fac_convenio', 'fac_convenio_precio'];
const snap = async () => { const o = {}; for (const t of TABLAS) { const r = await q(`SELECT * FROM ${t} ORDER BY id`); o[t] = `${r.length}:${crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex').slice(0, 12)}`; } return o; };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pasada = async () => ejecutarPasada({ modulo: 'fac', log: (m) => console.log(m) });
const bump = (tabla, clave) => q(`UPDATE mig_sync_huella SET hash1 = hash1 + 1 WHERE tabla_legado=@t AND clave=@c`, { t: tabla, c: String(clave) });

let r = await pasada(); console.log('   pasada previa (cambios vivos del legado):', r.aplicados); r = await pasada(); ok(`0. estado de partida estable (copió ${r.aplicados}, errores=${r.errores})`, r.aplicados === 0 && r.errores === 0);
const S0 = await snap(); console.log('referencia:', JSON.stringify(S0));
r = await pasada(); ok(`A. idempotencia (copió ${r.aplicados}, borró ${r.borrados})`, r.aplicados === 0 && r.borrados === 0 && igual(await snap(), S0));

// B) alta: se borra una UF con su mapa y huella → el motor la vuelve a crear idéntica
const uf = (await q(`SELECT TOP 1 * FROM fac_valor_uf ORDER BY id DESC`))[0];
await q(`DELETE FROM fac_valor_uf WHERE id=@i`, { i: uf.id }); await q(`DELETE FROM mig_id_map WHERE tabla_legado='fac_valor_uf' AND id_legado=@i`, { i: uf.id }); await q(`DELETE FROM mig_sync_huella WHERE tabla_legado='fac_valor_uf' AND clave=@c`, { c: String(uf.id) });
r = await pasada(); ok(`B. alta: recreó la UF ${uf.id} (copió ${r.aplicados}, errores=${r.errores})`, r.aplicados === 1 && r.errores === 0 && igual(await snap(), S0));

// C) modificación de una prefactura
const pf = (await q(`SELECT TOP 1 id, glosa, total_clp FROM fac_prefactura ORDER BY id`))[0];
await q(`UPDATE fac_prefactura SET glosa=N'cambiada a mano', total_clp=total_clp+1 WHERE id=@i`, { i: pf.id }); await bump('fac_prefactura', pf.id);
r = await pasada(); const pf2 = (await q(`SELECT glosa, total_clp FROM fac_prefactura WHERE id=@i`, { i: pf.id }))[0];
ok(`C. modificación: restauró la prefactura ${pf.id} (copió ${r.aplicados})`, r.aplicados === 1 && pf2.glosa === pf.glosa && Number(pf2.total_clp) === Number(pf.total_clp) && igual(await snap(), S0));

// D) borrado: UF falsa con huella → se elimina
await q(`SET IDENTITY_INSERT fac_valor_uf ON; INSERT INTO fac_valor_uf (id, fecha, valor, fuente) VALUES (99999, '2001-01-01', 1, 'FALSO'); SET IDENTITY_INSERT fac_valor_uf OFF;`);
await q(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('fac_valor_uf', 99999, 'fac_valor_uf', 99999)`); await q(`INSERT INTO mig_sync_huella (tabla_legado, clave, hash1, hash2, filas) VALUES ('fac_valor_uf', '99999', 1, 1, 1)`);
r = await pasada(); const rest = (await q(`SELECT (SELECT COUNT(*) FROM fac_valor_uf WHERE id=99999) f, (SELECT COUNT(*) FROM mig_sync_huella WHERE clave='99999') h, (SELECT COUNT(*) FROM mig_id_map WHERE id_legado=99999) m`))[0];
ok(`D. borrado (borró ${r.borrados}; quedan fila=${rest.f} huella=${rest.h} mapa=${rest.m})`, r.borrados === 1 && !rest.f && !rest.h && !rest.m && igual(await snap(), S0));

// E) la configuración de facturación manda sobre el maestro del servicio
const cfg = (await q(`SELECT TOP 1 c.id, c.id_empresa_servicio, s.requiere_oc, s.requiere_hes FROM fac_cliente_config c JOIN cli_empresa_servicio s ON s.id=c.id_empresa_servicio ORDER BY c.id`))[0];
await q(`UPDATE cli_empresa_servicio SET requiere_oc=@a, requiere_hes=@b WHERE id=@i`, { a: !cfg.requiere_oc, b: !cfg.requiere_hes, i: cfg.id_empresa_servicio }); await bump('fac_cliente_config', cfg.id);
r = await pasada(); const s2 = (await q(`SELECT requiere_oc, requiere_hes FROM cli_empresa_servicio WHERE id=@i`, { i: cfg.id_empresa_servicio }))[0];
ok(`E. config gana: requiere_oc/hes restaurados (copió ${r.aplicados})`, r.aplicados === 1 && s2.requiere_oc === cfg.requiere_oc && s2.requiere_hes === cfg.requiere_hes);

// F) tarifa: cambiar el precio a mano → el motor lo restaura al del legado
const tf = (await q(`SELECT TOP 1 m.id_legado, p.id, p.precio_uf FROM mig_id_map m JOIN fac_convenio_precio p ON p.id=m.id_nuevo WHERE m.tabla_legado='fac_tarifa' ORDER BY m.id_legado`))[0];
await q(`UPDATE fac_convenio_precio SET precio_uf=precio_uf+1 WHERE id=@i`, { i: tf.id }); await bump('fac_tarifa', tf.id_legado);
r = await pasada(); const tf2 = (await q(`SELECT precio_uf FROM fac_convenio_precio WHERE id=@i`, { i: tf.id }))[0];
ok(`F. tarifa ${tf.id_legado}: precio restaurado (${tf2.precio_uf} vs ${tf.precio_uf}; copió ${r.aplicados})`, r.aplicados === 1 && Number(tf2.precio_uf) === Number(tf.precio_uf));

// G) cola de errores: un caso cuya visita no se encuentra se encola y se aplica al corregir la causa
const caso = (await q(`SELECT TOP 1 c.id, v.id vid, v.id_agendamam_legacy ag FROM fac_prefactura_caso c JOIN fic_visita v ON v.id=c.id_visita ORDER BY c.id`))[0];
await q(`UPDATE fic_visita SET id_agendamam_legacy=NULL WHERE id=@i`, { i: caso.vid }); await bump('fac_prefactura_caso', caso.id);
r = await pasada(); const err = await q(`SELECT tabla_legado, clave, resuelto_en, LEFT(mensaje,80) m FROM mig_sync_error WHERE tabla_legado='fac_prefactura_caso' AND resuelto_en IS NULL`);
ok(`G. error encolado (errores=${r.errores}; cola=${JSON.stringify(err.map((e) => `${e.tabla_legado}/${e.clave}`))})`, r.errores === 1 && err.length === 1 && !err[0].resuelto_en); console.log('    mensaje:', err[0]?.m);
await q(`UPDATE fic_visita SET id_agendamam_legacy=@a WHERE id=@i`, { a: caso.ag, i: caso.vid });
r = await pasada(); const ab = (await q(`SELECT COUNT(*) n FROM mig_sync_error WHERE tabla_legado='fac_prefactura_caso' AND resuelto_en IS NULL`))[0].n;
ok(`G. al corregir se aplica solo (copió ${r.aplicados}, abiertos=${ab})`, r.aplicados === 1 && r.errores === 0 && ab === 0 && igual(await snap(), S0));

// H) lista base de precios: mae_tecnica.precio_lista se sincroniza desde el handler de cat_
const lp = (await q(`SELECT TOP 1 m.id_legado, p.id, p.precio_uf FROM mig_id_map m JOIN fac_lista_precio_tecnica p ON p.id=m.id_nuevo WHERE m.tabla_legado='mae_tecnica#precio_lista' AND m.id_legado>0 ORDER BY m.id_legado`))[0];
const nLista = (await q(`SELECT COUNT(*) n FROM fac_lista_precio_tecnica`))[0].n;
await q(`UPDATE fac_lista_precio_tecnica SET precio_uf=precio_uf+5 WHERE id=@i`, { i: lp.id }); await bump('mae_tecnica', lp.id_legado);
r = await ejecutarPasada({ modulo: 'cat', tabla: 'mae_tecnica', log: (m) => console.log(m) });
ok(`H. precio de lista de la técnica ${lp.id_legado} restaurado (${(await q(`SELECT precio_uf p FROM fac_lista_precio_tecnica WHERE id=@i`, { i: lp.id }))[0].p} vs ${lp.precio_uf}; copió ${r.aplicados})`, r.aplicados === 1 && r.errores === 0);
await q(`DELETE FROM fac_lista_precio_tecnica WHERE id=@i`, { i: lp.id }); await q(`DELETE FROM mig_id_map WHERE tabla_legado='mae_tecnica#precio_lista' AND id_legado=@l`, { l: lp.id_legado }); await bump('mae_tecnica', lp.id_legado);
r = await ejecutarPasada({ modulo: 'cat', tabla: 'mae_tecnica', log: (m) => console.log(m) });
ok(`H. fila de lista borrada: se recrea (total ${(await q(`SELECT COUNT(*) n FROM fac_lista_precio_tecnica`))[0].n} vs ${nLista})`, r.errores === 0 && (await q(`SELECT COUNT(*) n FROM fac_lista_precio_tecnica`))[0].n === nLista);
await D.close(); process.exit(0);
