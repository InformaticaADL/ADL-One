// Manejadores del módulo per_ (personal de terreno). Mismas reglas que scripts/migracion-per.mjs, por fila:
//   - NO son personas: ids 0, 1000, 1001, 1002, 1027 y las SEDES 1023-1026 (custodios de equipos; van a eqp_lugar_guardado);
//   - se fusionan SOLO los muestreadores con nombre Y correo exactamente iguales; lo demás se carga aparte y, si parece la misma
//     persona (mismo correo/RUT, nombre contenido o parecido), va a revision_duplicado (PENDIENTE) para que lo decida una persona;
//   - un inspector / coordinador / jefatura con el MISMO nombre (sin tildes ni mayúsculas) de una persona existente le agrega un rol;
//   - claves (PIN de la APP MAM): un hash bcrypt del legado se copia; texto plano se hashea (solo si el hash actual ya no lo valida).
//     NUNCA se imprime una clave ni un hash.
import { hashPassword, isBcryptHash, verifyPassword } from '../../utils/password.js';
import { norm, t, si, sinTildes, upsertMapeado, borrarMapeado, insertar, actualizar, fijarMapa, asegurarMapa } from '../comun.js';
import { mapa, filaLegado } from './contexto.js';

const NO_PERSONA = new Set([0, 1000, 1001, 1002, 1027]);
const SEDES = new Map([[1023, 'Base Aysén'], [1024, 'Base Puerto Montt'], [1025, 'Base Villarrica'], [1026, 'Sede Villarrica']]);
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const esFusion = (nota) => String(nota ?? '').startsWith('fusionado') || String(nota ?? '').startsWith('misma persona');
const previoMapa = async (run, tabla, id) => (await run(`SELECT id_nuevo, nota FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l AND id_nuevo>0`, { t: tabla, l: id }))[0];

async function hashPin(clave, hashActual) {
  const c = norm(clave); if (!c) return hashActual ?? null;
  if (isBcryptHash(c)) return c;
  if (hashActual && isBcryptHash(hashActual) && (await verifyPassword(c, hashActual)).match) return hashActual;   // ya valida: no se toca
  const h = await hashPassword(c); if (!(await verifyPassword(c, h)).match) throw new Error('el hash nuevo no valida contra el PIN'); return h;
}

async function asegurarRol(run, idPersona, rol, { idCargo, habilitado = true } = {}) {
  const ex = (await run(`SELECT id FROM per_persona_rol WHERE id_persona=@p AND rol=@r`, { p: idPersona, r: rol }))[0];
  if (ex) await run(`UPDATE per_persona_rol SET habilitado=@h, id_cargo=COALESCE(@c, id_cargo) WHERE id=@i`, { h: habilitado, c: idCargo ?? null, i: ex.id });
  else await insertar(run, 'per_persona_rol', { id_persona: idPersona, rol, id_cargo: idCargo ?? undefined, habilitado });
}
const quitarRol = (run, idPersona, rol) => run(`DELETE FROM per_persona_rol WHERE id_persona=@p AND rol=@r`, { p: idPersona, r: rol });

// Agrega el rol a una persona con el mismo nombre exacto (sin tildes ni mayúsculas) o crea una nueva.
async function vincular(run, nombre, rol, { email, rut, firmaRuta, hab, idCargo }) {
  const ex = (await run(`SELECT id, nombre, rut FROM per_persona`)).find((p) => sinTildes(p.nombre) === sinTildes(nombre));
  if (ex) {
    await asegurarRol(run, ex.id, rol, { idCargo, habilitado: hab });
    if (rut && !ex.rut) await run(`UPDATE per_persona SET rut=@r WHERE id=@i AND rut IS NULL`, { r: rut, i: ex.id });
    if (firmaRuta) await run(`UPDATE per_persona SET firma_ruta=@f WHERE id=@i AND firma_ruta IS NULL`, { f: firmaRuta, i: ex.id });
    return { id: ex.id, nueva: false };
  }
  let mail = email; if (mail && (await run(`SELECT id FROM per_persona WHERE email=@e`, { e: mail })).length) mail = null;   // correo ya usado por otra persona
  const id = await insertar(run, 'per_persona', { nombre: nombre.slice(0, 150), email: mail ?? undefined, rut: rut ?? undefined, firma_ruta: firmaRuta ?? undefined, habilitado: hab });
  await asegurarRol(run, id, rol, { idCargo, habilitado: hab });
  return { id, nueva: true };
}

