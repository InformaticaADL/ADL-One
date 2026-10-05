// Tablas hijas de solicitudes: equipos (mae_solicitud_equipo), derivaciones, comentarios y adjuntos. Hoy están vacías en el legado; se cubren
// para que el corte no pierda las filas que lleguen después. Mismas reglas que sol.js (el legado mezcla ids de usuario y de muestreador).
import sql from 'mssql';
import { t, raw, dt, libre, upsertConId, upsertMapeado, borrarMapeado } from '../comun.js';
import { mapa } from './contexto.js';

const una = (leg, tabla, col, v) => leg.request().input('v', sql.Numeric(18, 0), Number(v)).query(`SELECT * FROM ${tabla} WHERE ${col}=@v`).then((r) => r.recordset[0]);
const usuario = async (ctx, run, id) => { const n = Number(id); if (!(n > 0)) return null; const u = (await mapa(ctx, run, 'mae_usuario#usr')).get(n); if (!u) throw new Error(`usuario ${n} sin equivalente en usr_`); return u; };
// id que puede ser de usuario o de muestreador (igual que en sol.js)
async function actor(ctx, run, id) {
  const n = Number(id); if (!(n > 0)) return {};
  const u = (await mapa(ctx, run, 'mae_usuario#usr')).get(n); if (u) return { usuario: u };
  const p = (await mapa(ctx, run, 'mae_muestreador')).get(n); if (p) return { persona: p };
  throw new Error(`actor ${n} sin equivalente en usr_ ni per_`);
}
const solicitudExiste = async (run, id) => { if (!(await run(`SELECT 1 x FROM sol_solicitud WHERE id=@i`, { i: Number(id) })).length) throw new Error(`la solicitud ${id} aún no existe en sol_solicitud`); return Number(id); };

const equipo = {
  async upsert({ ctx, run, leg, clave }) {
    const x = await una(leg, 'mae_solicitud_equipo', 'id_solicitud', clave); if (!x) return 'SIN_FILA'; const id = Number(x.id_solicitud);
    const sol = await actor(ctx, run, x.usuario_solicita);
    await upsertConId(run, 'sol_equipo_solicitud', id, { tipo_solicitud: (t(x.tipo_solicitud) || '(sin tipo)').slice(0, 30), estado: (t(x.estado) || 'PENDIENTE').slice(0, 30), datos_json: raw(x.datos_json) ?? '{}', origen_solicitud: t(x.origen_solicitud)?.slice(0, 20) ?? null,
      id_usuario_solicita: sol.usuario ?? null, id_persona_solicita: sol.persona ?? null, fecha_solicitud: dt(x.fecha_solicitud) ?? undefined, id_usuario_tecnica: await usuario(ctx, run, x.usuario_tecnica), fecha_revision_tecnica: dt(x.fecha_revision_tecnica),
      estado_tecnica: t(x.estado_tecnica)?.slice(0, 30) ?? null, feedback_tecnica: libre(x.feedback_tecnica, 400), id_usuario_aprueba: await usuario(ctx, run, x.usuario_aprueba), fecha_aprobacion: dt(x.fecha_aprobacion), feedback_aprobacion: libre(x.feedback_aprobacion, 400),
      id_usuario_revisa: await usuario(ctx, run, x.usuario_revisa), fecha_revision: dt(x.fecha_revision), feedback_admin: libre(x.feedback_admin, 400) });
    await run(`IF NOT EXISTS (SELECT 1 FROM mig_id_map WHERE tabla_legado='mae_solicitud_equipo' AND id_legado=@i) INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_solicitud_equipo', @i, 'sol_equipo_solicitud', @i)`, { i: id });
  },
  async borrar({ run, clave }) { await run(`DELETE FROM sol_equipo_solicitud WHERE id=@i`, { i: Number(clave) }); await run(`DELETE FROM mig_id_map WHERE tabla_legado='mae_solicitud_equipo' AND id_legado=@i`, { i: Number(clave) }); },
};

const derivacion = {
  async upsert({ ctx, run, leg, clave }) {
    const x = await una(leg, 'mae_solicitud_derivacion', 'id_derivacion', clave); if (!x) return 'SIN_FILA';
    const rol = Number(x.id_rol_destino) > 0 ? (await mapa(ctx, run, 'mae_rol')).get(Number(x.id_rol_destino)) ?? null : null; if (Number(x.id_rol_destino) > 0 && !rol) throw new Error(`rol ${x.id_rol_destino} sin equivalente en usr_`);
    await upsertMapeado(run, { tablaLegado: 'mae_solicitud_derivacion', idLegado: Number(clave), tabla: 'sol_derivacion', obj: { id_solicitud: await solicitudExiste(run, x.id_solicitud), area_origen: t(x.area_origen)?.slice(0, 60) ?? null, area_destino: t(x.area_destino)?.slice(0, 60) ?? null,
      id_usuario_origen: await usuario(ctx, run, x.usuario_origen), id_usuario_destino: await usuario(ctx, run, x.usuario_destino), id_rol_destino: rol, motivo: libre(x.motivo, 400), fecha: dt(x.fecha) ?? undefined } });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_solicitud_derivacion', idLegado: Number(clave), tabla: 'sol_derivacion' }),
};

const comentario = {
  async upsert({ ctx, run, leg, clave }) {
    const x = await una(leg, 'mae_solicitud_comentario', 'id_comentario', clave); if (!x) return 'SIN_FILA'; const a = await actor(ctx, run, x.id_usuario);
    await upsertMapeado(run, { tablaLegado: 'mae_solicitud_comentario', idLegado: Number(clave), tabla: 'sol_comentario', obj: { id_solicitud: await solicitudExiste(run, x.id_solicitud), id_usuario: a.usuario ?? null, id_persona: a.persona ?? null,
      mensaje: raw(x.mensaje) ?? '', es_privado: x.es_privado === true || x.es_privado === 1, es_sistema: x.es_sistema === true || x.es_sistema === 1, fecha: dt(x.fecha) ?? undefined } });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_solicitud_comentario', idLegado: Number(clave), tabla: 'sol_comentario' }),
};

const adjunto = {
  async upsert({ run, leg, clave }) {
    const x = await una(leg, 'mae_solicitud_adjunto', 'id_adjunto', clave); if (!x) return 'SIN_FILA';
    const com = Number(x.id_comentario) > 0 ? (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado='mae_solicitud_comentario' AND id_legado=@l`, { l: Number(x.id_comentario) }))[0]?.id_nuevo ?? null : null;
    if (Number(x.id_comentario) > 0 && !com) throw new Error(`el comentario ${x.id_comentario} aún no existe en sol_comentario`);
    const nombre = (t(x.nombre_archivo) || '(sin nombre)').slice(0, 300);
    await upsertMapeado(run, { tablaLegado: 'mae_solicitud_adjunto', idLegado: Number(clave), tabla: 'sol_archivo', obj: { id_solicitud: await solicitudExiste(run, x.id_solicitud), id_comentario: com, nombre_original: nombre, nombre_sistema: nombre,
      ruta_archivo: (t(x.ruta_archivo) || '').slice(0, 1000), mime_type: t(x.tipo_archivo)?.slice(0, 100) ?? null, creado_en: dt(x.fecha) ?? undefined } });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_solicitud_adjunto', idLegado: Number(clave), tabla: 'sol_archivo' }),
};

export const manejadores = { mae_solicitud_equipo: equipo, mae_solicitud_derivacion: derivacion, mae_solicitud_comentario: comentario, mae_solicitud_adjunto: adjunto };
