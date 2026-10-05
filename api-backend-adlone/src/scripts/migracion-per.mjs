/* =====================================================================
   Migración del módulo per_ : legado (PruebasInformatica) → esquema v5
   =====================================================================
   Uso:
     node src/scripts/migracion-per.mjs                 → ensayo: carga y hace ROLLBACK
     node src/scripts/migracion-per.mjs --apply         → carga y confirma (COMMIT)
     node src/scripts/migracion-per.mjs --apply --reset → borra lo per_ previo y recarga
     (--sin-claves: no migra las claves; clave_hash queda NULL)

   SEGURIDAD: del legado solo lee; solo escribe en una base cuyo nombre contenga
   "TEST"; una transacción; sin --apply termina en ROLLBACK.
   CLAVES: los 51 muestreadores tienen su PIN en TEXTO PLANO (mae_muestreador.clave_usuario;
   es la tabla con la que valida el login de APP MAM). Aquí NUNCA se guarda texto plano: se
   hashea con bcrypt (el mismo utils/password.js del login, que ya sabe verificar hashes) y se
   comprueba que cada hash siga validando el PIN original. No se imprime ninguna clave.

   REGLAS (verificadas con los datos reales; ver task.md)
     - NO son personas y se omiten: 0 (vacío), 1000 "Cliente", 1001 "Por asignar",
       1002 "Sin supervisión", 1027 "prueba muestreador" y las SEDES 1023-1026 ("Base …",
       "Sede …": son custodios de equipos, 350 equipos; pasan a la sede del equipo en eqp_).
     - Se fusionan SOLO los duplicados con nombre Y correo exactamente iguales (11/1007,
       255/1016, 256/1017). Todo lo demás (mismo nombre en otro rol, nombre contenido, error de
       tipeo) se carga por separado y va a revision_duplicado como PENDIENTE.
     - Una persona que es a la vez muestreador, inspector, coordinador o jefatura: si el nombre
       coincide exactamente (sin tildes ni mayúsculas) se le agrega el rol; si no, es otra fila.
     - Cargos: los 82; las banderas lab/mam/obsterreno/cliente pasan a categorías (N:M).
   ===================================================================== */
import dotenv from 'dotenv'; dotenv.config();
import sql from 'mssql';
import { hashPassword, isBcryptHash, verifyPassword } from '../utils/password.js';

const APPLY = process.argv.includes('--apply');
const RESET = process.argv.includes('--reset');
const SIN_CLAVES = process.argv.includes('--sin-claves');
const TEST_DB = process.env.MIG_TEST_DB || 'ADL ONE TEST';
if (!/TEST/i.test(TEST_DB)) { console.error(`ABORTADO: la base destino "${TEST_DB}" no contiene "TEST".`); process.exit(1); }