// Cola de revisión: ¿la persona recién creada podría ser otra ya existente? (nunca se fusiona sola)
async function revisarDuplicados(run, idPersona) {
  const todas = await run(`SELECT p.id, p.nombre, p.email, p.rut, (SELECT STRING_AGG(r.rol, ',') FROM per_persona_rol r WHERE r.id_persona=p.id) roles FROM per_persona p`);
  const A = todas.find((p) => p.id === idPersona); if (!A) return;
  const na = sinTildes(A.nombre), ta = na.split(' ');
  for (const B of todas) {
    if (B.id === idPersona) continue;
    const nb = sinTildes(B.nombre), tb = nb.split(' '); const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta]; let criterio = null;
    if (A.email && A.email === B.email) criterio = 'MISMO_CORREO'; else if (A.rut && A.rut === B.rut) criterio = 'MISMO_RUT';
    else if (corto.length >= 2 && corto.every((x) => largo.includes(x))) criterio = 'NOMBRE_CONTENIDO';
    else if (Math.min(na.length, nb.length) >= 8 && lev(na, nb) <= 2) criterio = 'NOMBRE_SIMILAR';
    if (!criterio) continue;
    if ((await run(`SELECT 1 x FROM revision_duplicado WHERE entidad='PER_PERSONA' AND ((id_registro_a=@a AND id_registro_b=@b) OR (id_registro_a=@b AND id_registro_b=@a))`, { a: A.id, b: B.id })).length) continue;
    await run(`INSERT INTO revision_duplicado (entidad, id_registro_a, id_registro_b, criterio, detalle_json, observacion) VALUES ('PER_PERSONA', @a, @b, @c, @j, N'Sin fusionar automáticamente: requiere confirmación de una persona')`,
      { a: B.id, b: A.id, c: criterio, j: JSON.stringify({ a: { nombre: B.nombre, roles: String(B.roles || '').split(','), correo: B.email || null }, b: { nombre: A.nombre, roles: String(A.roles || '').split(','), correo: A.email || null } }) });
  }
}

