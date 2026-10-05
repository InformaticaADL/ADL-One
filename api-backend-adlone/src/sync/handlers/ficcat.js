// Catálogos de la ficha (fic_*): mismas reglas que scripts/migracion-fic-cat.mjs.
//   - todas las filas (también las deshabilitadas: las fichas antiguas pueden citarlas);
//   - nombre repetido: la fila de id menor conserva el nombre y las demás quedan "nombre (id)"; objetivos se distinguen por (nombre, informe)
//     y tipos de muestreo por (nombre, aplicado_a);
//   - componente (mae_tipomuestra): solo los que usan las subáreas o las fichas (las otras ~170 filas son tipos de muestra de laboratorio);
//     si una ficha o subárea nueva cita uno que aún no se copió, se copia en ese momento (asegurarComponente);
//   - el lugar de análisis también se refleja en los usuarios que lo tienen (usr_usuario.id_lugar_analisis).
import sql from 'mssql';
import { norm, t, numero, upsertMapeado, borrarMapeado } from '../comun.js';
import { mapa, filaLegado } from './contexto.js';

const V = (v) => v === true || v === 1 || /^(S|SI|V|1|TRUE)$/i.test(norm(v));   // en estos catálogos 'V' también es "vigente"
const idDe = async (run, tl, id) => (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: tl, l: Number(id) }))[0]?.id_nuevo;

const CAT = {
  lugar: { tl: 'mae_lugaranalisis', id: 'id_lugaranalisis', nom: 'nombre_lugaranalisis', hab: 'habilitado', tabla: 'fic_lugar_analisis', max: 100, extra: (f) => ({ sigla: t(f.sigla)?.slice(0, 10) ?? null }) },
  objetivo: { tl: 'mae_objetivomuestreo_ma', id: 'id_objetivomuestreo_ma', nom: 'nombre_objetivomuestreo_ma', hab: 'habilitado', tabla: 'fic_objetivo_muestreo', max: 150, extra: (f) => ({ tipo_informe: t(f.informe)?.slice(0, 80) ?? null }), par: 'informe' },
  instrumento: { tl: 'mae_instrumentoambiental', id: 'id', nom: 'nombre', hab: 'estado', tabla: 'fic_instrumento_ambiental', max: 100,
    extra: (f) => ({ habilitado: /^V$/i.test(norm(f.estado)) }) },   // ADL ONE solo ofrece estado 'V' (el 'S' de PDC nunca aparece en ningún desplegable)
  tmuestreo: { tl: 'mae_tipomuestreo', id: 'id_tipomuestreo', nom: 'nombre_tipomuestreo', hab: 'habilitado', tabla: 'fic_tipo_muestreo', max: 100, extra: (f) => ({ aplicado_a: t(f.aplicado_a)?.slice(0, 50) ?? null }), par: 'aplicado_a' },
  tmuestra: { tl: 'mae_tipomuestra_ma', id: 'id_tipomuestra_ma', nom: 'nombre_tipomuestra_ma', hab: 'habilitado', tabla: 'fic_tipo_muestra', max: 100 },
  componente: { tl: 'mae_tipomuestra', id: 'id_tipomuestra', nom: 'nombre_tipomuestra', hab: 'activo', tabla: 'fic_componente', max: 100,
    filtro: (x) => `EXISTS (SELECT 1 FROM mae_subarea s WHERE s.id_tipomuestra=${x}) OR EXISTS (SELECT 1 FROM App_Ma_FichaIngresoServicio_ENC e WHERE e.id_tipomuestra=${x})` },
  subarea: { tl: 'mae_subarea', id: 'id_subarea', nom: 'nombre_subarea', hab: 'activo', tabla: 'fic_subarea', max: 150,
    async extra(f, c) { const n = Number(f.id_tipomuestra); return { metodologia: t(f.metodologia)?.slice(0, 300) ?? null, id_componente: n > 0 ? await asegurarComponente(c, n) : null }; } },
  actividad: { tl: 'mae_actividadmuestreo', id: 'id_actividadmuestreo', nom: 'nombre_actividadmuestreo', hab: 'activo', tabla: 'fic_actividad_muestreo', max: 100 },
  descarga: { tl: 'mae_tipodescarga', id: 'id_tipodescarga', nom: 'nombre_tipodescarga', hab: 'habilitado', tabla: 'fic_tipo_descarga', max: 100 },
  modalidad: { tl: 'mae_modalidad', id: 'id_modalidad', nom: 'nombre_modalidad', hab: 'habilitado', tabla: 'fic_modalidad_caudal', max: 100 },
  canal: { tl: 'mae_formacanal', id: 'id_formacanal', nom: 'nombre_formacanal', hab: 'habilitado', tabla: 'fic_forma_canal', max: 100 },
  frecuencia: { tl: 'mae_frecuencia', id: 'id_frecuencia', nom: 'nombre_frecuencia', hab: 'habilitado', tabla: 'fic_frecuencia', max: 60, positivo: true,
    extra: (f) => ({ orden: numero(f.orden), multiplicador_anual: numero(f.multiplicadopor), dias: numero(f.dias), cantidad: numero(f.cantidad) }) },
  laboratorio: { tl: 'mae_laboratorioensayo', id: 'id_laboratorioensayo', nom: 'nombre_laboratorioensayo', hab: 'habilitado', tabla: 'fic_laboratorio_ensayo', max: 100, positivo: true,
    extra: (f) => ({ es_etfa: V(f.etfa), email: t(f.correo_electronico)?.slice(0, 150) ?? null }) },
  entrega: { tl: 'mae_tipoentrega', id: 'id_tipoentrega', nom: 'nombre_tipoentrega', hab: 'habilitado', tabla: 'fic_tipo_entrega', max: 50, positivo: true },
  transporte: { tl: 'mae_transporte', id: 'id_transporte', nom: 'nombre_transporte', hab: 'habilitado', tabla: 'fic_transporte', max: 50, positivo: true },
  dispositivo: { tl: 'mae_dispositivohidraulico', id: 'id_dispositivohidraulico', nom: 'nombre_dispositivohidraulico', hab: 'habilitado', tabla: 'fic_dispositivo_hidraulico', max: 100 },
};

