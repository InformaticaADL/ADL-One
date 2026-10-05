/* =====================================================================
   Migración del módulo usr_ : legado (PruebasInformatica) → esquema v5
   =====================================================================
   Uso:
     node src/scripts/migracion-usr.mjs                 → ensayo: carga y hace ROLLBACK
     node src/scripts/migracion-usr.mjs --apply         → carga y confirma (COMMIT)
     node src/scripts/migracion-usr.mjs --apply --reset → borra lo usr_ previo y recarga

   Requiere: parche 10_patch_usr.sql; cli_/per_ ya migrados (para id_persona e id_cargo).
   SEGURIDAD: del legado solo lee; solo escribe en una base cuyo nombre contenga "TEST";
   una transacción; sin --apply termina en ROLLBACK. Nunca imprime claves ni hashes.

   REGLAS (verificadas con los datos reales)
     - Se CONSERVAN los ids del legado (IDENTITY_INSERT): creado_por_id de los documentos ya apunta a ellos.
       Se excluye id 0 ("NA", relleno).
     - Login = mae_usuario.nombre_usuario. Repetido sin distinguir mayúsculas (5 grupos, todos deshabilitados
       y sin roles): la mejor fila (habilitada, luego id menor) conserva el login; las demás quedan "login#id".
     - Claves: 9 de 18 habilitados ya son bcrypt → se copian. Texto plano de un habilitado → bcrypt (costo 12),
       verificado contra la clave original. Deshabilitados (o sin clave) → hash bcrypt de un valor aleatorio:
       no pueden entrar hasta que se les asigne una clave nueva.
     - Correo repetido: queda en la mejor fila; la otra sin correo.
     - Descartado a propósito (no lo lee ningún código de ADL ONE ni de APP MAM): perfil_usuario, estadistica, unegocio,
       id_unegocio, clientes, seccion, id_responsable, mam_ingresacaso/enmienda/correccion/precios/bloqueo (banderas
       del sistema de laboratorio ADL Soft) e id_lugaranalisis (lugar de análisis de laboratorio).
       Tabla usuarios_app_mam (6 filas): ningún código la lee → no se migra.
     - Roles, permisos y sus asignaciones: se copian con sus ids (6 roles, 83 permisos, 153 + 21 asignaciones).
   ===================================================================== */
import dotenv from 'dotenv'; dotenv.config();
import sql from 'mssql';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { hashPassword, isBcryptHash, verifyPassword } from '../utils/password.js';

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
const insId = async (table, id, obj) => {
  const e = Object.entries({ id, ...obj }).filter(([, v]) => v !== undefined);
  const params = Object.fromEntries(e.map(([, v], i) => [`p${i}`, v]));
  await run(`SET IDENTITY_INSERT ${table} ON; INSERT INTO ${table} (${e.map(([k]) => `[${k}]`).join(',')}) VALUES (${e.map((_, i) => `@p${i}`).join(',')}); SET IDENTITY_INSERT ${table} OFF;`, params);
};
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const t = (s) => norm(s) || null;
const yes = (v) => v === true || v === 1 || /^(S|SI|1|TRUE)$/i.test(norm(v));
const warns = new Map(); const warn = (k, ej) => { const w = warns.get(k) || { n: 0, ej: [] }; w.n++; if (w.ej.length < 4 && ej != null) w.ej.push(ej); warns.set(k, w); };