/* ---------- mae_cargo → per_cargo (+ categorías) ---------- */
const CATEGORIAS = { lab: 'LABORATORIO', mam: 'MEDIO_AMBIENTE', obsterreno: 'OBSERVADOR_TERRENO', cliente: 'CLIENTE' };
const cargo = {
  async upsert({ run, leg, clave }) {
    const c = await filaLegado(leg, 'mae_cargo', 'id_cargo', clave); if (!c) return 'SIN_FILA'; const nombre = norm(c.nombre_cargo); if (!nombre) return;
    const id = await upsertMapeado(run, { tablaLegado: 'mae_cargo', idLegado: Number(c.id_cargo), tabla: 'per_cargo', obj: { nombre: nombre.slice(0, 100) }, buscarNatural: async () => (await run(`SELECT TOP 1 id FROM per_cargo WHERE nombre=@n`, { n: nombre.slice(0, 100) }))[0]?.id });
    for (const [flag, nomCat] of Object.entries(CATEGORIAS)) {
      const cat = (await run(`SELECT id FROM per_categoria_cargo WHERE nombre=@n`, { n: nomCat }))[0]?.id ?? await insertar(run, 'per_categoria_cargo', { nombre: nomCat });
      const hay = (await run(`SELECT 1 x FROM per_cargo_categoria WHERE id_cargo=@c AND id_categoria=@k`, { c: id, k: cat })).length > 0; const quiere = si(c[flag], false);
      if (quiere && !hay) await run(`INSERT INTO per_cargo_categoria (id_cargo, id_categoria) VALUES (@c,@k)`, { c: id, k: cat });
      if (!quiere && hay) await run(`DELETE FROM per_cargo_categoria WHERE id_cargo=@c AND id_categoria=@k`, { c: id, k: cat });
    }
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_cargo', idLegado: Number(clave), tabla: 'per_cargo' }),
};

/* ---------- mae_competencia → per_competencia ---------- */
const competencia = {
  async upsert({ run, leg, clave }) {
    const c = await filaLegado(leg, 'mae_competencia', 'id_competencia', clave); if (!c) return 'SIN_FILA';
    const nombre = norm(c.nombre_competencia).slice(0, 150);
    await upsertMapeado(run, { tablaLegado: 'mae_competencia', idLegado: Number(c.id_competencia), tabla: 'per_competencia', obj: { nombre, descripcion: t(c.descripcion)?.slice(0, 400), orden: c.orden ?? null, activo: si(c.activo, true) },
      buscarNatural: async () => (await run(`SELECT TOP 1 id FROM per_competencia WHERE nombre=@n`, { n: nombre }))[0]?.id });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_competencia', idLegado: Number(clave), tabla: 'per_competencia' }),
};

/* ---------- mae_muestreador → per_persona ---------- */
const muestreador = {
  async upsert({ ctx, run, leg, clave }) {
    const m = await filaLegado(leg, 'mae_muestreador', 'id_muestreador', clave); if (!m) return 'SIN_FILA'; const id = Number(m.id_muestreador);
    if (NO_PERSONA.has(id)) return;
    if (SEDES.has(id)) { await asegurarMapa(run, 'mae_muestreador', id, '(sede) no es persona', 0, SEDES.get(id)); return; }
    const nombre = (norm(m.nombre_muestreador) || `Muestreador ${id}`).slice(0, 150); const email = t(m.correo_electronico)?.toLowerCase().slice(0, 150) ?? null;
    const habilitado = si(m.habilitado, false);
    const previo = await previoMapa(run, 'mae_muestreador', id);
    if (previo) {
      if (esFusion(previo.nota)) return;   // fila fusionada con otra (mismo nombre y correo exactos): la dueña actualiza los datos
      const hashActual = (await run(`SELECT clave_hash FROM per_persona WHERE id=@i`, { i: previo.id_nuevo }))[0]?.clave_hash;
      await actualizar(run, 'per_persona', previo.id_nuevo, { nombre, email, clave_hash: await hashPin(m.clave_usuario, hashActual), firma_base64: t(m.firma_muestreador), expo_push_token: t(m.expo_push_token)?.slice(0, 300),
        notificaciones_push: si(m.notificaciones_push, true), notificaciones_email: si(m.notificaciones_email, true), en_entrenamiento: si(m.en_entrenamiento, false), habilitado });
      await asegurarRol(run, previo.id_nuevo, 'MUESTREADOR', { habilitado });
      if (si(m.habilitado_supervisor, false)) await asegurarRol(run, previo.id_nuevo, 'SUPERVISOR', { habilitado: true }); else await quitarRol(run, previo.id_nuevo, 'SUPERVISOR');
      return;
    }
    // fila nueva: ¿es la misma persona (nombre Y correo exactos) que un muestreador ya cargado?
    if (email) {
      const igual = (await run(`SELECT p.id, p.nombre FROM per_persona p WHERE p.email=@e AND EXISTS (SELECT 1 FROM per_persona_rol r WHERE r.id_persona=p.id AND r.rol='MUESTREADOR')`, { e: email })).find((p) => sinTildes(p.nombre) === sinTildes(nombre));
      if (igual) { await fijarMapa(run, 'mae_muestreador', id, 'per_persona', igual.id, `fusionado con otro muestreador: mismo nombre y correo exactos`); return; }
    }
    const idP = await insertar(run, 'per_persona', { nombre, email: email ?? undefined, clave_hash: (await hashPin(m.clave_usuario, null)) ?? undefined, firma_base64: t(m.firma_muestreador) ?? undefined, expo_push_token: t(m.expo_push_token)?.slice(0, 300) ?? undefined,
      notificaciones_push: si(m.notificaciones_push, true), notificaciones_email: si(m.notificaciones_email, true), en_entrenamiento: si(m.en_entrenamiento, false), habilitado });
    await asegurarRol(run, idP, 'MUESTREADOR', { habilitado });
    if (si(m.habilitado_supervisor, false)) await asegurarRol(run, idP, 'SUPERVISOR', { habilitado: true });
    await fijarMapa(run, 'mae_muestreador', id, 'per_persona', idP, null);
    await revisarDuplicados(run, idP);
  },
  async borrar({ run, clave }) {
    const previo = await previoMapa(run, 'mae_muestreador', Number(clave));
    await run(`DELETE FROM mig_id_map WHERE tabla_legado='mae_muestreador' AND id_legado=@l`, { l: Number(clave) });
    if (!previo) return;
    if (!(await run(`SELECT 1 x FROM mig_id_map WHERE tabla_nueva='per_persona' AND id_nuevo=@i`, { i: previo.id_nuevo })).length) {   // ningún otro id legado apunta a esta persona
      await run(`DELETE FROM per_persona_rol WHERE id_persona=@i`, { i: previo.id_nuevo });
      await run(`DELETE FROM per_persona WHERE id=@i`, { i: previo.id_nuevo });
    }
  },
};

/* ---------- inspectores, coordinadores y jefaturas: son ROLES de una persona ---------- */
const rolDePersona = ({ tabla, idc, nombreCol, rol, conUsuario }) => ({
  async upsert({ ctx, run, leg, clave }) {
    const c = await filaLegado(leg, tabla, idc, clave); if (!c) return 'SIN_FILA'; const id = Number(c[idc]);
    const nombre = norm(c[nombreCol]); if (!nombre || id === 0 || /^no\s*aplica$/i.test(nombre)) return;
    const hab = si(c.habilitado, false);
    const u = conUsuario ? (await leg.request().query(`SELECT correo_electronico, id_cargo FROM mae_usuario WHERE id_usuario=${Number(id)}`)).recordset[0] : null;
    const cargoTxt = norm(c.cargo).toLowerCase();
    const idCargo = conUsuario ? (u?.id_cargo ? (await mapa(ctx, run, 'mae_cargo')).get(Number(u.id_cargo)) : undefined)
      : (cargoTxt ? (await run(`SELECT TOP 1 id FROM per_cargo WHERE LOWER(nombre)=@n`, { n: cargoTxt }))[0]?.id : undefined);
    const previo = await previoMapa(run, tabla, id);
    if (previo) {
      await asegurarRol(run, previo.id_nuevo, rol, { idCargo, habilitado: hab });
      if (!esFusion(previo.nota)) await actualizar(run, 'per_persona', previo.id_nuevo, { nombre: nombre.slice(0, 150), habilitado: hab, rut: t(c.rut_inspector)?.slice(0, 20) ?? undefined, firma_ruta: t(c.firma_ruta)?.slice(0, 300) ?? undefined });
      return;
    }
    const r = await vincular(run, nombre, rol, { email: conUsuario ? (t(u?.correo_electronico)?.toLowerCase() ?? null) : null, rut: t(c.rut_inspector)?.slice(0, 20), firmaRuta: t(c.firma_ruta)?.slice(0, 300), hab, idCargo });
    const nota = r.nueva ? null : 'misma persona que otra fila (nombre exacto): se agrega el rol';
    await fijarMapa(run, tabla, id, 'per_persona', r.id, nota);
    if (conUsuario) await fijarMapa(run, 'mae_usuario', id, 'per_persona', r.id, `usuario web que es ${rol.toLowerCase()} (su id coincide con ${tabla})`);
    if (r.nueva) await revisarDuplicados(run, r.id);
  },
  async borrar({ run, clave }) {
    const previo = await previoMapa(run, tabla, Number(clave)); await run(`DELETE FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: tabla, l: Number(clave) });
    if (previo) await quitarRol(run, previo.id_nuevo, rol);   // la persona se conserva: puede tener otros roles
  },
});

export const manejadores = {
  mae_cargo: cargo, mae_competencia: competencia, mae_muestreador: muestreador,
  mae_inspectorambiental: rolDePersona({ tabla: 'mae_inspectorambiental', idc: 'id_inspectorambiental', nombreCol: 'nombre_inspector', rol: 'INSPECTOR', conUsuario: false }),
  mae_coordinador: rolDePersona({ tabla: 'mae_coordinador', idc: 'id_coordinador', nombreCol: 'nombre_coordinador', rol: 'COORDINADOR', conUsuario: true }),
  mae_jefaturatecnica: rolDePersona({ tabla: 'mae_jefaturatecnica', idc: 'id_jefaturatecnica', nombreCol: 'nombre_jefaturatecnica', rol: 'JEFATURA_TECNICA', conUsuario: true }),
};
