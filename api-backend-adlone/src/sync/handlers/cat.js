// Manejadores del módulo cat_. Mismas reglas que scripts/migracion-cat.mjs:
//   - solo las técnicas de Medio Ambiente: las que tienen límites en App_Ma_ReferenciaAnalisis (las demás son de Laboratorio);
//   - tipo de técnica: sale del TEXTO 'tipotecnica' (no de id_tipotecnica), y se crea si no existe;
//   - sección: solo las referenciadas por una técnica MA; normativas y referencias vacías (placeholder) se omiten.
import sql from 'mssql';
import { norm, t, si, placeholder, upsertMapeado, borrarMapeado, insertar, fijarMapa } from '../comun.js';
import { mapa, filaLegado } from './contexto.js';

const numOrNull = (v) => { if (v == null || norm(v) === '') return null; const n = Number(norm(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const idDe = async (run, tablaLegado, idLegado) => (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: tablaLegado, l: Number(idLegado) }))[0]?.id_nuevo;
const enAlcanceMA = async (leg, idTecnica) => (await leg.request().input('v', sql.Numeric(18, 0), Number(idTecnica)).query(`SELECT COUNT(*) AS n FROM App_Ma_ReferenciaAnalisis WHERE id_tecnica=@v`)).recordset[0].n > 0;

// Copia una técnica del legado (y lo que necesita: su tipo y su sección) a cat_tecnica. Devuelve el id nuevo.
async function copiarTecnica({ ctx, run, leg }, x) {
  const idL = Number(x.id_tecnica); const nombre = norm(x.nombre_tecnica);
  if (!nombre) throw new Error(`la técnica ${idL} no tiene nombre`);
  // tipo de técnica (texto)
  let idTipo = null; const tipoTxt = t(x.tipotecnica);
  if (tipoTxt) { idTipo = (await run(`SELECT TOP 1 id FROM cat_tipo_tecnica WHERE nombre=@n ORDER BY id`, { n: tipoTxt.slice(0, 100) }))[0]?.id ?? await insertar(run, 'cat_tipo_tecnica', { nombre: tipoTxt.slice(0, 100), grupo: t(x.grupotecnica)?.slice(0, 60) ?? undefined }); }
  // sección (se crea la primera vez que una técnica MA la referencia)
  let idSec = null;
  if (Number(x.id_seccion) > 0) {
    idSec = await idDe(run, 'mae_seccion', x.id_seccion);
    if (!idSec) {
      const s = await filaLegado(leg, 'mae_seccion', 'id_seccion', x.id_seccion);
      if (s) { idSec = await insertar(run, 'cat_seccion_laboratorio', { nombre: norm(s.nombre_seccion).slice(0, 100), centro_costo: t(x.centrocosto)?.slice(0, 20) ?? undefined }); await fijarMapa(run, 'mae_seccion', Number(x.id_seccion), 'cat_seccion_laboratorio', idSec); }
    }
  }
  const um = Number(x.id_umedida) > 0 ? (await mapa(ctx, run, 'mae_umedida')).get(Number(x.id_umedida)) ?? null : null;
  const tr = numOrNull(x.tiemporespuesta), costo = numOrNull(x.costo_tecnica);
  const obj = { nombre: nombre.slice(0, 200), id_tipo_tecnica: idTipo, id_seccion: idSec, tiempo_respuesta_hrs: tr != null ? Math.round(tr) : null, id_unidad_medida: um,
    metodologia: t(x.metodologia)?.slice(0, 200), costo_operativo_uf: costo && costo > 0 ? costo : null };
  return upsertMapeado(run, { tablaLegado: 'mae_tecnica', idLegado: idL, tabla: 'cat_tecnica', obj, buscarNatural: async () => (await run(`SELECT TOP 1 id FROM cat_tecnica WHERE nombre=@n`, { n: obj.nombre }))[0]?.id });
}

const seccion = {
  async upsert({ run, leg, clave }) {
    const s = await filaLegado(leg, 'mae_seccion', 'id_seccion', clave); if (!s) return 'SIN_FILA';
    const idNuevo = await idDe(run, 'mae_seccion', clave);
    if (idNuevo) await run(`UPDATE cat_seccion_laboratorio SET nombre=@n WHERE id=@i`, { n: norm(s.nombre_seccion).slice(0, 100), i: idNuevo });   // solo se actualiza si alguna técnica MA ya la usa
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_seccion', idLegado: Number(clave), tabla: 'cat_seccion_laboratorio' }),
};

// Lista base de precios (fac_): mae_tecnica.precio_lista > 0 → fac_lista_precio_tecnica; si el precio deja de ser > 0 se quita.
// La lista (fac_lista_precio) la crea el cargador de fac_; si aún no existe, no se hace nada.
async function precioLista(run, x, idTec) {
  const idLista = await idDe(run, 'mae_tecnica#precio_lista', 0); if (!idLista) return;
  const p = numOrNull(x.precio_lista); const idL = Number(x.id_tecnica);
  if (p != null && p > 0) await upsertMapeado(run, { tablaLegado: 'mae_tecnica#precio_lista', idLegado: idL, tabla: 'fac_lista_precio_tecnica', obj: { id_lista_precio: idLista, id_tecnica: idTec, precio_uf: p } });
  else await borrarMapeado(run, { tablaLegado: 'mae_tecnica#precio_lista', idLegado: idL, tabla: 'fac_lista_precio_tecnica' });
}

const tecnica = {
  async upsert(c) {
    const x = await filaLegado(c.leg, 'mae_tecnica', 'id_tecnica', c.clave); if (!x) return 'SIN_FILA';
    if (!(await enAlcanceMA(c.leg, c.clave))) return;   // técnica de Laboratorio (aún sin límites MA): fuera de alcance; si recibe límites, entra por su referencia
    const idTec = await copiarTecnica(c, x);
    await precioLista(c.run, x, idTec);
  },
  async borrar({ run, clave }) {
    await borrarMapeado(run, { tablaLegado: 'mae_tecnica#precio_lista', idLegado: Number(clave), tabla: 'fac_lista_precio_tecnica' });
    await borrarMapeado(run, { tablaLegado: 'mae_tecnica', idLegado: Number(clave), tabla: 'cat_tecnica' });
  },
};

const normativa = {
  async upsert({ run, leg, clave }) {
    const n = await filaLegado(leg, 'mae_Normativa', 'id_normativa', clave); if (!n) return 'SIN_FILA';
    const nombre = norm(n.nombre_normativa); if (placeholder(nombre)) return;
    await upsertMapeado(run, { tablaLegado: 'mae_Normativa', idLegado: Number(n.id_normativa), tabla: 'cat_normativa', obj: { nombre: nombre.slice(0, 100), habilitado: si(n.habilitado, true) },
      buscarNatural: async () => (await run(`SELECT TOP 1 id FROM cat_normativa WHERE nombre=@n`, { n: nombre.slice(0, 100) }))[0]?.id });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_Normativa', idLegado: Number(clave), tabla: 'cat_normativa' }),
};

const referencia = {
  async upsert({ run, leg, clave }) {
    const r = await filaLegado(leg, 'mae_NormativaReferencia', 'id_normativareferencia', clave); if (!r) return 'SIN_FILA';
    const nombre = norm(r.nombre_normativareferencia); if (placeholder(nombre)) return;
    const padre = await idDe(run, 'mae_Normativa', r.id_normativa);
    if (!padre) { const n = await filaLegado(leg, 'mae_Normativa', 'id_normativa', r.id_normativa); if (!n || placeholder(n.nombre_normativa)) return; throw new Error(`la normativa ${r.id_normativa} aún no existe en cat_normativa`); }
    await upsertMapeado(run, { tablaLegado: 'mae_NormativaReferencia', idLegado: Number(r.id_normativareferencia), tabla: 'cat_normativa_referencia', obj: { id_normativa: padre, nombre: nombre.slice(0, 150), habilitado: si(r.habilitado, true) },
      buscarNatural: async () => (await run(`SELECT TOP 1 id FROM cat_normativa_referencia WHERE id_normativa=@p AND nombre=@n`, { p: padre, n: nombre.slice(0, 150) }))[0]?.id });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_NormativaReferencia', idLegado: Number(clave), tabla: 'cat_normativa_referencia' }),
};

const limite = {
  async upsert(c) {
    const { run, leg, clave } = c;
    const r = await filaLegado(leg, 'App_Ma_ReferenciaAnalisis', 'id_referenciaanalisis', clave); if (!r) return 'SIN_FILA';
    // la técnica entra en alcance por tener límites: si aún no se copió, se copia ahora
    let tec = await idDe(run, 'mae_tecnica', r.id_tecnica);
    if (!tec) { const x = await filaLegado(leg, 'mae_tecnica', 'id_tecnica', r.id_tecnica); if (!x) throw new Error(`la técnica ${r.id_tecnica} no existe en el legado`); tec = await copiarTecnica(c, x); }
    const nor = await idDe(run, 'mae_Normativa', r.id_normativa), ref = await idDe(run, 'mae_NormativaReferencia', r.id_normativareferencia);
    if (!nor || !ref) {
      const n = await filaLegado(leg, 'mae_Normativa', 'id_normativa', r.id_normativa);
      if (!n || placeholder(n.nombre_normativa)) return;   // sin normativa válida: el cargador también lo omite
      throw new Error(`falta en cat_: normativa ${r.id_normativa}=${nor ?? 'no'} referencia ${r.id_normativareferencia}=${ref ?? 'no'}`);
    }
    const t0 = t(r.traduccion_0), t1 = t(r.traduccion_1);
    const obj = { id_tecnica: tec, id_normativa: nor, id_normativa_referencia: ref, limite_max_d: numOrNull(r.limitemax_d), limite_max_h: numOrNull(r.limitemax_h), lleva_error: si(r.llevaerror), error_min: numOrNull(r.error_min), error_max: numOrNull(r.error_max),
      lleva_traduccion: si(r.llevatraduccion), traduccion_0: t0?.slice(0, 60) ?? null, traduccion_1: t1?.slice(0, 60) ?? null, marca: r.marca === true || r.marca === 1, habilitado: si(r.habilitado, true) };
    await upsertMapeado(run, { tablaLegado: 'App_Ma_ReferenciaAnalisis', idLegado: Number(r.id_referenciaanalisis), tabla: 'cat_referencia_analisis', obj,
      buscarNatural: async () => (await run(`SELECT TOP 1 id FROM cat_referencia_analisis WHERE id_tecnica=@t AND id_normativa=@n AND id_normativa_referencia=@r`, { t: tec, n: nor, r: ref }))[0]?.id });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'App_Ma_ReferenciaAnalisis', idLegado: Number(clave), tabla: 'cat_referencia_analisis' }),
};

export const manejadores = { mae_seccion: seccion, mae_tecnica: tecnica, mae_Normativa: normativa, mae_NormativaReferencia: referencia, App_Ma_ReferenciaAnalisis: limite };
