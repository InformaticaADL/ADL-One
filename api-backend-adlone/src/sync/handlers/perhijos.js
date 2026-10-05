// Competencias y documentos de las personas de terreno (mae_muestreador_competencia / mae_muestreador_documento → per_persona_competencia /
// per_persona_documento). Hoy no tienen filas en el legado; se cubren para que el corte no pierda las que lleguen después.
import sql from 'mssql';
import { t, dt, upsertMapeado, borrarMapeado } from '../comun.js';
import { mapa } from './contexto.js';

const competencia = {
  async upsert({ ctx, run, leg, clave }) {
    const [m, c] = String(clave).split('|').map(Number);
    const x = (await leg.request().input('m', sql.Numeric(18, 0), m).input('c', sql.Int, c).query(`SELECT * FROM mae_muestreador_competencia WHERE id_muestreador=@m AND id_competencia=@c`)).recordset[0]; if (!x) return 'SIN_FILA';
    const persona = (await mapa(ctx, run, 'mae_muestreador')).get(m), comp = (await mapa(ctx, run, 'mae_competencia')).get(c);
    if (!persona || !comp) throw new Error(`persona ${m} / competencia ${c} sin equivalente en per_`);
    const ya = (await run(`SELECT 1 x FROM per_persona_competencia WHERE id_persona=@p AND id_competencia=@c`, { p: persona, c: comp })).length;
    if (ya) await run(`UPDATE per_persona_competencia SET fecha_asignacion=COALESCE(@f, fecha_asignacion) WHERE id_persona=@p AND id_competencia=@c`, { p: persona, c: comp, f: dt(x.fecha_asignacion) });
    else await run(`INSERT INTO per_persona_competencia (id_persona, id_competencia, fecha_asignacion) VALUES (@p, @c, COALESCE(@f, SYSDATETIME()))`, { p: persona, c: comp, f: dt(x.fecha_asignacion) });
  },
  async borrar({ ctx, run, clave }) {
    const [m, c] = String(clave).split('|').map(Number); const persona = (await mapa(ctx, run, 'mae_muestreador')).get(m), comp = (await mapa(ctx, run, 'mae_competencia')).get(c);
    if (persona && comp) await run(`DELETE FROM per_persona_competencia WHERE id_persona=@p AND id_competencia=@c`, { p: persona, c: comp });
  },
};

const documento = {
  async upsert({ ctx, run, leg, clave }) {
    const x = (await leg.request().input('v', sql.Int, Number(clave)).query(`SELECT * FROM mae_muestreador_documento WHERE id_documento=@v`)).recordset[0]; if (!x) return 'SIN_FILA';
    const persona = (await mapa(ctx, run, 'mae_muestreador')).get(Number(x.id_muestreador)); if (!persona) throw new Error(`persona ${x.id_muestreador} sin equivalente en per_`);
    const usu = Number(x.id_usuario_subida) > 0 ? (await mapa(ctx, run, 'mae_usuario#usr')).get(Number(x.id_usuario_subida)) ?? null : null;
    await upsertMapeado(run, { tablaLegado: 'mae_muestreador_documento', idLegado: Number(clave), tabla: 'per_persona_documento', obj: { id_persona: persona, nombre_documento: (t(x.nombre_documento) || '(sin nombre)').slice(0, 200),
      descripcion: t(x.descripcion)?.slice(0, 400) ?? null, ruta_archivo: (t(x.ruta_archivo) || '').slice(0, 300), subido_en: dt(x.fecha_subida) ?? undefined, id_usuario_subida: usu } });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_muestreador_documento', idLegado: Number(clave), tabla: 'per_persona_documento' }),
};

export const manejadores = { mae_muestreador_competencia: competencia, mae_muestreador_documento: documento };