const NO_PERSONA = new Map([[0, 'vacío'], [1000, 'marcador "Cliente"'], [1001, 'marcador "Por asignar"'], [1002, 'marcador "Sin supervisión"'], [1027, 'registro de prueba']]);
const SEDES = new Map([[1023, 'Base Aysén'], [1024, 'Base Puerto Montt'], [1025, 'Base Villarrica'], [1026, 'Sede Villarrica']]);

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
const mapear = (tl, il, tn, inu, nota = null) => run(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo, nota) VALUES (@a,@b,@c,@d,@e)`, { a: tl, b: il, c: tn, d: inu, e: nota });
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const t = (s) => norm(s) || null;
const yes = (v, def = true) => { const x = norm(v); return x === '' ? def : /^(S|SI|1|TRUE)$/i.test(x); };
const sinTildes = (s) => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const warns = new Map(); const warn = (k, ej) => { const w = warns.get(k) || { n: 0, ej: [] }; w.n++; if (w.ej.length < 4 && ej != null) w.ej.push(ej); warns.set(k, w); };
const stats = [];

try {
  const TABLAS = ['per_persona_documento', 'per_persona_competencia', 'per_persona_rol', 'per_cargo_categoria', 'per_persona', 'per_competencia', 'per_cargo', 'per_categoria_cargo'];
  let previo = 0; for (const tb of TABLAS) previo += (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  if (previo > 0 && !RESET) throw new Error('Las tablas per_ ya tienen datos. Usa --reset para borrarlas y recargar.');
  if (RESET) {
    await run(`DELETE FROM revision_duplicado WHERE entidad='PER_PERSONA'`);
    await run(`DELETE FROM mig_id_map WHERE tabla_nueva LIKE 'per[_]%' OR tabla_nueva LIKE '(sede)%'`);
    for (const tb of TABLAS) { try { await run(`DELETE FROM ${tb}`); } catch (e) { throw new Error(`No se pudo vaciar ${tb}: hay filas que la referencian (fichas/equipos de prueba). Vacía antes esos datos con migracion-fic.mjs --solo-reset --reset --apply. Detalle: ${e.message}`); } }
  }

  /* ---------- 1. Cargos y categorías ---------- */
  const CAR = await L(`SELECT * FROM mae_cargo ORDER BY id_cargo`);
  const cat = { lab: 'LABORATORIO', mam: 'MEDIO_AMBIENTE', obsterreno: 'OBSERVADOR_TERRENO', cliente: 'CLIENTE' };
  const catId = {}; for (const [flag, nombre] of Object.entries(cat)) catId[flag] = await ins('per_categoria_cargo', { nombre });
  const cargoMap = new Map(); const cargoPorNombre = new Map(); let nCC = 0;
  for (const c of CAR) {
    const nombre = norm(c.nombre_cargo); if (!nombre) { warn('cargo sin nombre (no se carga)', c.id_cargo); continue; }
    if (cargoPorNombre.has(nombre.toLowerCase())) throw new Error(`Cargo repetido: ${nombre}`);
    const id = await ins('per_cargo', { nombre: nombre.slice(0, 100) }); cargoMap.set(Number(c.id_cargo), id); cargoPorNombre.set(nombre.toLowerCase(), id);
    await mapear('mae_cargo', Number(c.id_cargo), 'per_cargo', id);
    for (const flag of Object.keys(cat)) if (yes(c[flag], false)) { await run(`INSERT INTO per_cargo_categoria (id_cargo, id_categoria) VALUES (@a,@b)`, { a: id, b: catId[flag] }); nCC++; }
  }
  stats.push({ tabla: 'per_cargo', legado: CAR.length, cargadas: cargoMap.size }); stats.push({ tabla: 'per_cargo_categoria', legado: '4 banderas por cargo', cargadas: nCC });

  /* ---------- 2. Competencias ---------- */
  const COM = await L(`SELECT * FROM mae_competencia ORDER BY id_competencia`); const compMap = new Map();
  for (const c of COM) { const id = await ins('per_competencia', { nombre: norm(c.nombre_competencia).slice(0, 150), descripcion: t(c.descripcion)?.slice(0, 400), orden: c.orden ?? undefined, activo: yes(c.activo) });
    compMap.set(Number(c.id_competencia), id); await mapear('mae_competencia', Number(c.id_competencia), 'per_competencia', id); }
  stats.push({ tabla: 'per_competencia', legado: COM.length, cargadas: compMap.size });

  /* ---------- 3. Personas desde mae_muestreador ---------- */
  const MUE = await L(`SELECT * FROM mae_muestreador ORDER BY id_muestreador`);
  const usados = new Set((await L(`SELECT id FROM (SELECT id_muestreador id FROM App_Ma_Agenda_MUESTREOS UNION SELECT id_muestreador2 FROM App_Ma_Agenda_MUESTREOS UNION SELECT id_supervisor FROM App_Ma_Agenda_MUESTREOS UNION SELECT id_muestreador FROM App_Ma_Resultados UNION SELECT id_muestreador FROM App_Ma_Equipos_MUESTREOS UNION SELECT id_muestreador FROM mae_equipo) x WHERE id IS NOT NULL`)).map((r) => Number(r.id)));
  const reales = []; const omitidas = [];
  for (const m of MUE) { const id = Number(m.id_muestreador);
    if (NO_PERSONA.has(id)) { omitidas.push({ id, nombre: norm(m.nombre_muestreador), motivo: NO_PERSONA.get(id) }); continue; }
    if (SEDES.has(id)) { omitidas.push({ id, nombre: norm(m.nombre_muestreador), motivo: 'sede/base (custodio de equipos)' }); await mapear('mae_muestreador', id, '(sede) no es persona', 0, SEDES.get(id)); continue; }
    reales.push(m); }
  const grupos = new Map(); // nombre+correo exactos → filas
  for (const m of reales) { const email = (t(m.correo_electronico) || '').toLowerCase(); const k = email ? `${sinTildes(m.nombre_muestreador)}|${email}` : `id:${m.id_muestreador}`; grupos.set(k, [...(grupos.get(k) || []), m]); }
  const persMap = new Map(); const personas = []; // {id, nombre, email, rut, roles:Set, fuente}
  const plano = new Map(); let nFus = 0; let nHash = 0;
  for (const filas of grupos.values()) {
    filas.sort((a, b) => (yes(b.habilitado, false) - yes(a.habilitado, false)) || ((usados.has(Number(b.id_muestreador)) ? 1 : 0) - (usados.has(Number(a.id_muestreador)) ? 1 : 0)) || (Number(a.id_muestreador) - Number(b.id_muestreador)));
    const rep = filas[0]; const clave = norm(rep.clave_usuario);
    let hash = null; if (!SIN_CLAVES && clave) { if (isBcryptHash(clave)) hash = clave; else { hash = await hashPassword(clave); plano.set(hash, clave); nHash++; } }
    const firma = t(rep.firma_muestreador);
    const id = await ins('per_persona', { nombre: (norm(rep.nombre_muestreador) || `Muestreador ${rep.id_muestreador}`).slice(0, 150), email: t(rep.correo_electronico)?.toLowerCase().slice(0, 150),
      clave_hash: hash ?? undefined, firma_base64: firma ?? undefined, expo_push_token: t(rep.expo_push_token)?.slice(0, 300), notificaciones_push: yes(rep.notificaciones_push), notificaciones_email: yes(rep.notificaciones_email),
      en_entrenamiento: yes(rep.en_entrenamiento, false), habilitado: yes(rep.habilitado, false) });
    await ins('per_persona_rol', { id_persona: id, rol: 'MUESTREADOR', habilitado: yes(rep.habilitado, false) });
    if (yes(rep.habilitado_supervisor, false)) await ins('per_persona_rol', { id_persona: id, rol: 'SUPERVISOR' });
    personas.push({ id, nombre: norm(rep.nombre_muestreador), email: (t(rep.correo_electronico) || '').toLowerCase(), rut: null, roles: new Set(['MUESTREADOR']), fuente: `mae_muestreador ${filas.map((f) => f.id_muestreador).join('+')}` });
    for (const f of filas) { persMap.set(Number(f.id_muestreador), id); await mapear('mae_muestreador', Number(f.id_muestreador), 'per_persona', id, f === rep ? null : `fusionado con ${rep.id_muestreador}: mismo nombre y correo exactos`); }
    if (filas.length > 1) { nFus += filas.length - 1; warn('muestreadores fusionados (mismo nombre y correo exactos)', filas.map((f) => f.id_muestreador).join('+')); }
  }
  stats.push({ tabla: 'per_persona (mae_muestreador)', legado: MUE.length, omitidas: omitidas.length, fusionadas: nFus, cargadas: persMap.size - nFus });
  const porNombre = () => { const m = new Map(); for (const p of personas) m.set(sinTildes(p.nombre), p); return m; };
  const vincular = async (nombre, rol, extra, { rut, firmaRuta, hab, idCargo, fuente }) => { // agrega el rol a una persona con el mismo nombre exacto, o crea una nueva
    const ex = porNombre().get(sinTildes(nombre));
    if (ex) { if (!ex.roles.has(rol)) { await ins('per_persona_rol', { id_persona: ex.id, rol, id_cargo: idCargo ?? undefined, habilitado: hab }); ex.roles.add(rol); }
      if (rut && !ex.rut) { await run(`UPDATE per_persona SET rut=@r WHERE id=@i AND rut IS NULL`, { r: rut, i: ex.id }); ex.rut = rut; }
      if (firmaRuta) await run(`UPDATE per_persona SET firma_ruta=@f WHERE id=@i AND firma_ruta IS NULL`, { f: firmaRuta, i: ex.id });
      return { id: ex.id, nueva: false }; }
    let email = extra.email; if (email && personas.some((p) => p.email === email)) { warn('correo ya usado por otra persona (queda NULL)', email); email = null; }
    const id = await ins('per_persona', { nombre: nombre.slice(0, 150), email: email ?? undefined, rut: rut ?? undefined, firma_ruta: firmaRuta ?? undefined, habilitado: hab });
    await ins('per_persona_rol', { id_persona: id, rol, id_cargo: idCargo ?? undefined, habilitado: hab });
    personas.push({ id, nombre, email: email || '', rut, roles: new Set([rol]), fuente }); return { id, nueva: true };
  };

  /* ---------- 4. Inspectores ---------- */
  const INSP = await L(`SELECT * FROM mae_inspectorambiental ORDER BY id_inspectorambiental`); const inspMap = new Map(); let inspNuevas = 0, inspVinc = 0, inspOm = 0;
  for (const i of INSP) {
    const nombre = norm(i.nombre_inspector); if (!nombre || /^no\s*aplica$/i.test(nombre)) { inspOm++; continue; }
    const cargoTxt = norm(i.cargo).toLowerCase(); const idCargo = cargoPorNombre.get(cargoTxt);
    const r = await vincular(nombre, 'INSPECTOR', { email: null }, { rut: t(i.rut_inspector)?.slice(0, 20), firmaRuta: t(i.firma_ruta)?.slice(0, 300), hab: yes(i.habilitado, false), idCargo, fuente: `mae_inspectorambiental ${i.id_inspectorambiental}` });
    inspMap.set(Number(i.id_inspectorambiental), r.id); r.nueva ? inspNuevas++ : inspVinc++;
    await mapear('mae_inspectorambiental', Number(i.id_inspectorambiental), 'per_persona', r.id, r.nueva ? null : 'misma persona que un muestreador (nombre exacto): se agrega el rol INSPECTOR');
    if (!idCargo && cargoTxt) warn('cargo de inspector sin equivalente exacto en mae_cargo (queda NULL)', norm(i.cargo).slice(0, 40));
  }
  stats.push({ tabla: 'per_persona (mae_inspectorambiental)', legado: INSP.length, omitidas: inspOm, fusionadas: inspVinc, cargadas: inspNuevas });

  /* ---------- 5. Coordinadores y jefaturas (personas ligadas a un usuario web) ---------- */
  const rolesUsuario = [['mae_coordinador', 'id_coordinador', 'nombre_coordinador', 'COORDINADOR'], ['mae_jefaturatecnica', 'id_jefaturatecnica', 'nombre_jefaturatecnica', 'JEFATURA_TECNICA']];
  let nCoJe = 0, nCoJeVinc = 0;
  for (const [tabla, idc, nc, rol] of rolesUsuario) {
    for (const c of await L(`SELECT * FROM ${tabla} ORDER BY ${idc}`)) {
      const id = Number(c[idc]); const nombre = norm(c[nc]); if (id === 0 || !nombre) continue;
      const u = (await L(`SELECT correo_electronico, id_cargo FROM mae_usuario WHERE id_usuario=${id}`))[0];
      const r = await vincular(nombre, rol, { email: (t(u?.correo_electronico) || '').toLowerCase() || null }, { hab: yes(c.habilitado, false), idCargo: u?.id_cargo ? cargoMap.get(Number(u.id_cargo)) : undefined, fuente: `${tabla} ${id}` });
      await mapear(tabla, id, 'per_persona', r.id, r.nueva ? null : 'misma persona que otra fila (nombre exacto): se agrega el rol');
      await mapear('mae_usuario', id, 'per_persona', r.id, `usuario web que es ${rol.toLowerCase()} (su id coincide con ${tabla})`);
      r.nueva ? nCoJe++ : nCoJeVinc++;
    }
  }
  stats.push({ tabla: 'per_persona (coordinadores + jefaturas)', legado: '2 + 2 (sin la fila vacía)', omitidas: 0, fusionadas: nCoJeVinc, cargadas: nCoJe });

  /* ---------- 6. Cola de revisión: la misma persona con distinto id ---------- */
  const par = new Set(); let nRev = 0;
  for (let a = 0; a < personas.length; a++) for (let b = a + 1; b < personas.length; b++) {
    const A = personas[a], B = personas[b]; const na = sinTildes(A.nombre), nb = sinTildes(B.nombre); const ta = na.split(' '), tb = nb.split(' ');
    const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta]; let criterio = null;
    if (A.email && A.email === B.email) criterio = 'MISMO_CORREO'; else if (A.rut && A.rut === B.rut) criterio = 'MISMO_RUT';
    else if (corto.length >= 2 && corto.every((x) => largo.includes(x))) criterio = 'NOMBRE_CONTENIDO';
    else if (Math.min(na.length, nb.length) >= 8 && lev(na, nb) <= 2) criterio = 'NOMBRE_SIMILAR';
    if (!criterio) continue;
    await ins('revision_duplicado', { entidad: 'PER_PERSONA', id_registro_a: A.id, id_registro_b: B.id, criterio,
      detalle_json: JSON.stringify({ a: { nombre: A.nombre, fuente: A.fuente, roles: [...A.roles], correo: A.email || null }, b: { nombre: B.nombre, fuente: B.fuente, roles: [...B.roles], correo: B.email || null } }), observacion: 'Sin fusionar automáticamente: requiere confirmación de una persona' });
    nRev++;
  }
  stats.push({ tabla: 'revision_duplicado (PER_PERSONA, PENDIENTE)', legado: '-', cargadas: nRev });

  /* ---------- 7. Competencias asignadas y documentos (hoy 0 filas; se cargan si existieran) ---------- */
  for (const r of await L(`SELECT * FROM mae_muestreador_competencia`)) { const p = persMap.get(Number(r.id_muestreador)), c = compMap.get(Number(r.id_competencia)); if (p && c) await run(`INSERT INTO per_persona_competencia (id_persona, id_competencia) VALUES (@a,@b)`, { a: p, b: c }); }
  for (const r of await L(`SELECT * FROM mae_muestreador_documento`)) { const p = persMap.get(Number(r.id_muestreador)); if (p) await ins('per_persona_documento', { id_persona: p, nombre_documento: norm(r.nombre_documento).slice(0, 200), descripcion: t(r.descripcion)?.slice(0, 400), ruta_archivo: norm(r.ruta_archivo).slice(0, 300) }); }

  /* ---------- Conciliación ---------- */
  console.log(`\n== CONCILIACIÓN per_ (${APPLY ? 'con --apply' : 'ENSAYO, se revierte'}) ==`); console.table(stats);
  const cM = stats[3]; console.log(`muestreadores: ${MUE.length} = ${omitidas.length} omitidos + ${nFus} fusionados + ${persMap.size - nFus} cargados → ${MUE.length === omitidas.length + persMap.size ? 'OK' : 'NO CUADRA'}`);
  const nMap = (await run(`SELECT COUNT(*) n FROM mig_id_map WHERE tabla_nueva LIKE 'per[_]%' OR tabla_nueva LIKE '(sede)%'`))[0].n;
  console.log(`mig_id_map (per_ + sedes): ${nMap}`);
  console.log('\n== OMITIDOS DE mae_muestreador (no son personas) =='); for (const o of omitidas) console.log(`- ${o.id} "${o.nombre}": ${o.motivo}`);

  /* Claves: nada en texto plano y todas siguen validando */
  const filas = await run(`SELECT id, clave_hash FROM per_persona`); let plan = 0, sinClave = 0, ok = 0, mal = 0;
  for (const f of filas) { if (!f.clave_hash) { sinClave++; continue; } if (!isBcryptHash(f.clave_hash)) plan++; else if (plano.has(f.clave_hash)) { (await verifyPassword(plano.get(f.clave_hash), f.clave_hash)).match ? ok++ : mal++; } }
  console.log(`\n== CLAVES == personas: ${filas.length} | con hash bcrypt: ${ok + mal} (${nHash} generados) | validan el PIN original: ${ok} | NO validan: ${mal} | texto plano guardado: ${plan} | sin clave: ${sinClave}`);
  if (mal > 0 || plan > 0) throw new Error('Verificación de claves fallida: ninguna clave puede quedar en texto plano ni dejar de validar.');

  /* Efecto sobre lo que ya usa personas */
  const agUsa = await L(`SELECT 'agenda: muestreador/supervisor' donde, COUNT(*) filas, SUM(CASE WHEN v IN (0,1002) THEN 1 ELSE 0 END) marcador_sin_persona FROM (SELECT id_muestreador v FROM App_Ma_Agenda_MUESTREOS UNION ALL SELECT id_muestreador2 FROM App_Ma_Agenda_MUESTREOS UNION ALL SELECT id_supervisor FROM App_Ma_Agenda_MUESTREOS UNION ALL SELECT id_supervisor_retiro FROM App_Ma_Agenda_MUESTREOS) x WHERE v IS NOT NULL`);
  const sinMapa = (await L(`SELECT DISTINCT v FROM (SELECT id_muestreador v FROM App_Ma_Agenda_MUESTREOS UNION SELECT id_muestreador2 FROM App_Ma_Agenda_MUESTREOS UNION SELECT id_supervisor FROM App_Ma_Agenda_MUESTREOS UNION SELECT id_supervisor_retiro FROM App_Ma_Agenda_MUESTREOS UNION SELECT id_muestreador FROM App_Ma_Resultados UNION SELECT id_muestreador FROM App_Ma_Equipos_MUESTREOS) x WHERE v IS NOT NULL AND v NOT IN (0,1002)`)).filter((r) => !persMap.has(Number(r.v)));
  console.log(`\n== EFECTO EN LO EXISTENTE == ids de muestreador usados en agenda/resultados/equipos sin equivalente (excluyendo los marcadores 0 y 1002): ${sinMapa.length}${sinMapa.length ? ' → ' + sinMapa.map((r) => r.v).join(',') : ''}`);
  const eq = await L(`SELECT id_muestreador v, COUNT(*) n FROM mae_equipo GROUP BY id_muestreador`);
  const enSedes = eq.filter((r) => SEDES.has(Number(r.v))).map((r) => `${SEDES.get(Number(r.v))}=${r.n}`); const enPersonas = eq.filter((r) => persMap.has(Number(r.v))).reduce((s, r) => s + r.n, 0); const enNinguno = eq.filter((r) => !persMap.has(Number(r.v)) && !SEDES.has(Number(r.v))).reduce((s, r) => s + r.n, 0);
  console.log(`equipos por responsable (mae_equipo, ${eq.reduce((s, r) => s + r.n, 0)} en total): a personas=${enPersonas} | a sedes (${enSedes.join(', ')}) | a marcador/otro=${enNinguno}`);
  const agInsp = await L(`SELECT DISTINCT id_inspectorambiental v FROM App_Ma_Agenda_MUESTREOS`); console.log(`inspectores usados en la agenda: ${agInsp.map((r) => `${r.v}${inspMap.has(Number(r.v)) ? '✓' : '→NULL'}`).join(', ')}`);
  const rev = await run(`SELECT criterio, COUNT(*) n FROM revision_duplicado WHERE entidad='PER_PERSONA' GROUP BY criterio`); console.log('\n== COLA DE REVISIÓN (PENDIENTE) =='); console.table(rev);
  const ejemplos = await run(`SELECT TOP 12 r.criterio, JSON_VALUE(r.detalle_json,'$.a.nombre') a, JSON_VALUE(r.detalle_json,'$.a.fuente') fuente_a, JSON_VALUE(r.detalle_json,'$.b.nombre') b, JSON_VALUE(r.detalle_json,'$.b.fuente') fuente_b FROM revision_duplicado r WHERE r.entidad='PER_PERSONA' ORDER BY r.id`); console.table(ejemplos);
  if (warns.size) { console.log('== AVISOS =='); for (const [k, w] of warns) console.log(`- ${k}: ${w.n}  ej: ${w.ej.join(' | ')}`); }

  if (APPLY) { await tx.commit(); console.log('\nCOMMIT realizado en', TEST_DB); } else { await tx.rollback(); console.log('\nROLLBACK (ensayo): no se guardó nada. Usa --apply para confirmar.'); }
} catch (e) {
  try { await tx.rollback(); } catch {}
  console.error('\nERROR — se revirtió todo:', e.message); process.exitCode = 1;
} finally { await leg.close(); await dst.close(); }
