// Manejadores del módulo usr_ (usuarios, roles, permisos). Mismas reglas que scripts/migracion-usr.mjs, por fila.
//   - ids del legado conservados (usr_usuario, usr_rol, usr_permiso);
//   - login = mae_usuario.nombre_usuario; si otro usuario ya lo usa queda "login#id"; correo repetido queda sin correo en la 2.ª fila;
//   - claves: un hash bcrypt del legado se copia; una clave en texto plano de un usuario HABILITADO se hashea (solo si el hash actual
//     ya no la valida); deshabilitados o sin clave: hash de un valor aleatorio (no pueden entrar). NUNCA se imprime una clave ni un hash.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { hashPassword, isBcryptHash, verifyPassword } from '../../utils/password.js';
import sql from 'mssql';
import { norm, t, yes, si, upsertConId, asegurarMapa } from '../comun.js';
import { mapa, filaLegado } from './contexto.js';

const compuesta = async (leg, tabla, a, b, clave) => { const [x, y] = String(clave).split('|').map(Number);
  return (await leg.request().input('a', sql.Numeric(18, 0), x).input('b', sql.Numeric(18, 0), y).query(`SELECT * FROM [${tabla}] WHERE [${a}]=@a AND [${b}]=@b`)).recordset[0]; };

const rol = {
  async upsert({ run, leg, clave }) {
    const r = await filaLegado(leg, 'mae_rol', 'id_rol', clave); if (!r) return 'SIN_FILA'; const id = Number(r.id_rol);
    await upsertConId(run, 'usr_rol', id, { nombre: t(r.nombre_rol).slice(0, 100), descripcion: t(r.descripcion)?.slice(0, 300), activo: r.estado === true || r.estado === 1 });
    await asegurarMapa(run, 'mae_rol', id, 'usr_rol', id);
  },
  async borrar({ run, clave }) { await run(`DELETE FROM usr_rol WHERE id=@i`, { i: Number(clave) }); await run(`DELETE FROM mig_id_map WHERE tabla_legado='mae_rol' AND id_legado=@i`, { i: Number(clave) }); },
};

const permiso = {
  async upsert({ run, leg, clave }) {
    const p = await filaLegado(leg, 'mae_permiso', 'id_permiso', clave); if (!p) return 'SIN_FILA'; const id = Number(p.id_permiso);
    await upsertConId(run, 'usr_permiso', id, { codigo: t(p.codigo), nombre: t(p.nombre).slice(0, 150), modulo: t(p.modulo), submodulo: t(p.submodulo), tipo: /^vista$/i.test(norm(p.tipo)) ? 'VISTA' : 'ACCION', orden: p.orden ?? null, habilitado: p.habilitado === true || p.habilitado === 1 });
    await asegurarMapa(run, 'mae_permiso', id, 'usr_permiso', id);
  },
  async borrar({ run, clave }) { await run(`DELETE FROM usr_permiso WHERE id=@i`, { i: Number(clave) }); await run(`DELETE FROM mig_id_map WHERE tabla_legado='mae_permiso' AND id_legado=@i`, { i: Number(clave) }); },
};

const rolPermiso = {
  async upsert({ run, leg, clave }) {
    const x = await compuesta(leg, 'rel_rol_permiso', 'id_rol', 'id_permiso', clave); if (!x) return 'SIN_FILA';
    if (!(await run(`SELECT 1 x FROM usr_rol WHERE id=@r`, { r: Number(x.id_rol) })).length || !(await run(`SELECT 1 x FROM usr_permiso WHERE id=@p`, { p: Number(x.id_permiso) })).length) throw new Error(`el rol ${x.id_rol} o el permiso ${x.id_permiso} aún no existe en usr_`);
    await run(`IF NOT EXISTS (SELECT 1 FROM usr_rol_permiso WHERE id_rol=@r AND id_permiso=@p) INSERT INTO usr_rol_permiso (id_rol, id_permiso) VALUES (@r,@p)`, { r: Number(x.id_rol), p: Number(x.id_permiso) });
  },
  async borrar({ run, clave }) { const [r, p] = String(clave).split('|').map(Number); await run(`DELETE FROM usr_rol_permiso WHERE id_rol=@r AND id_permiso=@p`, { r, p }); },
};

