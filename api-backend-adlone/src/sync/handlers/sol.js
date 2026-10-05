// Manejadores del módulo sol_ (solicitudes / URS). Las mismas reglas que scripts/migracion-sol.mjs, pero por fila y sin borrar nada
// que no haya cambiado. Cada manejador es idempotente: aplicarlo dos veces deja el mismo resultado.
import { t, raw, yes, dt, libre, upsertConId, upsertMapeado, borrarMapeado } from '../comun.js';
import { mapa, nombres, filaLegado } from './contexto.js';

// Quién es quién: el legado mezcla ids de USUARIO (ADL ONE) y de MUESTREADOR (APP MAM) en la misma columna.
async function actor(ctx, run, idLeg, prefiere) {
  const n = Number(idLeg); if (!(n > 0)) return {};
  const USR = await mapa(ctx, run, 'mae_usuario#usr'), PER = await mapa(ctx, run, 'mae_muestreador');
  const orden = prefiere === 'persona' ? ['persona', 'usuario'] : ['usuario', 'persona'];
  for (const lado of orden) {
    if (lado === 'usuario' && USR.has(n)) return { usuario: USR.get(n), nombre: (await nombres(ctx, run, 'usr_usuario')).get(USR.get(n)) };
    if (lado === 'persona' && PER.has(n)) return { persona: PER.get(n), nombre: (await nombres(ctx, run, 'per_persona')).get(PER.get(n)) };
  }
  return {};
}

const registrarMapa = (run, tablaLegado, idLegado, tabla, idNuevo) => run(
  `IF NOT EXISTS (SELECT 1 FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l) INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES (@t,@l,@n,@i)`,
  { t: tablaLegado, l: idLegado, n: tabla, i: idNuevo });

/* ---------- mae_solicitud_tipo → sol_tipo (id conservado) ---------- */
const tipo = {
  async upsert({ run, leg, clave }) {
    const x = await filaLegado(leg, 'mae_solicitud_tipo', 'id_tipo', clave); if (!x) return 'SIN_FILA';
    const id = Number(x.id_tipo);
    await upsertConId(run, 'sol_tipo', id, { nombre: (t(x.nombre) || `Tipo ${id}`).slice(0, 150), area_destino: t(x.area_destino), cod_permiso_crear: t(x.cod_permiso_crear), cod_permiso_resolver: t(x.cod_permiso_resolver),
      formulario_config_json: raw(x.formulario_config), workflow_config_json: raw(x.workflow_config), modulo_destino: t(x.modulo_destino), habilitado: x.estado === true || x.estado === 1 });
    await registrarMapa(run, 'mae_solicitud_tipo', id, 'sol_tipo', id);
  },
  async borrar({ run, clave }) { await run(`DELETE FROM sol_tipo WHERE id=@i`, { i: Number(clave) }); await run(`DELETE FROM mig_id_map WHERE tabla_legado='mae_solicitud_tipo' AND id_legado=@i`, { i: Number(clave) }); },
};

/* ---------- rel_solicitud_tipo_permiso → sol_tipo_permiso ---------- */
const permiso = {
  async upsert({ ctx, run, leg, clave }) {
    const x = await filaLegado(leg, 'rel_solicitud_tipo_permiso', 'id_permiso_sol', clave); if (!x) return 'SIN_FILA';
    const ROL = await mapa(ctx, run, 'mae_rol'), USR = await mapa(ctx, run, 'mae_usuario#usr');
    const rol = Number(x.id_rol) > 0 ? ROL.get(Number(x.id_rol)) : null, usu = Number(x.id_usuario) > 0 ? USR.get(Number(x.id_usuario)) : null;
    if ((Number(x.id_rol) > 0 && !rol) || (Number(x.id_usuario) > 0 && !usu)) throw new Error(`rol ${x.id_rol} / usuario ${x.id_usuario} sin equivalente en usr_`);
    if (!rol && !usu) throw new Error('permiso por tipo sin rol ni usuario');
    const obj = { id_tipo: Number(x.id_tipo), id_rol: rol ?? null, id_usuario: rol ? null : usu, tipo_acceso: t(x.tipo_acceso) };
    await upsertMapeado(run, { tablaLegado: 'rel_solicitud_tipo_permiso', idLegado: Number(x.id_permiso_sol), tabla: 'sol_tipo_permiso', obj,
      buscarNatural: async () => (await run(`SELECT TOP 1 id FROM sol_tipo_permiso WHERE id_tipo=@t AND tipo_acceso=@a AND ISNULL(id_rol,0)=@r AND ISNULL(id_usuario,0)=@u`, { t: obj.id_tipo, a: obj.tipo_acceso, r: obj.id_rol ?? 0, u: obj.id_usuario ?? 0 }))[0]?.id });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'rel_solicitud_tipo_permiso', idLegado: Number(clave), tabla: 'sol_tipo_permiso' }),
};

