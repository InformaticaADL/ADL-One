/* =====================================================================
   Migración del módulo sol_ (solicitudes / URS): legado (PruebasInformatica) → esquema v5
   =====================================================================
   Uso:
     node src/scripts/migracion-sol.mjs                 → ensayo: carga y hace ROLLBACK
     node src/scripts/migracion-sol.mjs --apply         → carga y confirma (COMMIT)
     node src/scripts/migracion-sol.mjs --apply --reset → borra lo sol_ previo y recarga

   Requiere: parche 13_patch_sol.sql; usr_ y per_ ya migrados.
   SEGURIDAD: del legado solo lee; solo escribe en una base cuyo nombre contenga "TEST";
   una transacción; sin --apply termina en ROLLBACK.

   REGLAS
     - Se CONSERVAN los ids del legado en sol_tipo, sol_solicitud y sol_equipo_solicitud (IDENTITY_INSERT): el código y las
       notificaciones los citan.
     - Quién solicita: el legado escribe en la misma columna el id de un USUARIO (ADL ONE) o de un MUESTREADOR (APP MAM).
       Se decide por el TIPO de solicitud: si mae_solicitud_tipo.cod_permiso_crear = 'MUESTREADOR' el id es de un muestreador
       (→ per_persona); si no, de un usuario (→ usr_usuario). Si no resuelve en su espacio se prueba el otro y se avisa.
       Historial y comentarios siguen la misma regla (el id igual al del solicitante hereda su espacio).
     - Permisos por tipo (rel_solicitud_tipo_permiso, 74) y notificaciones (rel_solicitud_tipo_notificacion, 11) se migran.
       mae_solicitud_tipo_permiso (2 filas) NO: ningún código la lee (la vigente es rel_solicitud_tipo_permiso).
     - Descartado a propósito: mae_solicitud_tipo.plantilla_json y permiso_resolucion (ningún código los lee).
     - notificado_uns (bandera) → notificado_en (fecha; NULL = pendiente).
     - Tablas de comentarios, adjuntos, derivaciones y solicitudes de equipo están vacías hoy: el cargador las mapea pero NO
       se pudo comprobar con datos reales.
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
const insId = async (table, id, obj) => {
  const e = Object.entries({ id, ...obj }).filter(([, v]) => v !== undefined);
  const params = Object.fromEntries(e.map(([, v], i) => [`p${i}`, v]));
  await run(`SET IDENTITY_INSERT ${table} ON; INSERT INTO ${table} (${e.map(([k]) => `[${k}]`).join(',')}) VALUES (${e.map((_, i) => `@p${i}`).join(',')}); SET IDENTITY_INSERT ${table} OFF;`, params);
};
const mapear = (tl, il, tn, inu) => run(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES (@a,@b,@c,@d)`, { a: tl, b: il, c: tn, d: inu });
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const t = (s) => norm(s) || null;
const raw = (s) => (s == null || norm(s) === '' ? null : String(s));
const yes = (v) => v === true || v === 1 || /^(S|SI|1|TRUE)$/i.test(norm(v));
const dt = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) && d.getUTCFullYear() > 1900 ? d : null);
const warns = new Map(); const warn = (k, ej) => { const w = warns.get(k) || { n: 0, ej: [] }; w.n++; if (w.ej.length < 4 && ej != null) w.ej.push(ej); warns.set(k, w); };
// Texto libre (observaciones, feedback, motivo…): se conserva TAL CUAL (saltos de línea incluidos); solo se recorta si excede el límite.
const libre = (s, n, k) => { if (s == null || String(s).trim() === '') return null; const x = String(s); if (x.length > n) { warn(`${k}: texto recortado a ${n}`, x.slice(0, 30)); return x.slice(0, n); } return x; };
const cortar = (s, n, k) => { const x = t(s); if (x && x.length > n) { warn(`${k}: texto recortado a ${n}`, x.slice(0, 30)); return x.slice(0, n); } return x; };

try {
  if (!(await run(`SELECT OBJECT_ID('sol_tipo_permiso') AS o`))[0].o) throw new Error('Falta el parche 13_patch_sol.sql (tabla sol_tipo_permiso). Ejecútalo en SSMS sobre la base de prueba.');
  const TABLAS = ['sol_archivo', 'sol_derivacion', 'sol_historial', 'sol_comentario', 'sol_equipo_solicitud', 'sol_solicitud', 'sol_tipo_notificacion', 'sol_tipo_permiso', 'sol_tipo'];
  let previo = 0; for (const tb of TABLAS) previo += (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  if (previo > 0 && !RESET) throw new Error('Las tablas sol_ ya tienen datos. Usa --reset para borrarlas y recargar.');
  if (RESET) {
    await run(`DELETE FROM mig_id_map WHERE tabla_nueva IN (${TABLAS.map((x) => `'${x}'`).join(',')})`);
    for (const tb of TABLAS) await run(`DELETE FROM ${tb}`);
  }
  const mapa = async (tl) => new Map((await run(`SELECT id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado=@t`, { t: tl })).map((r) => [Number(r.id_legado), r.id_nuevo]));
  const USR = await mapa('mae_usuario#usr'), PER = await mapa('mae_muestreador'), ROL = await mapa('mae_rol');
  if (!USR.size || !PER.size || !ROL.size) throw new Error('Faltan usr_ o per_ (mig_id_map sin mae_usuario#usr / mae_muestreador / mae_rol).');
  const usrNom = new Map((await run(`SELECT id, nombre FROM usr_usuario`)).map((r) => [r.id, r.nombre]));
  const perNom = new Map((await run(`SELECT id, nombre FROM per_persona`)).map((r) => [r.id, r.nombre]));

  /* ---------- Tipos ---------- */
  const TIPOS = await L(`SELECT * FROM mae_solicitud_tipo ORDER BY id_tipo`); const tipoCrea = new Map();
  for (const x of TIPOS) {
    await insId('sol_tipo', Number(x.id_tipo), { nombre: (t(x.nombre) || `Tipo ${x.id_tipo}`).slice(0, 150), area_destino: t(x.area_destino), cod_permiso_crear: t(x.cod_permiso_crear), cod_permiso_resolver: t(x.cod_permiso_resolver),
      formulario_config_json: raw(x.formulario_config), workflow_config_json: raw(x.workflow_config), modulo_destino: t(x.modulo_destino), habilitado: x.estado === true || x.estado === 1 });
    tipoCrea.set(Number(x.id_tipo), t(x.cod_permiso_crear)); await mapear('mae_solicitud_tipo', Number(x.id_tipo), 'sol_tipo', Number(x.id_tipo));
  }
  const PERM = await L(`SELECT * FROM rel_solicitud_tipo_permiso ORDER BY id_permiso_sol`); let nPerm = 0; const vistos = new Set();
  for (const p of PERM) {
    const rol = Number(p.id_rol) > 0 ? ROL.get(Number(p.id_rol)) : null, usu = Number(p.id_usuario) > 0 ? USR.get(Number(p.id_usuario)) : null;
    if ((Number(p.id_rol) > 0 && !rol) || (Number(p.id_usuario) > 0 && !usu)) { warn('permiso por tipo con rol/usuario sin equivalente (NO se carga)', `${p.id_permiso_sol}: rol ${p.id_rol} usuario ${p.id_usuario}`); continue; }
    if (!rol && !usu) { warn('permiso por tipo sin rol ni usuario (NO se carga)', p.id_permiso_sol); continue; }
    if (rol && usu) { warn('permiso por tipo con rol Y usuario (se conserva el rol)', p.id_permiso_sol); }
    const k = `${Number(p.id_tipo)}|${t(p.tipo_acceso)}|${rol ? 'r' + rol : 'u' + usu}`; if (vistos.has(k)) { warn('permiso por tipo repetido (se omite el duplicado)', k); continue; } vistos.add(k);
    const idPerm = await ins('sol_tipo_permiso', { id_tipo: Number(p.id_tipo), id_rol: rol ?? undefined, id_usuario: rol ? undefined : usu, tipo_acceso: t(p.tipo_acceso) }); await mapear('rel_solicitud_tipo_permiso', Number(p.id_permiso_sol), 'sol_tipo_permiso', idPerm); nPerm++;
  }
  const NOT = await L(`SELECT * FROM rel_solicitud_tipo_notificacion ORDER BY id_config_notif`);
  for (const n of NOT) { const idNot = await ins('sol_tipo_notificacion', { id_tipo: Number(n.id_tipo), accion: t(n.accion), notifica_web: yes(n.notifica_web), notifica_email: yes(n.notifica_email) }); await mapear('rel_solicitud_tipo_notificacion', Number(n.id_config_notif), 'sol_tipo_notificacion', idNot); }

  /* ---------- Quién es quién ---------- */
  // devuelve { usuario, persona, nombre } para un id legado, priorizando el espacio indicado
  const actor = (idLeg, prefiere, etiqueta) => {
    const n = Number(idLeg); if (!(n > 0)) return {};
    const orden = prefiere === 'persona' ? ['persona', 'usuario'] : ['usuario', 'persona'];
    for (let i = 0; i < 2; i++) {
      if (orden[i] === 'usuario' && USR.has(n)) { if (i === 1) warn(`${etiqueta}: el id no existe como ${orden[0]}; se tomó como usuario`, n); return { usuario: USR.get(n), nombre: usrNom.get(USR.get(n)) }; }
      if (orden[i] === 'persona' && PER.has(n)) { if (i === 1) warn(`${etiqueta}: el id no existe como ${orden[0]}; se tomó como muestreador`, n); return { persona: PER.get(n), nombre: perNom.get(PER.get(n)) }; }
    }
    warn(`${etiqueta}: id sin equivalente en usr_ ni per_`, n); return {};
  };

  /* ---------- Solicitudes ---------- */
  const SOL = await L(`SELECT * FROM mae_solicitud ORDER BY id_solicitud`); const solInfo = new Map(); const resumen = [];
  for (const s of SOL) {
    const esApp = tipoCrea.get(Number(s.id_tipo)) === 'MUESTREADOR'; const a = actor(s.id_solicitante, esApp ? 'persona' : 'usuario', 'solicitante');
    if (!a.usuario && !a.persona) { warn('solicitud sin solicitante resoluble (NO se carga)', s.id_solicitud); continue; }
    const notif = s.notificado_uns === true || s.notificado_uns === 1;
    await insId('sol_solicitud', Number(s.id_solicitud), { id_tipo: Number(s.id_tipo), id_solicitante: a.usuario, id_persona_solicitante: a.persona, estado: t(s.estado) || 'PENDIENTE', prioridad: t(s.prioridad) || 'NORMAL',
      datos_json: raw(s.datos_json) ?? '{}', area_actual: t(s.area_actual), observaciones: libre(s.observaciones, 500, 'solicitud.observaciones'), creado_en: dt(s.fecha_creacion) ?? undefined, actualizado_en: dt(s.fecha_actualizacion) ?? undefined,
      notificado_en: notif ? (dt(s.fecha_actualizacion) ?? dt(s.fecha_creacion) ?? new Date()) : undefined });
    solInfo.set(Number(s.id_solicitud), { legado: Number(s.id_solicitante), esApp, ...a }); await mapear('mae_solicitud', Number(s.id_solicitud), 'sol_solicitud', Number(s.id_solicitud)); resumen.push({ id: Number(s.id_solicitud), origen: a.persona ? 'muestreador' : 'usuario', nombre: a.nombre });
  }
  // actor de un historial/comentario: hereda el espacio del solicitante si el id coincide
  const actorDe = (idSol, idLeg, etiqueta) => { const si = solInfo.get(Number(idSol)); const pref = si && Number(idLeg) === si.legado ? (si.persona ? 'persona' : 'usuario') : 'usuario'; return actor(idLeg, pref, etiqueta); };

  const HIS = await L(`SELECT * FROM mae_solicitud_historial ORDER BY id_historial`); let nHis = 0;
  for (const h of HIS) {
    if (!solInfo.has(Number(h.id_solicitud))) { warn('historial de una solicitud no cargada', h.id_historial); continue; }
    const a = actorDe(h.id_solicitud, h.id_usuario, 'historial');
    const idHis = await ins('sol_historial', { id_solicitud: Number(h.id_solicitud), id_usuario: a.usuario, id_persona: a.persona, snap_nombre_usuario: cortar(a.nombre, 150, 'historial.nombre'), accion: t(h.accion), estado_anterior: t(h.estado_anterior), estado_nuevo: t(h.estado_nuevo),
      observacion: libre(h.observacion, 500, 'historial.observacion'), fecha: dt(h.fecha) ?? undefined }); await mapear('mae_solicitud_historial', Number(h.id_historial), 'sol_historial', idHis); nHis++;
  }
  const COM = await L(`SELECT * FROM mae_solicitud_comentario ORDER BY id_comentario`); const comMap = new Map();
  for (const c of COM) {
    if (!solInfo.has(Number(c.id_solicitud))) { warn('comentario de una solicitud no cargada', c.id_comentario); continue; }
    const a = actorDe(c.id_solicitud, c.id_usuario, 'comentario'); if (!a.usuario && !a.persona) { warn('comentario sin autor resoluble (NO se carga)', c.id_comentario); continue; }
    comMap.set(Number(c.id_comentario), await ins('sol_comentario', { id_solicitud: Number(c.id_solicitud), id_usuario: a.usuario, id_persona: a.persona, mensaje: raw(c.mensaje) ?? '', es_privado: yes(c.es_privado), es_sistema: yes(c.es_sistema), fecha: dt(c.fecha) ?? undefined }));
  }
  let nArch = 0;
  for (const x of await L(`SELECT * FROM mae_solicitud_adjunto ORDER BY id_adjunto`)) { if (!solInfo.has(Number(x.id_solicitud))) { warn('adjunto de una solicitud no cargada', x.id_adjunto); continue; }
    await ins('sol_archivo', { id_solicitud: Number(x.id_solicitud), id_comentario: comMap.get(Number(x.id_comentario)), nombre_original: (t(x.nombre_archivo) || '(sin nombre)').slice(0, 300), ruta_archivo: t(x.ruta_archivo), mime_type: cortar(x.tipo_archivo, 100, 'adjunto.tipo'), creado_en: dt(x.fecha) ?? undefined }); nArch++; }
  for (const x of await L(`SELECT * FROM mae_solicitud_archivo ORDER BY id_archivo`)) { if (!solInfo.has(Number(x.id_solicitud))) { warn('archivo de una solicitud no cargada', x.id_archivo); continue; }
    await ins('sol_archivo', { id_solicitud: Number(x.id_solicitud), id_comentario: comMap.get(Number(x.id_comentario)), nombre_original: (t(x.nombre_original) || '(sin nombre)').slice(0, 300), nombre_sistema: t(x.nombre_sistema)?.slice(0, 300), mime_type: cortar(x.mime_type, 100, 'archivo.mime'), peso_bytes: x.peso_bytes ?? undefined }); nArch++; }
  for (const d of await L(`SELECT * FROM mae_solicitud_derivacion ORDER BY id_derivacion`)) { if (!solInfo.has(Number(d.id_solicitud))) { warn('derivación de una solicitud no cargada', d.id_derivacion); continue; }
    await ins('sol_derivacion', { id_solicitud: Number(d.id_solicitud), area_origen: t(d.area_origen), area_destino: t(d.area_destino), id_usuario_origen: USR.get(Number(d.usuario_origen)), id_usuario_destino: USR.get(Number(d.usuario_destino)), id_rol_destino: ROL.get(Number(d.id_rol_destino)), motivo: libre(d.motivo, 400, 'derivacion.motivo'), fecha: dt(d.fecha) ?? undefined }); }
  const EQ = await L(`SELECT * FROM mae_solicitud_equipo ORDER BY id_solicitud`);
  for (const e of EQ) {
    const esApp = t(e.origen_solicitud) === 'MUESTREADOR'; const a = actor(e.usuario_solicita, esApp ? 'persona' : 'usuario', 'solicitud de equipo');
    if (!a.usuario && !a.persona) { warn('solicitud de equipo sin solicitante resoluble (NO se carga)', e.id_solicitud); continue; }
    await insId('sol_equipo_solicitud', Number(e.id_solicitud), { tipo_solicitud: t(e.tipo_solicitud), estado: t(e.estado), datos_json: raw(e.datos_json) ?? '{}', origen_solicitud: t(e.origen_solicitud) || (esApp ? 'MUESTREADOR' : 'TECNICA'), id_usuario_solicita: a.usuario, id_persona_solicita: a.persona,
      fecha_solicitud: dt(e.fecha_solicitud) ?? undefined, id_usuario_tecnica: USR.get(Number(e.usuario_tecnica)), fecha_revision_tecnica: dt(e.fecha_revision_tecnica) ?? undefined, estado_tecnica: t(e.estado_tecnica), feedback_tecnica: libre(e.feedback_tecnica, 400, 'equipo.feedback_tecnica'),
      id_usuario_aprueba: USR.get(Number(e.usuario_aprueba)), fecha_aprobacion: dt(e.fecha_aprobacion) ?? undefined, feedback_aprobacion: libre(e.feedback_aprobacion, 400, 'equipo.feedback_aprobacion'), id_usuario_revisa: USR.get(Number(e.usuario_revisa)), fecha_revision: dt(e.fecha_revision) ?? undefined, feedback_admin: libre(e.feedback_admin, 400, 'equipo.feedback_admin') });
    await mapear('mae_solicitud_equipo', Number(e.id_solicitud), 'sol_equipo_solicitud', Number(e.id_solicitud));
  }

  /* ---------- Conciliación ---------- */
  const c = async (tb) => (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  console.log(`\n== Conciliación (${APPLY ? 'APLICAR' : 'ENSAYO'} en [${TEST_DB}]) ==`);
  console.table([{ tabla: 'tipos', legado: TIPOS.length, nuevo: await c('sol_tipo') }, { tabla: 'permisos por tipo', legado: PERM.length, nuevo: await c('sol_tipo_permiso') }, { tabla: 'notificaciones por tipo', legado: NOT.length, nuevo: await c('sol_tipo_notificacion') },
    { tabla: 'solicitudes', legado: SOL.length, nuevo: await c('sol_solicitud') }, { tabla: 'historial', legado: HIS.length, nuevo: await c('sol_historial') }, { tabla: 'comentarios', legado: COM.length, nuevo: await c('sol_comentario') },
    { tabla: 'adjuntos/archivos', legado: '0+0', nuevo: await c('sol_archivo') }, { tabla: 'solicitudes de equipo', legado: EQ.length, nuevo: await c('sol_equipo_solicitud') }]);
  console.log('quién solicita cada solicitud:'); console.table(resumen);
  console.log('\n== Advertencias =='); if (!warns.size) console.log('  (ninguna)'); for (const [k, w] of warns) console.log(`  ${w.n} × ${k}${w.ej.length ? '  ej: ' + w.ej.join(' | ') : ''}`);
  if (APPLY) { await tx.commit(); console.log('\nCOMMIT realizado.'); } else { await tx.rollback(); console.log('\nENSAYO: ROLLBACK (nada se guardó). Usa --apply para confirmar.'); }
} catch (e) { try { await tx.rollback(); } catch { /* cerrada */ } console.error('\nERROR (ROLLBACK):', e.message); process.exitCode = 1; }
finally { await leg.close(); await dst.close(); }