try {
  if (!(await run(`SELECT COL_LENGTH('usr_usuario','nombre_usuario') AS c`))[0].c) throw new Error('Falta el parche 10_patch_usr.sql (usr_usuario.nombre_usuario). Ejecútalo en SSMS sobre la base de prueba.');
  const TABLAS = ['usr_usuario_rol', 'usr_rol_permiso', 'usr_usuario', 'usr_rol', 'usr_permiso'];
  let previo = 0; for (const tb of TABLAS) previo += (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  if (previo > 0 && !RESET) throw new Error('Las tablas usr_ ya tienen datos. Usa --reset para borrarlas y recargar.');
  if (RESET) {
    await run(`DELETE FROM mig_id_map WHERE tabla_nueva LIKE 'usr[_]%'`);
    for (const tb of TABLAS) { try { await run(`DELETE FROM ${tb}`); } catch (e) { throw new Error(`No se pudo vaciar ${tb}: hay filas que la referencian. Detalle: ${e.message}`); } }
  }
  const mapa = async (tl) => new Map((await run(`SELECT id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado=@t`, { t: tl })).map((r) => [Number(r.id_legado), r.id_nuevo]));
  const CARGO = await mapa('mae_cargo'), PERSONA = await mapa('mae_usuario');   // 'mae_usuario' → per_persona lo dejó el módulo per_
  if (!CARGO.size) throw new Error('per_ no está migrado (mig_id_map sin mae_cargo).');
  const mapear = (tl, il, tn, inu) => run(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES (@a,@b,@c,@d)`, { a: tl, b: il, c: tn, d: inu });

  /* ---------- Roles y permisos ---------- */
  const ROLES = await L(`SELECT * FROM mae_rol ORDER BY id_rol`);
  for (const r of ROLES) { await insId('usr_rol', Number(r.id_rol), { nombre: t(r.nombre_rol).slice(0, 100), descripcion: t(r.descripcion)?.slice(0, 300), activo: r.estado === true || r.estado === 1 }); await mapear('mae_rol', Number(r.id_rol), 'usr_rol', Number(r.id_rol)); }
  const PERM = await L(`SELECT * FROM mae_permiso ORDER BY id_permiso`);
  for (const p of PERM) { await insId('usr_permiso', Number(p.id_permiso), { codigo: t(p.codigo), nombre: t(p.nombre).slice(0, 150), modulo: t(p.modulo), submodulo: t(p.submodulo), tipo: /^vista$/i.test(norm(p.tipo)) ? 'VISTA' : 'ACCION', orden: p.orden ?? undefined, habilitado: p.habilitado === true || p.habilitado === 1 }); await mapear('mae_permiso', Number(p.id_permiso), 'usr_permiso', Number(p.id_permiso)); }
  const RP = await L(`SELECT * FROM rel_rol_permiso`);
  for (const x of RP) await run(`INSERT INTO usr_rol_permiso (id_rol, id_permiso) VALUES (@r,@p)`, { r: Number(x.id_rol), p: Number(x.id_permiso) });

  /* ---------- Usuarios ---------- */
  const US = (await L(`SELECT * FROM mae_usuario WHERE id_usuario > 0 ORDER BY id_usuario`));
  const orden = [...US].sort((a, b) => (yes(b.habilitado) - yes(a.habilitado)) || (Number(a.id_usuario) - Number(b.id_usuario)));
  const logins = new Set(), correos = new Set(), estado = {};
  const cuenta = (k) => { estado[k] = (estado[k] || 0) + 1; };
  const usuarios = new Map();
  for (const u of orden) {
    const id = Number(u.id_usuario); let login = norm(u.nombre_usuario) || `USUARIO-${id}`; if (!norm(u.nombre_usuario)) warn('usuario sin login (queda USUARIO-id)', id);
    if (logins.has(login.toLowerCase())) { warn('login repetido (el de mejor fila lo conserva; los demás quedan "login#id")', login); login = `${login}#${id}`; }
    if (login.length > 25) throw new Error(`Login demasiado largo (${login.length}): id ${id}`);
    logins.add(login.toLowerCase());
    let email = t(u.correo_electronico); if (email && correos.has(email.toLowerCase())) { warn('correo repetido (queda sin correo en la fila de peor prioridad)', email.replace(/^.{2}/, '**')); email = null; } if (email) correos.add(email.toLowerCase());
    usuarios.set(id, { u, login, email });
  }
  for (const [id, { u, login, email }] of [...usuarios].sort((a, b) => a[0] - b[0])) {
    const habilitado = yes(u.habilitado); const stored = String(u.clave_usuario ?? ''); let hash;
    if (isBcryptHash(stored.trim())) { hash = stored.trim(); cuenta('clave bcrypt copiada'); }
    else if (habilitado && stored.length > 0) {
      if (Buffer.byteLength(stored) > 72) throw new Error(`Clave de usuario habilitado ${id} supera el límite de 72 bytes de bcrypt`);
      hash = await hashPassword(stored); const v = await verifyPassword(stored, hash); if (!v.match || v.needsRehash) throw new Error(`El hash nuevo del usuario ${id} no valida contra su clave`); cuenta('clave en texto plano → bcrypt (verificada)');
    } else { hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 4); cuenta(habilitado ? 'habilitado sin clave (queda inutilizable: asignar una)' : 'deshabilitado: clave inutilizable'); }
    const sig = t(u.mam_cargo); const sigla = sig && /^(CM|CO|JT)$/.test(sig) ? sig : (sig && sig !== 'Ø' ? (warn('mam_cargo con valor inesperado (se ignora)', sig), null) : null);
    await insId('usr_usuario', id, { nombre_usuario: login, email: email ?? undefined, nombre: (t(u.usuario) || login).slice(0, 150), clave_hash: hash, foto: t(u.foto) ?? undefined,
      id_persona: PERSONA.get(id) ?? undefined, id_cargo: Number(u.id_cargo) > 0 ? CARGO.get(Number(u.id_cargo)) : undefined, habilitado, permisos_version: u.permisos_version ?? 0, sigla_cargo: sigla ?? undefined });
    await mapear('mae_usuario#usr', id, 'usr_usuario', id);
    if (Number(u.id_cargo) > 0 && !CARGO.get(Number(u.id_cargo))) warn('usuario con cargo inexistente en per_ (queda sin cargo)', `${id}: ${u.id_cargo}`);
  }
  const UR = await L(`SELECT * FROM rel_usuario_rol`); let nUR = 0;
  for (const x of UR) { if (!usuarios.has(Number(x.id_usuario))) { warn('rol asignado a un usuario no cargado', x.id_usuario); continue; } await run(`INSERT INTO usr_usuario_rol (id_usuario, id_rol) VALUES (@u,@r)`, { u: Number(x.id_usuario), r: Number(x.id_rol) }); nUR++; }

  /* ---------- Conciliación (nunca imprime claves) ---------- */
  const c = async (tb) => (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  console.log(`\n== Conciliación (${APPLY ? 'APLICAR' : 'ENSAYO'} en [${TEST_DB}]) ==`);
  console.table([{ tabla: 'roles', legado: ROLES.length, nuevo: await c('usr_rol') }, { tabla: 'permisos', legado: PERM.length, nuevo: await c('usr_permiso') }, { tabla: 'rol↔permiso', legado: RP.length, nuevo: await c('usr_rol_permiso') },
    { tabla: 'usuarios (sin id 0)', legado: US.length, nuevo: await c('usr_usuario') }, { tabla: 'usuario↔rol', legado: UR.length, nuevo: await c('usr_usuario_rol') }]);
  console.log('claves:', JSON.stringify(estado));
  console.log('habilitados:', (await run(`SELECT COUNT(*) n FROM usr_usuario WHERE habilitado=1`))[0].n, '| con persona:', (await run(`SELECT COUNT(*) n FROM usr_usuario WHERE id_persona IS NOT NULL`))[0].n, '| con cargo:', (await run(`SELECT COUNT(*) n FROM usr_usuario WHERE id_cargo IS NOT NULL`))[0].n, '| con sigla:', (await run(`SELECT COUNT(*) n FROM usr_usuario WHERE sigla_cargo IS NOT NULL`))[0].n, '| con correo:', (await run(`SELECT COUNT(*) n FROM usr_usuario WHERE email IS NOT NULL`))[0].n);
  const sinRol = (await run(`SELECT nombre_usuario FROM usr_usuario u WHERE habilitado=1 AND NOT EXISTS (SELECT 1 FROM usr_usuario_rol r WHERE r.id_usuario=u.id)`)).map((x) => x.nombre_usuario); console.log('habilitados sin rol:', sinRol.length ? sinRol.join(', ') : 'ninguno');
  console.log('\n== Advertencias =='); if (!warns.size) console.log('  (ninguna)'); for (const [k, w] of warns) console.log(`  ${w.n} × ${k}${w.ej.length ? '  ej: ' + w.ej.join(' | ') : ''}`);
  if (APPLY) { await tx.commit(); console.log('\nCOMMIT realizado.'); } else { await tx.rollback(); console.log('\nENSAYO: ROLLBACK (nada se guardó). Usa --apply para confirmar.'); }
} catch (e) { try { await tx.rollback(); } catch { /* cerrada */ } console.error('\nERROR (ROLLBACK):', e.message); process.exitCode = 1; }
finally { await leg.close(); await dst.close(); }
