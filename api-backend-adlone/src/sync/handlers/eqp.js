// Manejadores del módulo eqp_ (equipos). Mismas reglas que scripts/migracion-eqp.mjs, por fila:
//   - custodia: una persona (per_persona) O un lugar de guardado (las "sedes" del legado), nunca ambos;
//   - estado: los 5 reales del legado; sin estado o desconocido → Operativo;
//   - código repetido: la 2.ª fila queda "código#id" y el par va a revision_duplicado (EQP_EQUIPO);
//   - historial: las versiones anteriores del legado + una línea base de la versión VIGENTE (el legado no la guarda).
import { norm, t, si, numero, soloFecha, upsertMapeado, borrarMapeado, actualizar, asegurarMapa } from '../comun.js';
import { mapa, filaLegado } from './contexto.js';
import { fotoEquipo } from '../datos/equipoHistorial.js';

const ESTADOS = ['Operativo', 'Dado de Baja', 'En Mantención', 'En Calibración', 'Fuera de Servicio'];
const corto = (s, n, k) => { const x = t(s); if (x && x.length > n) throw new Error(`${k} excede ${n} caracteres`); return x; };
const entero = (v) => { const n = numero(v); return n != null ? Math.round(n) : null; };

const catalogo = {
  async upsert({ run, leg, clave }) {
    const c = await filaLegado(leg, 'mae_equipo_catalogo', 'id_equipocatalogo', clave); if (!c) return 'SIN_FILA';
    const nombre = norm(c.nombre).slice(0, 150);
    await upsertMapeado(run, { tablaLegado: 'mae_equipo_catalogo', idLegado: Number(c.id_equipocatalogo), tabla: 'eqp_catalogo',
      obj: { nombre, que_mide: corto(c.que_mide, 150, 'que_mide'), unidad_medida_texto: corto(c.unidad_medida_textual, 200, 'unidad'), unidad_medida_sigla: corto(c.unidad_medida_sigla, 50, 'sigla'), tipo_equipo: corto(c.tipo_equipo, 80, 'tipo_equipo') },
      buscarNatural: async () => (await run(`SELECT TOP 1 id FROM eqp_catalogo WHERE nombre=@n`, { n: nombre }))[0]?.id });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_equipo_catalogo', idLegado: Number(clave), tabla: 'eqp_catalogo' }),
};

// Línea base de la versión vigente: el historial del legado solo guarda las versiones ANTERIORES.
async function asegurarLineaBase(ctx, run, idEquipo, idLegado, e, estado) {
  const v = (t(e.version) || 'v1').slice(0, 10);
  const existente = (await run(`SELECT id FROM eqp_historial WHERE id_equipo=@e AND version=@v`, { e: idEquipo, v }))[0];
  const cols = { id_equipo: idEquipo, version: v, codigo: (norm(e.codigo) || 'S/C').slice(0, 60), sigla: t(e.sigla)?.slice(0, 20), correlativo: entero(e.correlativo), nombre: (norm(e.nombre) || 'S/N').slice(0, 150), sede: t(e.sede),
    tiene_factor_correccion: si(e.tienefc), error_0: numero(e.error0), error_15: numero(e.error15), error_30: numero(e.error30), ultima_verificacion: soloFecha(e.Ultima_verificacion), siguiente_verificacion: soloFecha(e.Siguiente_verificacion),
    estado, motivo: 'Línea base: versión vigente al migrar (el historial legado solo guarda las versiones anteriores)', ...fotoEquipo(e, await mapa(ctx, run, 'mae_muestreador'), await mapa(ctx, run, 'mae_muestreador#sede')) };
  if (existente) {   // ya hay una fila de esa versión: si es la línea base (no una fila real del legado) se mantiene al día con el equipo
    if (!(await run(`SELECT 1 x FROM mig_id_map WHERE tabla_legado='mae_equipo#vigente' AND id_legado=@l AND id_nuevo=@i`, { l: idLegado, i: existente.id })).length) return;
    const f = fotoEquipo(e, await mapa(ctx, run, 'mae_muestreador'), await mapa(ctx, run, 'mae_muestreador#sede')); const ef = Object.entries(f);
    await run(`UPDATE eqp_historial SET ${ef.map(([k], i) => `[${k}]=@p${i}`).join(', ')} WHERE id=@id`, { ...Object.fromEntries(ef.map(([, x], i) => [`p${i}`, x])), id: existente.id });
    return;
  }
  const ent = Object.entries(cols).filter(([, x]) => x !== undefined); const p = Object.fromEntries(ent.map(([, x], i) => [`p${i}`, x]));
  const id = (await run(`DECLARE @o TABLE (id INT); INSERT INTO eqp_historial (${ent.map(([k]) => `[${k}]`).join(',')}) OUTPUT INSERTED.id INTO @o VALUES (${ent.map((_, i) => `@p${i}`).join(',')}); SELECT id FROM @o;`, p))[0].id;
  await asegurarMapa(run, 'mae_equipo#vigente', idLegado, 'eqp_historial', id, `versión vigente ${v}`);
}

const equipo = {
  async upsert({ ctx, run, leg, clave }) {
    const e = await filaLegado(leg, 'mae_equipo', 'id_equipo', clave); if (!e) return 'SIN_FILA'; const idL = Number(e.id_equipo);
    const cat = (await mapa(ctx, run, 'mae_equipo_catalogo')).get(Number(e.id_equipocatalogo)); if (!cat) throw new Error(`el catálogo ${e.id_equipocatalogo} aún no existe en eqp_catalogo`);
    // código: si otra fila ya lo usa, esta queda "código#id" y el par se manda a revisión
    const base = norm(e.codigo) || `EQ-${idL}`; let cod = base;
    const previo = (await run(`SELECT id FROM eqp_equipo e WHERE EXISTS (SELECT 1 FROM mig_id_map m WHERE m.tabla_legado='mae_equipo' AND m.id_legado=@l AND m.id_nuevo=e.id)`, { l: idL }))[0];
    const otro = (await run(`SELECT TOP 1 id FROM eqp_equipo WHERE codigo=@c ${previo ? 'AND id<>@p' : ''}`, { c: base, p: previo?.id ?? 0 }))[0];
    if (otro) cod = `${base}#${idL}`;
    if (cod.length > 60) throw new Error(`el código de ${idL} supera 60 caracteres`);
    let estado = norm(e.Estado); if (!ESTADOS.includes(estado)) estado = 'Operativo';
    const idMue = Number(e.id_muestreador); const persona = (await mapa(ctx, run, 'mae_muestreador')).get(idMue) ?? null;
    const lugar = persona ? null : ((await mapa(ctx, run, 'mae_muestreador#sede')).get(idMue) ?? null);
    const sede = t(e.sede); if (sede && sede.length > 10) throw new Error(`la sede "${sede}" supera 10 caracteres`);
    const obj = { id_equipo_catalogo: cat, codigo: cod, sigla: t(e.sigla)?.slice(0, 20), correlativo: entero(e.correlativo), nombre: (norm(e.nombre) || cod).slice(0, 150), sede, id_persona_responsable: persona, id_lugar_guardado: lugar,
      error_0: numero(e.error0), error_15: numero(e.error15), error_30: numero(e.error30), tiene_factor_correccion: si(e.tienefc), es_fijo: si(e.es_fijo), aparece_en_informe: si(e.informe),
      ultima_verificacion: soloFecha(e.Ultima_verificacion), siguiente_verificacion: soloFecha(e.Siguiente_verificacion), fecha_vigencia: soloFecha(e.fecha_vigencia),
      plazo_vigencia: corto(e.Plazo_Vigencia, 500, 'plazo_vigencia'), equipo_asociado: corto(e.equipo_asociado, 200, 'equipo_asociado'), observacion: corto(e.observacion, 1000, 'observacion'),
      estado, habilitado: si(e.habilitado), visible_muestreador: si(e.visible_muestreador, true), version: (t(e.version) || 'v1').slice(0, 10), esta_ocupado: si(e.esta_ocupado) };
    // El legado guarda el correlativo de la visita que tiene instalado un equipo fijo; el esquema nuevo lo enlaza a la visita (NULL si la visita aún no existe:
    // fic_visita se sincroniza después y, al crearse, completa este enlace — ver handlers/fic.js).
    const ocupadoPor = t(e.ocupado_por_frecuencia); obj.id_visita_ocupado = ocupadoPor ? (await run('SELECT id FROM fic_visita WHERE correlativo_legacy=@c', { c: ocupadoPor }))[0]?.id ?? null : null;
    const idNuevo = await upsertMapeado(run, { tablaLegado: 'mae_equipo', idLegado: idL, tabla: 'eqp_equipo', obj, buscarNatural: async () => (await run(`SELECT TOP 1 id FROM eqp_equipo WHERE codigo=@c`, { c: cod }))[0]?.id });
    if (otro && !(await run(`SELECT 1 x FROM revision_duplicado WHERE entidad='EQP_EQUIPO' AND ((id_registro_a=@a AND id_registro_b=@b) OR (id_registro_a=@b AND id_registro_b=@a))`, { a: otro.id, b: idNuevo })).length)
      await run(`INSERT INTO revision_duplicado (entidad, id_registro_a, id_registro_b, criterio, detalle_json, observacion) VALUES ('EQP_EQUIPO', @a, @b, 'MISMO_CODIGO', @j, N'Mismo código en dos equipos; el segundo se cargó con sufijo #id')`,
        { a: otro.id, b: idNuevo, j: JSON.stringify({ legado_b: idL, codigo: base }) });
    await asegurarLineaBase(ctx, run, idNuevo, idL, e, estado);
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_equipo', idLegado: Number(clave), tabla: 'eqp_equipo' }),
};

const historial = {
  async upsert({ ctx, run, leg, clave }) {
    const h = await filaLegado(leg, 'mae_equipo_historial', 'id_historial', clave); if (!h) return 'SIN_FILA';
    const eq = (await mapa(ctx, run, 'mae_equipo')).get(Number(h.id_equipo)); if (!eq) throw new Error(`el equipo ${h.id_equipo} aún no existe en eqp_equipo`);
    const version = t(h.version)?.slice(0, 10);
    const obj = { id_equipo: eq, version, codigo: (norm(h.codigo) || 'S/C').slice(0, 60), sigla: t(h.sigla)?.slice(0, 20), correlativo: entero(h.correlativo), nombre: (norm(h.nombre) || 'S/N').slice(0, 150), sede: t(h.sede),
      tiene_factor_correccion: si(h.tienefc), error_0: numero(h.error0), error_15: numero(h.error15), error_30: numero(h.error30), ultima_verificacion: soloFecha(h.Ultima_verificacion), siguiente_verificacion: soloFecha(h.Siguiente_verificacion),
      estado: (t(h.Estado) || 'Operativo').slice(0, 30), fecha_cambio: h.fecha_cambio instanceof Date ? h.fecha_cambio : undefined, motivo: t(h.observacion)?.slice(0, 300),
      ...fotoEquipo(h, await mapa(ctx, run, 'mae_muestreador'), await mapa(ctx, run, 'mae_muestreador#sede')), id_usuario_cambio: Number(h.usuario_cambio) > 0 ? (await mapa(ctx, run, 'mae_usuario#usr')).get(Number(h.usuario_cambio)) ?? null : null };
    const id = await upsertMapeado(run, { tablaLegado: 'mae_equipo_historial', idLegado: Number(h.id_historial), tabla: 'eqp_historial', obj,
      buscarNatural: async () => (await run(`SELECT TOP 1 id FROM eqp_historial WHERE id_equipo=@e AND version=@v`, { e: eq, v: version }))[0]?.id });   // p. ej. la línea base que ahora el legado ya registró
    await run(`DELETE FROM mig_id_map WHERE tabla_legado='mae_equipo#vigente' AND id_nuevo=@i`, { i: id });   // la línea base pasó a ser una fila del historial real
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_equipo_historial', idLegado: Number(clave), tabla: 'eqp_historial' }),
};

export const manejadores = { mae_equipo_catalogo: catalogo, mae_equipo: equipo, mae_equipo_historial: historial };