// Copia (o actualiza) una fila de catálogo. Devuelve el id nuevo.
async function copiar(cfg, c, f) {
  const { run, leg } = c; const idL = Number(f[cfg.id]);
  let nombre = t(f[cfg.nom]) || `(sin nombre ${idL})`; if (nombre.length > cfg.max) nombre = nombre.slice(0, cfg.max);
  // ¿hay otra fila del legado con el mismo nombre (y mismo informe/ámbito) y id menor? entonces esta queda "nombre (id)"
  const rq = leg.request().input('id', sql.Numeric(18, 0), idL).input('n', sql.NVarChar(400), nombre);
  const par = cfg.par ? ` AND ISNULL(LTRIM(RTRIM([${cfg.par}])),'') = @p` : ''; if (cfg.par) rq.input('p', sql.NVarChar(400), t(f[cfg.par]) || '');
  const solo = cfg.filtro ? ` AND (${cfg.filtro(`x.[${cfg.id}]`)})` : '';   // el cargador solo compara contra las filas que copia
  const dup = (await rq.query(`SELECT COUNT(*) n FROM [${cfg.tl}] x WHERE x.[${cfg.id}] < @id AND LTRIM(RTRIM(x.[${cfg.nom}])) = @n${par.split('[').join('x.[')}${solo}`)).recordset[0].n;
  if (dup) nombre = `${nombre} (${idL})`.slice(0, cfg.max);
  const extras = cfg.extra ? await cfg.extra(f, c) : {};
  const id = await upsertMapeado(c.run, { tablaLegado: cfg.tl, idLegado: idL, tabla: cfg.tabla, obj: { nombre, habilitado: cfg.hab ? V(f[cfg.hab]) : true, ...extras },
    buscarNatural: async () => (await run(`SELECT TOP 1 id FROM ${cfg.tabla} WHERE nombre=@n`, { n: nombre }))[0]?.id });
  c.ctx.cache?.[`m:${cfg.tl}`]?.set(idL, id);   // los demás manejadores de esta pasada ven el valor nuevo
  return id;
}

export async function asegurarComponente(c, idL) {
  const previo = await idDe(c.run, 'mae_tipomuestra', idL); if (previo) return previo;
  const f = await filaLegado(c.leg, 'mae_tipomuestra', 'id_tipomuestra', idL); if (!f) throw new Error(`el componente ${idL} no existe en el legado`);
  return copiar(CAT.componente, c, f);
}

const fabrica = (cfg) => ({
  async upsert(c) {
    const f = await filaLegado(c.leg, cfg.tl, cfg.id, c.clave); if (!f) return 'SIN_FILA';
    if (cfg.positivo && Number(c.clave) <= 0) return;   // id 0 = "sin valor" (fila de relleno del legado): no se copia
    if (cfg.filtro) { const usado = (await c.leg.request().input('id', sql.Numeric(18, 0), Number(c.clave)).query(`SELECT CASE WHEN ${cfg.filtro('@id')} THEN 1 ELSE 0 END u`)).recordset[0].u; if (!usado && !(await idDe(c.run, cfg.tl, c.clave))) return; }
    const id = await copiar(cfg, c, f);
    if (cfg === CAT.lugar) {   // usuarios con este lugar de análisis
      for (const u of (await c.leg.request().input('l', sql.Numeric(18, 0), Number(c.clave)).query(`SELECT id_usuario FROM mae_usuario WHERE id_lugaranalisis=@l AND id_usuario>0`)).recordset)
        await c.run(`UPDATE usr_usuario SET id_lugar_analisis=@l WHERE id=@u AND ISNULL(id_lugar_analisis,0)<>@l`, { l: id, u: Number(u.id_usuario) });
    }
  },
  async borrar({ run, clave }) { if (cfg === CAT.lugar) { const n = await idDe(run, cfg.tl, clave); if (n) await run(`UPDATE usr_usuario SET id_lugar_analisis=NULL WHERE id_lugar_analisis=@n`, { n }); } await borrarMapeado(run, { tablaLegado: cfg.tl, idLegado: Number(clave), tabla: cfg.tabla }); },
});

export const manejadores = Object.fromEntries(Object.values(CAT).map((cfg) => [cfg.tl, fabrica(cfg)]));
export const REGISTRO_FICCAT = Object.values(CAT).map((cfg, i) => ({ tabla: cfg.tl, modulo: 'fic', modo: 'fila', pk: [cfg.id], orden: 550 + i }));
void mapa;
