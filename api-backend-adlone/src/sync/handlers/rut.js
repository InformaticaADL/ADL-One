// Manejadores del módulo rut_ (rutas planificadas y su ejecución). Requiere el parche 20_patch_rut.sql.
// Fichas y visitas se resuelven por sus equivalencias ya conocidas (fic_ficha vía mig_id_map, fic_visita vía
// id_agendamam_legacy directo, igual que en fic.js); personas y usuarios, por las suyas (per_muestreador, usr_usuario).
import sql from 'mssql';
import { norm, t, dt, upsertConId, upsertMapeado, borrarMapeado } from '../comun.js';
import { mapa } from './contexto.js';

const MAP_ENC = 'App_Ma_FichaIngresoServicio_ENC';
const una = (leg, tabla, col, v) => leg.request().input('v', sql.Numeric(18, 0), Number(v)).query(`SELECT * FROM ${tabla} WHERE ${col}=@v`).then((r) => r.recordset[0]);
const fichaDe = async (ctx, run, idLeg) => (await mapa(ctx, run, MAP_ENC)).get(Number(idLeg)) ?? null;
const visitaDe = (run, idAgendamam) => run(`SELECT id FROM fic_visita WHERE id_agendamam_legacy=@a`, { a: Number(idAgendamam) }).then((r) => r[0]?.id ?? null);

const grupo = {
  async upsert({ run, leg, clave }) {
    const g = await una(leg, 'mae_grupos_rutas', 'id_grupo', clave); if (!g) return 'SIN_FILA';
    const id = Number(g.id_grupo);
    await upsertConId(run, 'rut_grupo', id, { nombre: (t(g.nombre_grupo) || `Grupo ${id}`).slice(0, 250), descripcion: t(g.descripcion)?.slice(0, 1000) ?? null, habilitado: g.activo === true || g.activo === 1, creado_en: dt(g.fecha_creacion) ?? undefined });
    await run(`IF NOT EXISTS (SELECT 1 FROM mig_id_map WHERE tabla_legado='mae_grupos_rutas' AND id_legado=@l) INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_grupos_rutas', @l, 'rut_grupo', @i)`, { l: id, i: id });
  },
  async borrar({ run, clave }) { await run(`DELETE FROM rut_grupo WHERE id=@i`, { i: Number(clave) }); await run(`DELETE FROM mig_id_map WHERE tabla_legado='mae_grupos_rutas' AND id_legado=@i`, { i: Number(clave) }); },
};

