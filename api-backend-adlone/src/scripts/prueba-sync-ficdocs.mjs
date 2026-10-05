// Prueba de los manejadores de mae_transporte (catálogo) y App_Ma_Documentos_Enviados (documentos enviados de una visita).
// Las filas del legado que citan una agenda existente son inexistentes hoy (todas son de pruebas anteriores), así que el legado NO se toca:
// se le entrega a cada manejador una "conexión" falsa que responde con una fila inventada; todo se escribe en una transacción de la base TEST
// y se REVIERTE al final.
import 'dotenv/config'; import sql from 'mssql';
import { ejecutor } from '../sync/estado.js';
import { manejadores as docs } from '../sync/handlers/ficdocs.js';
import { manejadores as cat } from '../sync/handlers/ficcat.js';

const DB = process.env.MIG_TEST_DB || 'ADL ONE TEST'; if (!/TEST/i.test(DB)) throw new Error('la base destino no contiene TEST');
const N = await new sql.ConnectionPool({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: DB, options: { encrypt: true, trustServerCertificate: true } }).connect();
const fake = (fila) => ({ request: () => { const r = { input: () => r, query: async () => ({ recordset: fila ? [fila] : [] }) }; return r; } });
const ok = (n, c) => { console.log((c ? 'OK  ' : 'FALLA ') + n); if (!c) process.exitCode = 1; };
const tx = new sql.Transaction(N); await tx.begin(); const run = ejecutor(tx); const ctx = {};
try {
  const cuenta = async (t) => (await run(`SELECT COUNT(*) n FROM ${t}`))[0].n;
  const visita = (await run(`SELECT TOP 1 id, id_agendamam_legacy a FROM fic_visita ORDER BY id`))[0];
  const lab = (await run(`SELECT TOP 1 id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado='mae_laboratorioensayo' AND id_nuevo>0 ORDER BY id_legado`))[0];
  const per = (await run(`SELECT TOP 1 id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado='mae_muestreador' AND id_nuevo>0 ORDER BY id_legado`))[0];
  const f = new Date('2026-09-01T12:00:00Z');
  const fila = (o) => ({ id_envio: 90001, id_agendamam: visita.a, tipo_documento: 'FOMA', id_laboratorio: null, fecha_envio: f, usuario_envio: per.id_legado, destinatario: 'cliente@ejemplo.cl', ...o });

  // --- transporte (catálogo) ---
  const T = cat.mae_transporte; const t0 = await cuenta('fic_transporte');
  await T.upsert({ ctx, run, leg: fake({ id_transporte: 90, nombre_transporte: 'Transporte de prueba', habilitado: 'S' }), clave: 90 });
  await T.upsert({ ctx, run, leg: fake({ id_transporte: 90, nombre_transporte: 'Transporte de prueba', habilitado: 'S' }), clave: 90 });
  ok(`transporte: alta e idempotente (${t0}→${await cuenta('fic_transporte')})`, (await cuenta('fic_transporte')) === t0 + 1);
  const r0 = await T.upsert({ ctx, run, leg: fake({ id_transporte: 0, nombre_transporte: '', habilitado: 'N' }), clave: 0 });
  ok('transporte: la fila de relleno id 0 no se copia', r0 !== 'SIN_FILA' && (await cuenta('fic_transporte')) === t0 + 1);
  await T.borrar({ ctx, run, clave: 90 }); ok('transporte: borrado', (await cuenta('fic_transporte')) === t0);

  // --- documentos ---
  const D = docs.App_Ma_Documentos_Enviados; const d0 = await cuenta('fic_visita_documento');
  await D.upsert({ ctx, run, leg: fake(fila({})), clave: 90001 }); await D.upsert({ ctx, run, leg: fake(fila({})), clave: 90001 });
  const foma = (await run(`SELECT d.tipo, d.id_laboratorio_ensayo, d.id_persona_envio, d.destinatario FROM fic_visita_documento d JOIN mig_id_map m ON m.id_nuevo=d.id AND m.tabla_legado='App_Ma_Documentos_Enviados' AND m.id_legado=90001`))[0];
  ok(`documento FOMA: alta e idempotente (${d0}→${await cuenta('fic_visita_documento')})`, (await cuenta('fic_visita_documento')) === d0 + 1 && foma.tipo === 'FOMA' && foma.id_laboratorio_ensayo === null && foma.id_persona_envio === per.id_nuevo && foma.destinatario === 'cliente@ejemplo.cl');
  if (lab) {
    await D.upsert({ ctx, run, leg: fake(fila({ id_envio: 90002, tipo_documento: 'CADENA', id_laboratorio: lab.id_legado })), clave: 90002 });
    const cad = (await run(`SELECT d.tipo, d.id_laboratorio_ensayo FROM fic_visita_documento d JOIN mig_id_map m ON m.id_nuevo=d.id AND m.tabla_legado='App_Ma_Documentos_Enviados' AND m.id_legado=90002`))[0];
    ok('documento CADENA: se traduce a CADENA_CUSTODIA y resuelve el laboratorio', cad.tipo === 'CADENA_CUSTODIA' && cad.id_laboratorio_ensayo === lab.id_nuevo);
  }
  await D.upsert({ ctx, run, leg: fake(fila({ destinatario: 'otro@ejemplo.cl' })), clave: 90001 });
  ok('documento: una modificación en el legado se refleja', (await run(`SELECT d.destinatario FROM fic_visita_documento d JOIN mig_id_map m ON m.id_nuevo=d.id AND m.tabla_legado='App_Ma_Documentos_Enviados' AND m.id_legado=90001`))[0].destinatario === 'otro@ejemplo.cl');
  const antes = await cuenta('fic_visita_documento');
  const av = await D.upsert({ ctx, run, leg: fake(fila({ id_envio: 90003, id_agendamam: 99999999 })), clave: 90003 });
  ok('documento: agenda inexistente → aviso (no error, no fila)', typeof av === 'string' && av.startsWith('AVISO:') && (await cuenta('fic_visita_documento')) === antes);
  ok('documento: tipo desconocido → error claro', await D.upsert({ ctx, run, leg: fake(fila({ id_envio: 90004, tipo_documento: 'XYZ' })), clave: 90004 }).then(() => false, (e) => /desconocido/.test(e.message)));
  ok('documento: laboratorio sin equivalente → error claro', await D.upsert({ ctx, run, leg: fake(fila({ id_envio: 90005, id_laboratorio: 99999999 })), clave: 90005 }).then(() => false, (e) => /laboratorio/.test(e.message)));
  ok('documento: fila inexistente en el legado → SIN_FILA', (await D.upsert({ ctx, run, leg: fake(null), clave: 90001 })) === 'SIN_FILA');
  await D.borrar({ ctx, run, clave: 90001 }); if (lab) await D.borrar({ ctx, run, clave: 90002 });
  ok(`documento: borrado (${await cuenta('fic_visita_documento')})`, (await cuenta('fic_visita_documento')) === d0);
} catch (e) { console.log('ERROR en la prueba:', e.message); process.exitCode = 1; }
await tx.rollback(); console.log('(todo revertido: no queda nada en la base)'); await N.close(); process.exit(process.exitCode || 0);