/* ---------- rel_solicitud_tipo_notificacion → sol_tipo_notificacion ---------- */
const notificacion = {
  async upsert({ run, leg, clave }) {
    const x = await filaLegado(leg, 'rel_solicitud_tipo_notificacion', 'id_config_notif', clave); if (!x) return 'SIN_FILA';
    const obj = { id_tipo: Number(x.id_tipo), accion: t(x.accion), notifica_web: yes(x.notifica_web), notifica_email: yes(x.notifica_email) };
    await upsertMapeado(run, { tablaLegado: 'rel_solicitud_tipo_notificacion', idLegado: Number(x.id_config_notif), tabla: 'sol_tipo_notificacion', obj,
      buscarNatural: async () => (await run(`SELECT TOP 1 id FROM sol_tipo_notificacion WHERE id_tipo=@t AND accion=@a`, { t: obj.id_tipo, a: obj.accion }))[0]?.id });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'rel_solicitud_tipo_notificacion', idLegado: Number(clave), tabla: 'sol_tipo_notificacion' }),
};

/* ---------- mae_solicitud → sol_solicitud (id conservado) ---------- */
const solicitud = {
  async upsert({ ctx, run, leg, clave }) {
    const s = await filaLegado(leg, 'mae_solicitud', 'id_solicitud', clave); if (!s) return 'SIN_FILA';
    const id = Number(s.id_solicitud);
    const cod = (await run(`SELECT cod_permiso_crear FROM sol_tipo WHERE id=@t`, { t: Number(s.id_tipo) }))[0];
    if (!cod) throw new Error(`el tipo ${s.id_tipo} aún no existe en sol_tipo`);
    const a = await actor(ctx, run, s.id_solicitante, cod.cod_permiso_crear === 'MUESTREADOR' ? 'persona' : 'usuario');
    if (!a.usuario && !a.persona) throw new Error(`solicitante ${s.id_solicitante} sin equivalente en usr_ ni per_`);
    const notif = s.notificado_uns === true || s.notificado_uns === 1;
    const previo = (await run(`SELECT notificado_en FROM sol_solicitud WHERE id=@i`, { i: id }))[0]?.notificado_en;
    await upsertConId(run, 'sol_solicitud', id, { id_tipo: Number(s.id_tipo), id_solicitante: a.usuario ?? null, id_persona_solicitante: a.persona ?? null, estado: t(s.estado) || 'PENDIENTE', prioridad: t(s.prioridad) || 'NORMAL',
      datos_json: raw(s.datos_json) ?? '{}', area_actual: t(s.area_actual), observaciones: libre(s.observaciones, 500), creado_en: dt(s.fecha_creacion) ?? undefined, actualizado_en: dt(s.fecha_actualizacion),
      // la fecha de notificación se fija una vez; si la solicitud se vuelve a notificar en el legado (bandera en 0) vuelve a quedar pendiente
      notificado_en: notif ? (previo ?? dt(s.fecha_actualizacion) ?? dt(s.fecha_creacion) ?? new Date()) : null });
    await registrarMapa(run, 'mae_solicitud', id, 'sol_solicitud', id);
  },
  async borrar({ run, clave }) { await run(`DELETE FROM sol_solicitud WHERE id=@i`, { i: Number(clave) }); await run(`DELETE FROM mig_id_map WHERE tabla_legado='mae_solicitud' AND id_legado=@i`, { i: Number(clave) }); },
};

/* ---------- mae_solicitud_historial → sol_historial ---------- */
const historial = {
  async upsert({ ctx, run, leg, clave }) {
    const h = await filaLegado(leg, 'mae_solicitud_historial', 'id_historial', clave); if (!h) return 'SIN_FILA';
    const sol = (await run(`SELECT id, id_persona_solicitante FROM sol_solicitud WHERE id=@i`, { i: Number(h.id_solicitud) }))[0];
    if (!sol) throw new Error(`la solicitud ${h.id_solicitud} aún no existe en sol_solicitud`);
    const idSolLeg = (await filaLegado(leg, 'mae_solicitud', 'id_solicitud', h.id_solicitud))?.id_solicitante;
    // el id igual al del solicitante hereda su espacio (usuario o muestreador)
    const pref = Number(h.id_usuario) === Number(idSolLeg) ? (sol.id_persona_solicitante ? 'persona' : 'usuario') : 'usuario';
    const a = await actor(ctx, run, h.id_usuario, pref);
    const obj = { id_solicitud: Number(h.id_solicitud), id_usuario: a.usuario ?? null, id_persona: a.persona ?? null, snap_nombre_usuario: a.nombre ? String(a.nombre).slice(0, 150) : null, accion: t(h.accion),
      estado_anterior: t(h.estado_anterior), estado_nuevo: t(h.estado_nuevo), observacion: libre(h.observacion, 500), fecha: dt(h.fecha) ?? undefined };
    await upsertMapeado(run, { tablaLegado: 'mae_solicitud_historial', idLegado: Number(h.id_historial), tabla: 'sol_historial', obj,
      buscarNatural: async () => (await run(`SELECT TOP 1 id FROM sol_historial WHERE id_solicitud=@s AND accion=@a AND ISNULL(estado_nuevo,'')=@e AND ABS(DATEDIFF(MILLISECOND, fecha, @f)) < 5`, { s: obj.id_solicitud, a: obj.accion, e: obj.estado_nuevo ?? '', f: obj.fecha ?? new Date(0) }))[0]?.id });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_solicitud_historial', idLegado: Number(clave), tabla: 'sol_historial' }),
};

export const manejadores = {
  mae_solicitud_tipo: tipo, rel_solicitud_tipo_permiso: permiso, rel_solicitud_tipo_notificacion: notificacion, mae_solicitud: solicitud, mae_solicitud_historial: historial,
};