const planificada = {
  async upsert({ ctx, run, leg, clave }) {
    const r = await una(leg, 'mae_rutas_planificadas', 'id_ruta_planificada', clave); if (!r) return 'SIN_FILA'; const id = Number(r.id_ruta_planificada);
    const usu = Number(r.id_usuario_creador) > 0 ? (await mapa(ctx, run, 'mae_usuario#usr')).get(Number(r.id_usuario_creador)) ?? null : null;
    const grp = Number(r.id_grupo) > 0 ? (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado='mae_grupos_rutas' AND id_legado=@l`, { l: Number(r.id_grupo) }))[0]?.id_nuevo ?? null : null;
    await upsertConId(run, 'rut_planificada', id, { nombre: (t(r.nombre_ruta) || `Ruta ${id}`).slice(0, 250), id_usuario_creador: usu, estado: (t(r.estado) || 'PENDIENTE').slice(0, 30), id_grupo: grp,
      descripcion: t(r.descripcion)?.slice(0, 1000) ?? null, distancia_metros: r.distancia_metros ?? null, duracion_segundos: r.duracion_segundos ?? null, creado_en: dt(r.fecha_creacion) ?? undefined });
    await run(`IF NOT EXISTS (SELECT 1 FROM mig_id_map WHERE tabla_legado='mae_rutas_planificadas' AND id_legado=@l) INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_rutas_planificadas', @l, 'rut_planificada', @i)`, { l: id, i: id });
  },
  async borrar({ run, clave }) { await run(`DELETE FROM rut_planificada_detalle WHERE id_planificada=@i`, { i: Number(clave) }); await run(`DELETE FROM rut_planificada WHERE id=@i`, { i: Number(clave) }); await run(`DELETE FROM mig_id_map WHERE tabla_legado='mae_rutas_planificadas' AND id_legado=@i`, { i: Number(clave) }); },
};

const planificadaDetalle = {
  async upsert({ ctx, run, leg, clave }) {
    const r = await una(leg, 'mae_rutas_planificadas_detalle', 'id_ruta_detalle', clave); if (!r) return 'SIN_FILA'; const id = Number(r.id_ruta_detalle);
    const plan = (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado='mae_rutas_planificadas' AND id_legado=@l`, { l: Number(r.id_ruta_planificada) }))[0]?.id_nuevo;
    if (!plan) throw new Error(`la ruta planificada ${r.id_ruta_planificada} aún no existe en rut_planificada`);
    const ficha = await fichaDe(ctx, run, r.id_fichaingresoservicio); if (!ficha) throw new Error(`la ficha ${r.id_fichaingresoservicio} aún no existe en fic_ficha`);
    await upsertConId(run, 'rut_planificada_detalle', id, { id_planificada: plan, id_ficha: ficha, orden: Number(r.orden) || 1, correlativo_legacy: t(r.frecuencia_correlativo)?.slice(0, 100) ?? null });
    await run(`IF NOT EXISTS (SELECT 1 FROM mig_id_map WHERE tabla_legado='mae_rutas_planificadas_detalle' AND id_legado=@l) INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_rutas_planificadas_detalle', @l, 'rut_planificada_detalle', @i)`, { l: id, i: id });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_rutas_planificadas_detalle', idLegado: Number(clave), tabla: 'rut_planificada_detalle' }),
};

const ejecucion = {
  async upsert({ ctx, run, leg, clave }) {
    const r = await una(leg, 'mae_rutas_ejecuciones', 'id_ejecucion', clave); if (!r) return 'SIN_FILA'; const id = Number(r.id_ejecucion);
    const plan = (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado='mae_rutas_planificadas' AND id_legado=@l`, { l: Number(r.id_ruta_planificada) }))[0]?.id_nuevo;
    if (!plan) throw new Error(`la ruta planificada ${r.id_ruta_planificada} aún no existe en rut_planificada`);
    const mue = await mapa(ctx, run, 'mae_muestreador'); const inst = mue.get(Number(r.id_muestreador_inst)); const ret = Number(r.id_muestreador_ret) > 0 ? mue.get(Number(r.id_muestreador_ret)) ?? null : null;
    if (!inst) throw new Error(`el muestreador ${r.id_muestreador_inst} sin equivalente en per_`);
    const usu = Number(r.id_usuario_creador) > 0 ? (await mapa(ctx, run, 'mae_usuario#usr')).get(Number(r.id_usuario_creador)) ?? null : null;
    await upsertConId(run, 'rut_ejecucion', id, { id_planificada: plan, fecha_ejecucion: r.fecha_ejecucion, id_persona_muestreador_instalacion: inst, id_persona_muestreador_retiro: ret,
      estado: (t(r.estado) || 'ASIGNADA').slice(0, 30), observaciones: t(r.observaciones)?.slice(0, 500) ?? null, id_usuario_creador: usu, creado_en: dt(r.fecha_creacion) ?? undefined });
    await run(`IF NOT EXISTS (SELECT 1 FROM mig_id_map WHERE tabla_legado='mae_rutas_ejecuciones' AND id_legado=@l) INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_rutas_ejecuciones', @l, 'rut_ejecucion', @i)`, { l: id, i: id });
  },
  async borrar({ run, clave }) { await run(`DELETE FROM rut_ejecucion_detalle WHERE id_ejecucion=@i`, { i: Number(clave) }); await run(`DELETE FROM rut_ejecucion WHERE id=@i`, { i: Number(clave) }); await run(`DELETE FROM mig_id_map WHERE tabla_legado='mae_rutas_ejecuciones' AND id_legado=@i`, { i: Number(clave) }); },
};

const ejecucionDetalle = {
  async upsert({ ctx, run, leg, clave }) {
    const r = await una(leg, 'mae_rutas_ejecuciones_detalle', 'id_detalle_ejec', clave); if (!r) return 'SIN_FILA'; const id = Number(r.id_detalle_ejec);
    const ejec = (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado='mae_rutas_ejecuciones' AND id_legado=@l`, { l: Number(r.id_ejecucion) }))[0]?.id_nuevo;
    if (!ejec) throw new Error(`la ejecución ${r.id_ejecucion} aún no existe en rut_ejecucion`);
    const ficha = await fichaDe(ctx, run, r.id_fichaingresoservicio); if (!ficha) throw new Error(`la ficha ${r.id_fichaingresoservicio} aún no existe en fic_ficha`);
    const visita = Number(r.id_agendamam) > 0 ? await visitaDe(run, r.id_agendamam) : null;
    await upsertConId(run, 'rut_ejecucion_detalle', id, { id_ejecucion: ejec, id_ficha: ficha, orden: Number(r.orden) || 1, correlativo_legacy: t(r.frecuencia_correlativo)?.slice(0, 100) ?? null, id_visita: visita });
    await run(`IF NOT EXISTS (SELECT 1 FROM mig_id_map WHERE tabla_legado='mae_rutas_ejecuciones_detalle' AND id_legado=@l) INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES ('mae_rutas_ejecuciones_detalle', @l, 'rut_ejecucion_detalle', @i)`, { l: id, i: id });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_rutas_ejecuciones_detalle', idLegado: Number(clave), tabla: 'rut_ejecucion_detalle' }),
};

export const manejadores = { mae_grupos_rutas: grupo, mae_rutas_planificadas: planificada, mae_rutas_planificadas_detalle: planificadaDetalle, mae_rutas_ejecuciones: ejecucion, mae_rutas_ejecuciones_detalle: ejecucionDetalle };
void norm;
