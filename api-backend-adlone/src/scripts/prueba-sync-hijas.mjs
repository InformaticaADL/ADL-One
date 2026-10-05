// Prueba de los manejadores de las tablas hijas (sol_ y per_), que hoy no tienen filas en el legado.
// El legado NO se toca: se le entrega a cada manejador una "conexión" falsa que responde con una fila inventada; todo se escribe en
// una transacción de la base TEST y se REVIERTE al final.
import 'dotenv/config'; import sql from 'mssql';
import { ejecutor } from '../sync/estado.js';
import { manejadores as sol } from '../sync/handlers/solhijos.js';
import { manejadores as per } from '../sync/handlers/perhijos.js';

const DB = process.env.MIG_TEST_DB || 'ADL ONE TEST'; if (!/TEST/i.test(DB)) throw new Error('la base destino no contiene TEST');
const N = await new sql.ConnectionPool({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: DB, options: { encrypt: true, trustServerCertificate: true } }).connect();
const fake = (fila) => ({ request: () => { const r = { input: () => r, query: async () => ({ recordset: fila ? [fila] : [] }) }; return r; } });
const ok = (n, c) => { console.log((c ? 'OK  ' : 'FALLA ') + n); if (!c) process.exitCode = 1; };
const tx = new sql.Transaction(N); await tx.begin(); const run = ejecutor(tx); const ctx = {};
try {
  const s = (await run(`SELECT TOP 1 id FROM sol_solicitud ORDER BY id`))[0].id;
  const usr = (await run(`SELECT TOP 1 id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado='mae_usuario#usr' AND id_nuevo>0 ORDER BY id_legado`))[0];
  const per_ = (await run(`SELECT TOP 1 id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado='mae_muestreador' AND id_nuevo>0 ORDER BY id_legado`))[0];
  const comp = (await run(`SELECT TOP 1 id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado='mae_competencia' ORDER BY id_legado`))[0];
  const rol = (await run(`SELECT TOP 1 id_legado FROM mig_id_map WHERE tabla_legado='mae_rol' ORDER BY id_legado`))[0];
  const f = new Date('2026-09-01T12:00:00Z');
  const cuenta = async (t) => (await run(`SELECT COUNT(*) n FROM ${t}`))[0].n;
  const paso = async (nombre, h, tabla, fila, clave) => {
    const a = await cuenta(tabla); const r1 = await h.upsert({ ctx, run, leg: fake(fila), clave }); const b = await cuenta(tabla);
    await h.upsert({ ctx, run, leg: fake(fila), clave }); const c = await cuenta(tabla);
    ok(`${nombre}: alta (${a}→${b}) e idempotente (${c})`, r1 !== 'SIN_FILA' && b === a + 1 && c === b);
    await h.borrar({ ctx, run, clave }); ok(`${nombre}: borrado (${await cuenta(tabla)})`, (await cuenta(tabla)) === a);
    ok(`${nombre}: fila inexistente en el legado → SIN_FILA`, (await h.upsert({ ctx, run, leg: fake(null), clave })) === 'SIN_FILA');
  };
  await paso('sol_equipo_solicitud', sol.mae_solicitud_equipo, 'sol_equipo_solicitud', { id_solicitud: 90001, tipo_solicitud: 'ALTA', estado: 'PENDIENTE', datos_json: '{"a":1}', usuario_solicita: usr.id_legado, usuario_revisa: 0, fecha_solicitud: f, fecha_revision: null, feedback_admin: null, origen_solicitud: 'WEB', usuario_tecnica: 0, fecha_revision_tecnica: null, feedback_tecnica: null, estado_tecnica: null, usuario_aprueba: 0, fecha_aprobacion: null, feedback_aprobacion: null }, 90001);
  await paso('sol_derivacion', sol.mae_solicitud_derivacion, 'sol_derivacion', { id_derivacion: 90002, id_solicitud: s, area_origen: 'A', area_destino: 'B', usuario_origen: usr.id_legado, usuario_destino: usr.id_legado, motivo: 'prueba', fecha: f, id_rol_destino: rol ? rol.id_legado : 0 }, 90002);
  await paso('sol_comentario (usuario)', sol.mae_solicitud_comentario, 'sol_comentario', { id_comentario: 90003, id_solicitud: s, id_usuario: usr.id_legado, mensaje: 'hola', es_privado: false, es_sistema: false, fecha: f }, 90003);
  // adjunto: necesita el comentario ya sincronizado
  await sol.mae_solicitud_comentario.upsert({ ctx, run, leg: fake({ id_comentario: 90003, id_solicitud: s, id_usuario: usr.id_legado, mensaje: 'hola', es_privado: false, es_sistema: false, fecha: f }), clave: 90003 });
  await paso('sol_archivo', sol.mae_solicitud_adjunto, 'sol_archivo', { id_adjunto: 90004, id_solicitud: s, id_comentario: 90003, nombre_archivo: 'a.pdf', ruta_archivo: '/x/a.pdf', tipo_archivo: 'application/pdf', fecha: f }, 90004);
  ok('sol_archivo: comentario inexistente → error claro', await sol.mae_solicitud_adjunto.upsert({ ctx, run, leg: fake({ id_adjunto: 90005, id_solicitud: s, id_comentario: 99999, nombre_archivo: 'b', ruta_archivo: '/b', tipo_archivo: 'x', fecha: f }), clave: 90005 }).then(() => false, (e) => /comentario/.test(e.message)));
  if (per_ && comp) {
    await paso('per_persona_competencia', per.mae_muestreador_competencia, 'per_persona_competencia', { id_muestreador: per_.id_legado, id_competencia: comp.id_legado, fecha_asignacion: f }, `${per_.id_legado}|${comp.id_legado}`);
    await paso('per_persona_documento', per.mae_muestreador_documento, 'per_persona_documento', { id_documento: 90006, id_muestreador: per_.id_legado, nombre_documento: 'Licencia', descripcion: 'x', ruta_archivo: '/d', fecha_subida: f, id_usuario_subida: usr.id_legado }, 90006);
  }
} catch (e) { console.log('ERROR en la prueba:', e.message); process.exitCode = 1; }
await tx.rollback(); console.log('(todo revertido: no queda nada en la base)'); await N.close(); process.exit(process.exitCode || 0);