const usuarioRol = {
  async upsert({ run, leg, clave }) {
    const x = await compuesta(leg, 'rel_usuario_rol', 'id_usuario', 'id_rol', clave); if (!x) return 'SIN_FILA';
    if (!(await run(`SELECT 1 x FROM usr_usuario WHERE id=@u`, { u: Number(x.id_usuario) })).length || !(await run(`SELECT 1 x FROM usr_rol WHERE id=@r`, { r: Number(x.id_rol) })).length) throw new Error(`el usuario ${x.id_usuario} o el rol ${x.id_rol} aún no existe en usr_`);
    await run(`IF NOT EXISTS (SELECT 1 FROM usr_usuario_rol WHERE id_usuario=@u AND id_rol=@r) INSERT INTO usr_usuario_rol (id_usuario, id_rol) VALUES (@u,@r)`, { u: Number(x.id_usuario), r: Number(x.id_rol) });
  },
  async borrar({ run, clave }) { const [u, r] = String(clave).split('|').map(Number); await run(`DELETE FROM usr_usuario_rol WHERE id_usuario=@u AND id_rol=@r`, { u, r }); },
};

// Decide el hash que debe quedar guardado, sin rehashear si el actual ya valida la clave.
async function hashDe(u, habilitado, hashActual) {
  const guardada = String(u.clave_usuario ?? '');
  if (isBcryptHash(guardada.trim())) return guardada.trim();
  if (habilitado && guardada.length > 0) {
    if (Buffer.byteLength(guardada) > 72) throw new Error('la clave supera el límite de 72 bytes de bcrypt');
    if (hashActual && isBcryptHash(hashActual) && (await verifyPassword(guardada, hashActual)).match) return hashActual;   // ya valida: no se toca
    const h = await hashPassword(guardada); const v = await verifyPassword(guardada, h); if (!v.match) throw new Error('el hash nuevo no valida contra la clave'); return h;
  }
  if (hashActual) return hashActual;   // deshabilitado o sin clave: se conserva lo que había (inutilizable)
  return bcrypt.hash(crypto.randomBytes(24).toString('hex'), 4);
}

const usuario = {
  async upsert({ ctx, run, leg, clave }) {
    const u = await filaLegado(leg, 'mae_usuario', 'id_usuario', clave); if (!u) return 'SIN_FILA'; const id = Number(u.id_usuario); if (id <= 0) return;
    const previo = (await run(`SELECT nombre_usuario, email, clave_hash FROM usr_usuario WHERE id=@i`, { i: id }))[0];
    const habilitado = yes(u.habilitado);
    let login = norm(u.nombre_usuario) || `USUARIO-${id}`;
    const choque = (await run(`SELECT id FROM usr_usuario WHERE nombre_usuario=@l AND id<>@i`, { l: login, i: id })).length > 0;
    if (choque) login = `${login}#${id}`;
    if (login.length > 25) throw new Error(`el login de ${id} supera 25 caracteres`);
    let email = t(u.correo_electronico); if (email && (await run(`SELECT id FROM usr_usuario WHERE email=@e AND id<>@i`, { e: email, i: id })).length) email = null;
    const cargo = Number(u.id_cargo) > 0 ? (await mapa(ctx, run, 'mae_cargo')).get(Number(u.id_cargo)) ?? null : null;
    const lugar = Number(u.id_lugaranalisis) > 0 ? (await mapa(ctx, run, 'mae_lugaranalisis')).get(Number(u.id_lugaranalisis)) ?? null : null;
    const persona = (await mapa(ctx, run, 'mae_usuario')).get(id) ?? null;   // 'mae_usuario' → per_persona (coordinadores y jefaturas)
    const sig = t(u.mam_cargo); const sigla = sig && /^(CM|CO|JT)$/.test(sig) ? sig : null;
    const hash = await hashDe(u, habilitado, previo?.clave_hash);
    await upsertConId(run, 'usr_usuario', id, { nombre_usuario: login, email, nombre: (t(u.usuario) || login).slice(0, 150), clave_hash: hash, foto: t(u.foto), id_persona: persona, id_cargo: cargo, id_lugar_analisis: lugar,
      habilitado, permisos_version: u.permisos_version ?? 0, sigla_cargo: sigla });
    await asegurarMapa(run, 'mae_usuario#usr', id, 'usr_usuario', id);
  },
  async borrar({ run, clave }) { await run(`DELETE FROM usr_usuario WHERE id=@i`, { i: Number(clave) }); await run(`DELETE FROM mig_id_map WHERE tabla_legado='mae_usuario#usr' AND id_legado=@i`, { i: Number(clave) }); },
};

export const manejadores = { mae_rol: rol, mae_permiso: permiso, rel_rol_permiso: rolPermiso, mae_usuario: usuario, rel_usuario_rol: usuarioRol };
