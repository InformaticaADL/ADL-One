// Manejadores del módulo fic_ (fichas, análisis, visitas, procesos, mediciones, resultados y uso de equipos).
// Mismas reglas que scripts/migracion-fic.mjs. Unidades de cambio:
//   ENC (fila)            → fic_ficha              (equivalencia en mig_id_map: 'App_Ma_FichaIngresoServicio_ENC')
//   Agenda_MUESTREOS (fila) → fic_visita + fic_visita_proceso + fic_visita_medicion   (equivalencia: fic_visita.id_agendamam_legacy)
//   DET / Resultados / Equipos_MUESTREOS (grupo: todas las filas de una ficha; el legado no tiene PK)
//                          → fic_ficha_analisis (clave natural ficha+item), fic_resultado (visita+análisis), eqp_uso (se rehace por ficha)
// Los triggers del esquema nuevo cierran informes y cambian el estado de la ficha al escribir resultados; igual que el cargador, tras
// cada unidad se restauran informe_emitido_en y id_estado_ficha a lo que dice el legado (el legado manda hasta el corte).
import sql from 'mssql';
import { norm, t, raw, dt, numero, upsertMapeado, borrarMapeado, asegurarMapa } from '../comun.js';
import { mapa, nombres } from './contexto.js';
import { asegurarComponente } from './ficcat.js';
import { versionCitada } from '../datos/equipoHistorial.js';

const PLACEHOLDER_SUP = 1002;   // "Sin supervisión"
const ESTADO_FICHA = { 1: 'APROBADA_TECNICA', 2: 'RECHAZADA_TECNICA', 3: 'PENDIENTE_TECNICA', 4: 'RECHAZADA_COORDINACION', 5: 'EN_PROCESO', 6: 'PENDIENTE_PROGRAMACION', 7: 'CANCELADO', 8: 'CICLO_FINALIZADO' };
const ESTADO_VISITA = { 0: 'POR_ASIGNAR', 1: 'PENDIENTE', 3: 'EJECUTADO', 4: 'SUSPENDIDO_ADL', 5: 'SUSPENDIDO_TERRENO', 6: 'CANCELADO_ADL', 7: 'CANCELADO_TERRENO' };
const MAP_ENC = 'App_Ma_FichaIngresoServicio_ENC';

const num = numero;
const sn = (v) => (v == null || String(v).trim() === '' ? null : /^(S|SI|1|TRUE)$/i.test(String(v).trim()));
const yes = (v, def = true) => { const b = sn(v); return b == null ? def : b; };
const dateOnly = (d) => (d instanceof Date && d.getUTCFullYear() > 1900 && d.getUTCFullYear() !== 1999 ? d : null);
const combine = (d, h) => {
  if (!(d instanceof Date) || d.getUTCFullYear() <= 1900 || d.getUTCFullYear() === 1999) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(h ?? '').trim());
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), m ? +m[1] : 0, m ? +m[2] : 0, m && m[3] ? +m[3] : 0));
};
const sinUndef = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === undefined ? null : v]));   // en un UPDATE, "vacío" limpia la columna
const fichaLeg = (cadena) => Number(cadena);
const legado = async (leg, consulta, params = {}) => { const r = leg.request(); for (const [k, v] of Object.entries(params)) r.input(k, sql.Numeric(18, 0), Number(v)); return (await r.query(consulta)).recordset; };

/* ---------- catálogos y mapas (una vez por pasada) ---------- */
async function base(ctx, run) {
  if (ctx.fic) return ctx.fic;
  const B = {}; B.CT = {};
  for (const [k, tl] of Object.entries({ lugar: 'mae_lugaranalisis', obj: 'mae_objetivomuestreo_ma', tmuestreo: 'mae_tipomuestreo', tmuestra: 'mae_tipomuestra_ma', comp: 'mae_tipomuestra', sub: 'mae_subarea', act: 'mae_actividadmuestreo',
    desc: 'mae_tipodescarga', modal: 'mae_modalidad', forma: 'mae_formacanal', disp: 'mae_dispositivohidraulico', um: 'mae_umedida', cargo: 'mae_cargo', jef: 'mae_jefaturatecnica' })) B.CT[k] = await mapa(ctx, run, tl);
  B.emp = await mapa(ctx, run, 'mae_empresa'); B.srv = await mapa(ctx, run, 'mae_empresaservicios'); B.cen = await mapa(ctx, run, 'mae_centro'); B.con = await mapa(ctx, run, 'mae_contacto');
  B.tec = await mapa(ctx, run, 'mae_tecnica'); B.ra = await mapa(ctx, run, 'App_Ma_ReferenciaAnalisis'); B.eq = await mapa(ctx, run, 'mae_equipo'); B.pers = await mapa(ctx, run, 'mae_muestreador');
  B.insp = await mapa(ctx, run, 'mae_inspectorambiental'); B.usr = await mapa(ctx, run, 'mae_usuario#usr'); B.tipoagua = await mapa(ctx, run, 'mae_tipoagua');
  B.usrNom = await nombres(ctx, run, 'usr_usuario'); B.cargoNom = await nombres(ctx, run, 'per_cargo'); B.persNom = await nombres(ctx, run, 'per_persona');
  B.zona = new Map((await run(`SELECT id, nombre FROM geo_zona_utm`)).map((r) => [String(r.nombre).trim().toUpperCase(), r.id]));
  B.estF = Object.fromEntries((await run(`SELECT id, codigo FROM fic_estado_ficha`)).map((r) => [r.codigo, r.id]));
  B.estV = Object.fromEntries((await run(`SELECT id, codigo FROM fic_estado_visita`)).map((r) => [r.codigo, r.id]));
  B.instrumentos = (await run(`SELECT id, nombre FROM fic_instrumento_ambiental`)).sort((a, b) => b.nombre.length - a.nombre.length); B.idOtro = B.instrumentos.find((i) => /^otro$/i.test(i.nombre))?.id;
  B.hist = new Map(); B.histUlt = new Map();
  const inv = new Map([...B.eq].map(([l, n]) => [n, l]));
  for (const r of await run(`SELECT id, id_equipo, version FROM eqp_historial`)) { const l = inv.get(r.id_equipo); if (l != null) B.hist.set(`${l}|${r.version}`, r.id); }
  ctx.fic = B; return B;
}
const P = (B, v) => { const n = Number(v); return n > 0 && n !== PLACEHOLDER_SUP ? B.pers.get(n) ?? null : null; };
const NP = (B, v) => { const n = Number(v); const id = n > 0 ? B.pers.get(n) : null; return id ? B.persNom.get(id) ?? null : null; };
// Valor de catálogo de la ficha: si el legado cita uno que no está en el mapa se encola un error (no se pierde en silencio).
const M = (mapaCat, v, etiqueta) => { if (v == null || norm(v) === '') return null; const n = Number(v); if (!(n >= 0)) return null; const r = mapaCat.get(n); if (r == null && n > 0) throw new Error(`${etiqueta} ${n} sin equivalente en la base nueva`); return r; };
function instrumento(B, texto) {
  const x = norm(texto); if (!x) return {};
  const c = B.instrumentos.find((i) => x.toLowerCase() === i.nombre.toLowerCase() || x.toLowerCase().startsWith(i.nombre.toLowerCase() + ' '));
  if (c) { const resto = x.slice(c.nombre.length).trim(); const m = /^(.*?)\/(\d{4})$/.exec(resto); return { id: c.id, numero: (m ? m[1].trim() : resto) || undefined, anio: m ? m[2] : undefined }; }
  const y = /\b(\d{4})$/.exec(x); return { id: B.idOtro, numero: x.slice(0, 50), anio: y ? y[1] : undefined };
}
// Frecuencia, laboratorio y tipo de entrega: el cargador los creó por nombre y no dejó equivalencia; se resuelven (o crean) por nombre.
async function porNombre(ctx, run, leg, { cache, tablaLegado, col, tabla, nombreLeg, extra }, idLeg) {
  const n = Number(idLeg); if (!(n > 0)) return null;
  ctx.fic[cache] ??= new Map(); if (ctx.fic[cache].has(n)) return ctx.fic[cache].get(n);
  const mapeado = (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: tablaLegado, l: n }))[0]?.id_nuevo;   // catálogo ya sincronizado con su id
  if (mapeado) { ctx.fic[cache].set(n, mapeado); return mapeado; }
  const f = (await legado(leg, `SELECT * FROM ${tablaLegado} WHERE ${col}=@v`, { v: n }))[0]; if (!f) throw new Error(`${tablaLegado} ${n} no existe en el legado`);
  const nombre = t(f[nombreLeg]) || `${tabla} ${n}`;
  let id = (await run(`SELECT TOP 1 id FROM ${tabla} WHERE LOWER(nombre)=LOWER(@n) ORDER BY id`, { n: nombre }))[0]?.id;
  if (!id) { const e = Object.entries({ nombre, ...extra(f) }).filter(([, v]) => v !== undefined); id = (await run(`DECLARE @o TABLE (id INT); INSERT INTO ${tabla} (${e.map(([k]) => `[${k}]`).join(',')}) OUTPUT INSERTED.id INTO @o VALUES (${e.map((_, i) => `@p${i}`).join(',')}); SELECT id FROM @o;`, Object.fromEntries(e.map(([, v], i) => [`p${i}`, v]))))[0].id; }
  await asegurarMapa(run, tablaLegado, n, tabla, id);
  ctx.fic[cache].set(n, id); return id;
}
const frecuencia = (ctx, run, leg, id) => porNombre(ctx, run, leg, { cache: 'fr', tablaLegado: 'mae_frecuencia', col: 'id_frecuencia', tabla: 'fic_frecuencia', nombreLeg: 'nombre_frecuencia',
  extra: (f) => ({ orden: num(f.orden), multiplicador_anual: num(f.multiplicadopor), dias: num(f.dias), habilitado: yes(f.habilitado) }) }, id);
const laboratorio = (ctx, run, leg, id) => porNombre(ctx, run, leg, { cache: 'lab', tablaLegado: 'mae_laboratorioensayo', col: 'id_laboratorioensayo', tabla: 'fic_laboratorio_ensayo', nombreLeg: 'nombre_laboratorioensayo',
  extra: (f) => ({ es_etfa: yes(f.etfa, false), email: t(f.correo_electronico), habilitado: yes(f.habilitado) }) }, id);
const tipoEntrega = (ctx, run, leg, id) => porNombre(ctx, run, leg, { cache: 'ent', tablaLegado: 'mae_tipoentrega', col: 'id_tipoentrega', tabla: 'fic_tipo_entrega', nombreLeg: 'nombre_tipoentrega', extra: (f) => ({ habilitado: yes(f.habilitado) }) }, id);

const fichaNueva = async (ctx, run, fid) => (await mapa(ctx, run, MAP_ENC)).get(Number(fid)) ?? (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: MAP_ENC, l: Number(fid) }))[0]?.id_nuevo;
const exigirFicha = async (ctx, run, fid) => { const id = await fichaNueva(ctx, run, fid); if (!id) throw new Error(`la ficha ${fid} aún no existe en la base nueva`); return id; };

// Restaura lo que los triggers pudieron modificar: informe_emitido_en de las visitas y estado de la ficha, según el legado.
async function restaurar({ ctx, run, leg }, fid) {
  const B = await base(ctx, run); const fnueva = await fichaNueva(ctx, run, fid); if (!fnueva) return;
  const enc = (await legado(leg, `SELECT id_validaciontecnica FROM ${MAP_ENC} WHERE id_fichaingresoservicio=@v`, { v: fid }))[0]; if (!enc) return;
  for (const a of await legado(leg, `SELECT id_agendamam, informe_emitido, fecha_informe_emitido FROM App_Ma_Agenda_MUESTREOS WHERE id_fichaingresoservicio=@v`, { v: fid })) {
    const v = (await run(`SELECT id, informe_emitido_en FROM fic_visita WHERE id_agendamam_legacy=@a`, { a: Number(a.id_agendamam) }))[0]; if (!v) continue;
    const emitido = String(a.informe_emitido).trim() === 'S'; const nuevo = emitido ? (a.fecha_informe_emitido instanceof Date ? a.fecha_informe_emitido : v.informe_emitido_en ?? new Date()) : null;
    const dif = (nuevo == null) !== (v.informe_emitido_en == null) || (nuevo && v.informe_emitido_en && Math.abs(new Date(nuevo) - new Date(v.informe_emitido_en)) > 4);
    if (dif) await run(`UPDATE fic_visita SET informe_emitido_en=@f WHERE id=@i`, { i: v.id, f: nuevo });
  }
  const est = B.estF[ESTADO_FICHA[Number(enc.id_validaciontecnica)]] ?? B.estF.PENDIENTE_TECNICA;
  await run(`UPDATE fic_ficha SET id_estado_ficha=@e WHERE id=@i AND id_estado_ficha<>@e`, { e: est, i: fnueva });
}

/* ---------- ficha ---------- */
async function datosDeAgenda({ ctx, run, leg }, fid) {   // frecuencia e inspector de la ficha: los da su primera agenda
  const B = await base(ctx, run); const a0 = (await legado(leg, `SELECT TOP 1 * FROM App_Ma_Agenda_MUESTREOS WHERE id_fichaingresoservicio=@v ORDER BY id_agendamam`, { v: fid }))[0] || {};
  return { id_frecuencia: await frecuencia(ctx, run, leg, a0.id_frecuencia), cantidad_frecuencia: num(a0.frecuencia), factor_frecuencia: num(a0.frecuencia_factor), total_servicios: num(a0.total_servicios), id_persona_inspector: B.insp.get(Number(a0.id_inspectorambiental)) ?? null };
}

const ficha = {
  async upsert(c) {
    const { ctx, run, leg, clave } = c; const B = await base(ctx, run); const fid = Number(clave);
    const f = (await legado(leg, `SELECT * FROM ${MAP_ENC} WHERE id_fichaingresoservicio=@v`, { v: fid }))[0]; if (!f) return 'SIN_FILA';
    const one = async (tabla, col, v) => (Number(v) > 0 ? (await legado(leg, `SELECT * FROM ${tabla} WHERE ${col}=@v`, { v }))[0] : undefined);
    const emp = await one('mae_empresa', 'id_empresa', f.id_empresa), srv = await one('mae_empresaservicios', 'id_empresaservicio', f.id_empresaservicio);
    const cen = await one('mae_centro', 'id_centro', f.id_centro), con = await one('mae_contacto', 'id_contacto', f.id_contacto);
    const costo = (await legado(leg, `SELECT TOP 1 uf_individual FROM App_Ma_FichaIngresoServicio_DET WHERE id_fichaingresoservicio=@v AND tipo_analisis='CostoOperativo'`, { v: fid }))[0];
    if (Number(f.id_tipomuestra) > 0 && !B.CT.comp.get(Number(f.id_tipomuestra))) B.CT.comp.set(Number(f.id_tipomuestra), await asegurarComponente(c, Number(f.id_tipomuestra)));   // componente aún no copiado
    const cod = ESTADO_FICHA[Number(f.id_validaciontecnica)]; const ins_ = instrumento(B, f.instrumento_ambiental); const dur = num(f.ma_duracion_muestreo);
    const zona = /^(\d{2}[A-Za-z])\b/.exec(norm(f.ma_coordenadas)); const idZona = zona ? B.zona.get(zona[1].toUpperCase()) ?? null : null; if (zona && !idZona) throw new Error(`zona UTM ${zona[1]} sin equivalente en geo_`);
    const cargoNuevo = M(B.CT.cargo, f.id_cargo, 'cargo de la ficha'); const usu = Number(f.id_usuario) > 0 ? B.usr.get(Number(f.id_usuario)) : null; if (Number(f.id_usuario) > 0 && !usu) throw new Error(`usuario creador ${f.id_usuario} sin equivalente en usr_`);
    const obj = sinUndef({
      tipo: t(f.tipo_fichaingresoservicio), id_empresa: B.emp.get(Number(f.id_empresa)), id_empresa_servicio: B.srv.get(Number(f.id_empresaservicio)), id_centro: B.cen.get(Number(f.id_centro)) ?? null, id_contacto: B.con.get(Number(f.id_contacto)) ?? null,
      id_lugar_analisis: M(B.CT.lugar, f.id_lugaranalisis, 'lugar de análisis'), id_objetivo_muestreo: M(B.CT.obj, f.id_objetivomuestreo_ma, 'objetivo de muestreo'), id_instrumento_ambiental: ins_.id ?? null,
      numero_instrumento: ins_.numero ?? null, anio_instrumento: ins_.anio ?? null, id_tipo_muestreo: M(B.CT.tmuestreo, f.id_tipomuestreo, 'tipo de muestreo'), id_tipo_muestra: M(B.CT.tmuestra, f.id_tipomuestra_ma, 'tipo de muestra'),
      id_componente: M(B.CT.comp, f.id_tipomuestra, 'componente'), id_subarea: M(B.CT.sub, f.id_subarea, 'subárea'), id_actividad_muestreo: M(B.CT.act, f.id_actividadmuestreo, 'actividad de muestreo'), id_tipo_descarga: M(B.CT.desc, f.id_tipodescarga, 'tipo de descarga'),
      id_modalidad_caudal: M(B.CT.modal, f.id_modalidad, 'modalidad de caudal'), id_forma_canal: M(B.CT.forma, f.id_formacanal, 'forma de canal'), id_dispositivo_hidraulico: M(B.CT.disp, f.id_dispositivohidraulico, 'dispositivo hidráulico'),
      id_um_formacanal: M(B.CT.um, f.id_um_formacanal, 'unidad de forma de canal'), id_um_dispositivo: M(B.CT.um, f.id_um_dispositivohidraulico, 'unidad de dispositivo'),
      id_zona_utm: idZona, coordenadas_utm: t(f.ma_coordenadas), ubicacion: t(f.ubicacion),
      id_cargo_responsable: cargoNuevo, snap_nombre_cargo_responsable: cargoNuevo ? B.cargoNom.get(cargoNuevo) ?? null : null, id_persona_jefatura_tecnica: M(B.CT.jef, f.id_jefaturatecnica, 'jefatura técnica'),
      ...(await datosDeAgenda(c, fid)),
      snap_nombre_empresa: t(emp?.nombre_empresa), snap_rut_empresa: t(emp?.rut_empresa), snap_rlegal_nombre: t(emp?.rlegal_nombre), snap_rlegal_rut: t(emp?.rlegal_rut),
      snap_nombre_empresa_servicio: t(srv?.nombre_empresaservicios), snap_nombre_centro: t(cen?.nombre_centro), snap_nombre_contacto: t(con?.nombre_contacto), snap_email_contacto: t(con?.email_contacto),
      snap_nombre_persona_responsable: t(f.responsablemuestreo), snap_costo_operativo_uf: num(costo?.uf_individual),
      nombre_tabla: t(f.nombre_tabla_largo), es_etfa: yes(f.etfa, false), punto_muestreo: t(f.ma_punto_muestreo), duracion_muestreo_hrs: dur != null ? Math.round(dur) : null, referencia_googlemaps: t(f.referencia_googlemaps),
      ubicacion_lat: num(f.ubicacion_lat), ubicacion_lon: num(f.ubicacion_lon), medicion_caudal: t(f.medicion_caudal), formacanal_medida: t(f.formacanal_medida), dispositivo_medida: t(f.dispositivohidraulico_medida),
      id_estado_ficha: B.estF[cod] ?? B.estF.PENDIENTE_TECNICA, es_remuestreo: f.es_remuestreo === true || f.es_remuestreo === 1,
      observaciones_comercial: t(f.observaciones_comercial)?.slice(0, 300), observaciones_tecnica: t(f.observaciones_jefaturatecnica)?.slice(0, 300), observaciones_coordinacion: t(f.observaciones_coordinador)?.slice(0, 300),
      id_usuario_creador: usu ?? null, fecha_ficha_comercial: combine(f.fecha_fichacomercial, f.hora_fichacomercial), fecha_jefatura_tecnica: combine(f.fecha_jefaturatecnica, f.hora_jefaturatecnica), id_cotizacion: num(f.id_cotizacion) || null });
    if (obj.id_empresa == null || obj.id_empresa_servicio == null) throw new Error(`la ficha ${fid} cita empresa ${f.id_empresa} / servicio ${f.id_empresaservicio} sin equivalente en cli_`);
    const id = await upsertMapeado(run, { tablaLegado: MAP_ENC, idLegado: fid, tabla: 'fic_ficha', obj });
    // ficha original (esta cita a otra) y fichas que citan a esta
    const orig = Number(f.id_ficha_original) > 0 ? await fichaNueva(ctx, run, f.id_ficha_original) : null;
    await run(`UPDATE fic_ficha SET id_ficha_original=@o WHERE id=@i`, { o: orig ?? null, i: id });
    for (const h of await legado(leg, `SELECT id_fichaingresoservicio FROM ${MAP_ENC} WHERE id_ficha_original=@v`, { v: fid })) { const hn = await fichaNueva(ctx, run, h.id_fichaingresoservicio); if (hn) await run(`UPDATE fic_ficha SET id_ficha_original=@o WHERE id=@i`, { o: id, i: hn }); }
    await restaurar(c, fid);
  },
  async borrar({ ctx, run, clave }) {
    const id = await fichaNueva(ctx, run, clave); if (!id) return;
    await run(`DELETE FROM eqp_uso WHERE id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@i)`, { i: id });
    await run(`DELETE FROM fic_resultado WHERE id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@i)`, { i: id });
    await run(`DELETE FROM fic_visita_medicion WHERE id_proceso IN (SELECT p.id FROM fic_visita_proceso p JOIN fic_visita v ON v.id=p.id_visita WHERE v.id_ficha=@i)`, { i: id });
    // los documentos enviados (fila, no grupo) se sincronizan por su propio id: se borran también su equivalencia y su huella para que reaparezcan si la ficha vuelve
    const docs = (await run(`SELECT m.id_legado FROM fic_visita_documento d JOIN mig_id_map m ON m.id_nuevo=d.id AND m.tabla_legado='App_Ma_Documentos_Enviados' WHERE d.id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@i)`, { i: id })).map((d) => Number(d.id_legado));
    for (const dl of docs) { await run(`DELETE FROM mig_id_map WHERE tabla_legado='App_Ma_Documentos_Enviados' AND id_legado=@l`, { l: dl }); await run(`DELETE FROM mig_sync_huella WHERE tabla_legado='App_Ma_Documentos_Enviados' AND clave=@c`, { c: String(dl) }); }
    for (const tb of ['fic_visita_proceso', 'fic_visita_evento', 'fic_visita_documento']) await run(`DELETE FROM ${tb} WHERE id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@i)`, { i: id });
    // eqp_equipo.id_visita_ocupado es un puntero de estado ("ocupado por esta visita"),
    // no una fila hija: el equipo sobrevive al borrado de la visita, solo se libera.
    await run(`UPDATE eqp_equipo SET id_visita_ocupado=NULL WHERE id_visita_ocupado IN (SELECT id FROM fic_visita WHERE id_ficha=@i)`, { i: id });
    await run(`DELETE FROM eqp_reserva WHERE id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@i)`, { i: id });
    await run(`DELETE FROM fic_visita WHERE id_ficha=@i`, { i: id }); await run(`DELETE FROM fic_ficha_analisis WHERE id_ficha=@i`, { i: id });
    // El historial es la bitácora de la propia ficha: se va con ella. Faltaba acá, y era
    // la causa de los 12 errores "DELETE conflicted with REFERENCE constraint
    // FK__fic_ficha__id_fi__…" que dejaban las fichas sin migrar.
    await run(`DELETE FROM fic_ficha_historial WHERE id_ficha=@i`, { i: id });
    // Remuestreos: otra ficha puede apuntar a ésta como original (autorreferencia). Se
    // suelta el puntero en vez de arrastrar la ficha hija al borrado.
    await run(`UPDATE fic_ficha SET id_ficha_original=NULL WHERE id_ficha_original=@i`, { i: id });
    await run(`DELETE FROM fic_ficha WHERE id=@i`, { i: id }); await run(`DELETE FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: MAP_ENC, l: Number(clave) });
  },
};

/* ---------- análisis (grupo por ficha) ---------- */
const analisis = {
  async upsert(c) {
    const { ctx, run, leg, clave } = c; const B = await base(ctx, run); const fid = Number(clave);
    const fnueva = await fichaNueva(ctx, run, fid); if (!fnueva) { if (!(await legado(leg, `SELECT 1 x FROM ${MAP_ENC} WHERE id_fichaingresoservicio=@v`, { v: fid })).length) return; throw new Error(`la ficha ${fid} aún no existe en la base nueva`); }
    const dets = await legado(leg, `SELECT * FROM App_Ma_FichaIngresoServicio_DET WHERE id_fichaingresoservicio=@v ORDER BY item`, { v: fid });
    const mantener = new Set();
    for (const d of dets) {
      if (d.tipo_analisis === 'CostoOperativo') continue;
      const tipo = d.tipo_analisis === 'Terreno' ? 'TERRENO' : d.tipo_analisis === 'Laboratorio' ? 'LABORATORIO' : null; if (!tipo) continue;
      const tec = B.tec.get(Number(d.id_tecnica)); if (!tec) continue;   // técnica fuera de cat_ (igual que el cargador)
      const lab = tipo === 'LABORATORIO' ? await laboratorio(ctx, run, leg, d.id_laboratorioensayo) : null;
      const obj = sinUndef({ id_ficha: fnueva, id_tecnica: tec, id_referencia_analisis: B.ra.get(Number(d.id_referenciaanalisis)) ?? null, tipo_analisis: tipo, item: Number(d.item), id_laboratorio_ensayo: lab,
        id_laboratorio_ensayo_suplente: await laboratorio(ctx, run, leg, d.id_laboratorioensayo_2), id_tipo_entrega: await tipoEntrega(ctx, run, leg, d.id_tipoentrega),
        lleva_traduccion: yes(d.llevatraduccion, false), traduccion_0: t(d.traduccion_0), traduccion_1: t(d.traduccion_1), snap_limite_max_d: num(d.limitemax_d), snap_limite_max_h: num(d.limitemax_h), snap_lleva_error: yes(d.llevaerror, false),
        snap_error_min: num(d.error_min), snap_error_max: num(d.error_max), snap_precio_uf: num(d.uf_individual), activo: d.activo === true || d.activo === 1 });
      const e = Object.entries(obj); const prm = Object.fromEntries(e.map(([, v], i) => [`p${i}`, v]));
      const ya = (await run(`SELECT id FROM fic_ficha_analisis WHERE id_ficha=@f AND item=@i`, { f: fnueva, i: Number(d.item) }))[0]?.id;
      if (ya) await run(`UPDATE fic_ficha_analisis SET ${e.map(([k], i) => `[${k}]=@p${i}`).join(', ')} WHERE id=@id`, { ...prm, id: ya });
      else await run(`INSERT INTO fic_ficha_analisis (${e.map(([k]) => `[${k}]`).join(',')}) VALUES (${e.map((_, i) => `@p${i}`).join(',')})`, prm);
      mantener.add(Number(d.item));
    }
    const sobran = (await run(`SELECT id, item FROM fic_ficha_analisis WHERE id_ficha=@f`, { f: fnueva })).filter((r) => !mantener.has(r.item));
    for (const s of sobran) { await run(`DELETE FROM fic_resultado WHERE id_ficha_analisis=@i`, { i: s.id }); await run(`DELETE FROM fic_ficha_analisis WHERE id=@i`, { i: s.id }); }
    const costo = dets.find((d) => d.tipo_analisis === 'CostoOperativo');
    await run(`UPDATE fic_ficha SET snap_costo_operativo_uf=@c WHERE id=@i`, { c: num(costo?.uf_individual), i: fnueva });
    await restaurar(c, fid);
  },
  async borrar({ ctx, run, clave }) {
    const f = await fichaNueva(ctx, run, clave); if (!f) return;
    await run(`DELETE FROM fic_resultado WHERE id_ficha_analisis IN (SELECT id FROM fic_ficha_analisis WHERE id_ficha=@f)`, { f }); await run(`DELETE FROM fic_ficha_analisis WHERE id_ficha=@f`, { f });
  },
};

/* ---------- visita, procesos y mediciones ---------- */
async function guardarPor(run, tabla, donde, obj) {   // UPDATE si existe la fila con esa clave natural; si no, INSERT. Devuelve el id.
  const w = Object.keys(donde); const e = Object.entries(sinUndef(obj)); const prm = { ...Object.fromEntries(e.map(([, v], i) => [`p${i}`, v])), ...Object.fromEntries(w.map((k) => [`w_${k}`, donde[k]])) };
  const ya = (await run(`SELECT id FROM ${tabla} WHERE ${w.map((k) => `[${k}]=@w_${k}`).join(' AND ')}`, prm))[0]?.id;
  if (ya) { await run(`UPDATE ${tabla} SET ${e.map(([k], i) => `[${k}]=@p${i}`).join(', ')} WHERE id=@id`, { ...prm, id: ya }); return ya; }
  const ek = [...Object.entries(donde), ...e];
  return (await run(`DECLARE @o TABLE (id INT); INSERT INTO ${tabla} (${ek.map(([k]) => `[${k}]`).join(',')}) OUTPUT INSERTED.id INTO @o VALUES (${ek.map((_, i) => `@q${i}`).join(',')}); SELECT id FROM @o;`, Object.fromEntries(ek.map(([, v], i) => [`q${i}`, v]))))[0].id;
}
const borrarVisita = async (run, vid) => {
  await run('UPDATE eqp_equipo SET id_visita_ocupado=NULL, esta_ocupado=0 WHERE id_visita_ocupado=@v', { v: vid });
  await run(`DELETE FROM eqp_uso WHERE id_visita=@v`, { v: vid }); await run(`DELETE FROM fic_resultado WHERE id_visita=@v`, { v: vid });
  await run(`DELETE FROM fic_visita_medicion WHERE id_proceso IN (SELECT id FROM fic_visita_proceso WHERE id_visita=@v)`, { v: vid });
  for (const tb of ['fic_visita_proceso', 'fic_visita_evento', 'fic_visita_documento']) await run(`DELETE FROM ${tb} WHERE id_visita=@v`, { v: vid });
  await run(`DELETE FROM fic_visita WHERE id=@v`, { v: vid });
};

const visita = {
  async upsert(c) {
    const { ctx, run, leg, clave } = c; const B = await base(ctx, run);
    const a = (await legado(leg, `SELECT * FROM App_Ma_Agenda_MUESTREOS WHERE id_agendamam=@v`, { v: clave }))[0]; if (!a) return 'SIN_FILA';
    const corr = String(a.frecuencia_correlativo).trim(); const m = /^(\d+)-(\d+)-(Pendiente|Ejecutado)-(\d+)$/.exec(corr); if (!m) return `AVISO: correlativo "${corr}" no parseable: la visita ${clave} no se copia`;
    const fid = Number(a.id_fichaingresoservicio); const fnueva = await exigirFicha(ctx, run, fid);
    let cod = ESTADO_VISITA[Number(a.id_estadomuestreo)]; if (String(a.estado_caso).trim() === 'CANCELADO' && !/CANCELADO/.test(cod || '')) cod = 'CANCELADO_ADL'; if (!cod) cod = 'POR_ASIGNAR';
    const iC = a.instalacion_completado === 'S', rC = a.retiro_completado === 'S'; const carpeta = iC || rC ? corr.replace('Pendiente', 'Ejecutado') : null; const vdd = num(a.vdd);
    const coord = Number(a.id_coordinador) > 0 ? B.usr.get(Number(a.id_coordinador)) : null; if (Number(a.id_coordinador) > 0 && !coord) throw new Error(`usuario que programó ${a.id_coordinador} sin equivalente en usr_`);
    const previo = (await run(`SELECT id, completado_notificado_en, informe_notificado_en FROM fic_visita WHERE id_agendamam_legacy=@a`, { a: Number(clave) }))[0];
    const vid = await guardarPor(run, 'fic_visita', { id_agendamam_legacy: Number(clave) }, {
      id_ficha: fnueva, numero_visita: Number(m[2]), id_estado_visita: B.estV[cod], id_usuario_programo: coord ?? null, snap_nombre_usuario_programo: coord ? B.usrNom.get(coord) ?? null : null,
      completada_en: a.fecha_completado instanceof Date ? a.fecha_completado : null, ruta_carpeta: carpeta, codigo_archivo_terreno: t(a.id_archivo_terreno),
      cond_flujo_laminar: sn(a.condicionmedicion_flujolaminar), cond_velocidad_uniforme: sn(a.condicionmedicion_velocidaduniforme), cond_observacion: t(a.condicionmedicion_observacion),
      vdd: vdd && vdd > 0 ? vdd : null, folio: num(a.Folio) || null, codigo_caso_adlab: t(a.caso_adlab), snap_nombre_confirma_caso: t(a.realizado_por_gem), caso_confirmado_en: a.fecha_realizado_gem instanceof Date ? a.fecha_realizado_gem : null,
      estado_facturacion: t(a.id_estado_facturacion), correlativo_legacy: corr });
    // equipos fijos que el legado tiene instalados en esta visita (mae_equipo.ocupado_por_frecuencia): se enlazan ahora que la visita existe
    for (const q of (await leg.request().input('c', sql.VarChar(50), corr).query('SELECT id_equipo FROM mae_equipo WHERE LTRIM(RTRIM(ocupado_por_frecuencia)) = @c')).recordset) {
      const en = B.eq.get(Number(q.id_equipo)); if (en) await run('UPDATE eqp_equipo SET id_visita_ocupado=@v WHERE id=@e AND ISNULL(id_visita_ocupado,0)<>@v', { v: vid, e: en });
    }
    const notif = a.notificado_completado === true || a.notificado_completado === 1;
    await run(`UPDATE fic_visita SET completado_notificado_en=${notif ? 'COALESCE(completado_notificado_en, SYSDATETIME())' : 'NULL'}, informe_notificado_en=${a.informe_notificado === 'S' ? 'COALESCE(informe_notificado_en, SYSDATETIME())' : 'NULL'} WHERE id=@i`, { i: vid });
    void previo;

    // procesos y mediciones
    const tipoF = t((await legado(leg, `SELECT tipo_fichaingresoservicio FROM ${MAP_ENC} WHERE id_fichaingresoservicio=@v`, { v: fid }))[0]?.tipo_fichaingresoservicio); const puntual = tipoF === 'Puntual';
    const obs = (v) => { const x = t(v); return x && x !== 'Sin observaciones.' ? x.slice(0, 500) : null; };
    const proc = async (tipo, o) => { const done = o.completado === true;
      return guardarPor(run, 'fic_visita_proceso', { id_visita: vid, tipo }, { fecha_programada: o.fecha, id_persona_muestreador: o.pers, snap_nombre_muestreador: done ? o.nomPers : null, id_persona_supervisor: o.sup, snap_nombre_supervisor: done && o.sup ? o.nomSup : null,
        observador_nombre: t(o.obsNom)?.slice(0, 150), observador_cargo: t(o.obsCar)?.slice(0, 100), observaciones: obs(o.observ), llegada_en: o.llegada instanceof Date ? o.llegada : null, fin_trabajo_en: o.fin instanceof Date ? o.fin : null, completado: done }); };
    const med = async (pid, momento, o) => {
      const ph = num(o.ph); const row = { medido_en: o.en, ph: ph != null && ph >= 0 && ph <= 14 ? ph : null, temperatura: num(o.temp), temperatura_corregida: num(o.corr), totalizador: o.tot && o.tot > 0 ? o.tot : null };
      if (Object.values(row).every((v) => v == null)) { await run(`DELETE FROM fic_visita_medicion WHERE id_proceso=@p AND momento=@m`, { p: pid, m: momento }); return; }
      let eq = null; if (row.temperatura_corregida != null && Number(a.temperatura_fc) > 0) { eq = B.eq.get(Number(a.temperatura_fc)) ?? null; if (!eq) throw new Error(`termómetro ${a.temperatura_fc} sin equivalente en eqp_`); }
      await guardarPor(run, 'fic_visita_medicion', { id_proceso: pid, momento }, { ...row, id_equipo_temperatura: eq });
    };
    const inicio = { en: combine(a.ma_muestreo_fechai, a.ma_muestreo_horai), ph: a.ma_phi, temp: a.ma_temperaturai, corr: a.temperatura_corregidai, tot: num(a.totalizador_inicio) };
    const termino = { en: combine(a.ma_muestreo_fechat, a.ma_muestreo_horat), ph: a.ma_pht, temp: a.ma_temperaturat, corr: a.temperatura_corregidat, tot: num(a.totalizador_final) };
    const compuesta = { en: combine(a.ma_fecha_compuesta, a.ma_hora_compuesta), ph: a.ma_ph_compuesta, temp: a.ma_temperatura_compuesta, corr: a.temperatura_corregidacompuesta };
    const sup1 = P(B, a.id_supervisor), supR = P(B, a.id_supervisor_retiro); const tipos = [];
    if (puntual) {
      const pid = await proc('UNICO', { fecha: dateOnly(a.fecha_muestreo), pers: P(B, a.id_muestreador), nomPers: NP(B, a.id_muestreador), sup: sup1, nomSup: NP(B, a.id_supervisor), obsNom: a.nombre_observadorterreno, obsCar: a.cargo_observadorterreno,
        observ: a.observaciones_muestreador, llegada: a.retiro_hora_inicio_trabajo ?? a.instalacion_hora_inicio_trabajo, fin: a.retiro_hora_fin_trabajo ?? a.instalacion_hora_fin_trabajo, completado: iC });
      tipos.push('UNICO'); await med(pid, 'INICIO', inicio); await med(pid, 'TERMINO', termino);
      await run(`DELETE FROM fic_visita_medicion WHERE id_proceso=@p AND momento='COMPUESTA'`, { p: pid });
    } else {
      const p1 = await proc('INSTALACION', { fecha: dateOnly(a.fecha_muestreo), pers: P(B, a.id_muestreador), nomPers: NP(B, a.id_muestreador), sup: sup1, nomSup: NP(B, a.id_supervisor), obsNom: a.nombre_observadorterreno, obsCar: a.cargo_observadorterreno,
        observ: a.observaciones_muestreador, llegada: a.instalacion_hora_inicio_trabajo, fin: a.instalacion_hora_fin_trabajo, completado: iC });
      const p2 = await proc('RETIRO', { fecha: dateOnly(a.fecha_retiro), pers: P(B, a.id_muestreador2), nomPers: NP(B, a.id_muestreador2), sup: supR, nomSup: NP(B, a.id_supervisor_retiro), obsNom: a.nombre_observadorterreno_retiro, obsCar: a.cargo_observadorterreno_retiro,
        observ: a.observaciones_muestreador2, llegada: a.retiro_hora_inicio_trabajo, fin: a.retiro_hora_fin_trabajo, completado: rC });
      tipos.push('INSTALACION', 'RETIRO'); await med(p1, 'INICIO', inicio); await med(p2, 'TERMINO', termino); await med(p2, 'COMPUESTA', compuesta);
      await run(`DELETE FROM fic_visita_medicion WHERE id_proceso=@p AND momento IN ('TERMINO','COMPUESTA')`, { p: p1 });
    }
    // procesos que ya no corresponden (la ficha pasó de puntual a compuesta o al revés)
    for (const p of await run(`SELECT id, tipo FROM fic_visita_proceso WHERE id_visita=@v`, { v: vid })) if (!tipos.includes(p.tipo)) { await run(`DELETE FROM fic_visita_medicion WHERE id_proceso=@p`, { p: p.id }); await run(`DELETE FROM fic_visita_proceso WHERE id=@p`, { p: p.id }); }
    // la primera agenda de la ficha da su frecuencia e inspector
    const d = await datosDeAgenda(c, fid); const e = Object.entries(d);
    await run(`UPDATE fic_ficha SET ${e.map(([k], i) => `[${k}]=@p${i}`).join(', ')} WHERE id=@i`, { ...Object.fromEntries(e.map(([, v], i) => [`p${i}`, v])), i: fnueva });
    await restaurar(c, fid);
  },
  async borrar({ run, clave }) {
    const v = (await run(`SELECT id FROM fic_visita WHERE id_agendamam_legacy=@a`, { a: Number(clave) }))[0]?.id; if (v) await borrarVisita(run, v);
  },
};

/* ---------- resultados (grupo por ficha) ---------- */
const resultados = {
  async upsert(c) {
    const { ctx, run, leg, clave } = c; const B = await base(ctx, run); const fid = Number(clave); const fnueva = await fichaNueva(ctx, run, fid);
    if (!fnueva) { if (!(await legado(leg, `SELECT 1 x FROM ${MAP_ENC} WHERE id_fichaingresoservicio=@v`, { v: fid })).length) return; throw new Error(`la ficha ${fid} aún no existe en la base nueva`); }
    const res = await legado(leg, `SELECT * FROM App_Ma_Resultados WHERE id_fichaingresoservicio=@v AND tipo_analisis<>'CostoOperativo'`, { v: fid });
    const visitas = new Map((await run(`SELECT id, correlativo_legacy FROM fic_visita WHERE id_ficha=@f`, { f: fnueva })).map((r) => [String(r.correlativo_legacy).trim(), r.id]));
    const ans = new Map((await run(`SELECT id, item FROM fic_ficha_analisis WHERE id_ficha=@f`, { f: fnueva })).map((r) => [r.item, r.id]));
    const agLeg = new Set((await legado(leg, `SELECT frecuencia_correlativo FROM App_Ma_Agenda_MUESTREOS WHERE id_fichaingresoservicio=@v`, { v: fid })).map((r) => String(r.frecuencia_correlativo).trim()));
    const detLeg = new Map((await legado(leg, `SELECT item, id_laboratorioensayo, tipo_analisis, id_tecnica FROM App_Ma_FichaIngresoServicio_DET WHERE id_fichaingresoservicio=@v`, { v: fid })).map((d) => [Number(d.item), d]));
    const mantener = new Set();
    for (const r of res) {
      const corr = String(r.frecuencia_correlativo).trim(); const vid = visitas.get(corr); const an = ans.get(Number(r.item));
      if (!vid) { if (agLeg.has(corr)) throw new Error(`la visita ${corr} de la ficha ${fid} aún no existe en la base nueva`); continue; }   // resultado huérfano en el legado: no se copia (igual que el cargador)
      if (!an) { const d = detLeg.get(Number(r.item)); if (d && d.tipo_analisis !== 'CostoOperativo' && B.tec.get(Number(d.id_tecnica))) throw new Error(`el análisis ${fid}/${r.item} aún no existe en la base nueva`); continue; }
      const planificado = Number(detLeg.get(Number(r.item))?.id_laboratorioensayo) || 0; const real = Number(r.id_laboratorioensayo) || 0;
      const efectivo = real > 0 && planificado > 0 && real !== planificado ? await laboratorio(ctx, run, leg, real) : null; const cump = t(r.cumplimiento) || t(r.cumplimiento_app);
      await guardarPor(run, 'fic_resultado', { id_visita: vid, id_ficha_analisis: an }, { snap_limite_max_d: num(r.limitemax_d), snap_limite_max_h: num(r.limitemax_h), snap_lleva_error: yes(r.llevaerror, false), snap_error_min: num(r.error_min), snap_error_max: num(r.error_max),
        id_persona_muestreador: P(B, r.id_muestreador), medido_en: combine(r.fecha_muestreador, r.hora_muestreador), valor_texto: t(r.estado)?.slice(0, 50), cumple: cump == null ? null : /^cumple$/i.test(cump),
        resultado_cargado_en: combine(r.resultado_fecha, r.resultado_hora), id_laboratorio_ensayo_efectivo: efectivo });
      mantener.add(`${vid}|${an}`);
    }
    for (const x of await run(`SELECT r.id, r.id_visita, r.id_ficha_analisis FROM fic_resultado r JOIN fic_visita v ON v.id=r.id_visita WHERE v.id_ficha=@f`, { f: fnueva })) if (!mantener.has(`${x.id_visita}|${x.id_ficha_analisis}`)) await run(`DELETE FROM fic_resultado WHERE id=@i`, { i: x.id });
    await restaurar(c, fid);
  },
  async borrar({ ctx, run, clave }) { const f = await fichaNueva(ctx, run, clave); if (f) await run(`DELETE FROM fic_resultado WHERE id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@f)`, { f }); },
};

/* ---------- uso de equipos (grupo por ficha; se rehace completo: la tabla legado no tiene clave) ---------- */
const usoEquipos = {
  async upsert(c) {
    const { ctx, run, leg, clave } = c; const B = await base(ctx, run); const fid = Number(clave); const fnueva = await fichaNueva(ctx, run, fid);
    if (!fnueva) { if (!(await legado(leg, `SELECT 1 x FROM ${MAP_ENC} WHERE id_fichaingresoservicio=@v`, { v: fid })).length) return; throw new Error(`la ficha ${fid} aún no existe en la base nueva`); }
    const visitas = new Map((await run(`SELECT id, correlativo_legacy FROM fic_visita WHERE id_ficha=@f`, { f: fnueva })).map((r) => [String(r.correlativo_legacy).trim(), r.id]));
    const agLeg = new Set((await legado(leg, `SELECT frecuencia_correlativo FROM App_Ma_Agenda_MUESTREOS WHERE id_fichaingresoservicio=@v`, { v: fid })).map((r) => String(r.frecuencia_correlativo).trim()));
    const filas = [];
    for (const e of await legado(leg, `SELECT * FROM App_Ma_Equipos_MUESTREOS WHERE id_fichaingresoservicio=@v`, { v: fid })) {
      const corr = String(e.frecuencia_correlativo).trim(); const vid = visitas.get(corr); const eq = B.eq.get(Number(e.id_equipo));
      if (!vid) { if (agLeg.has(corr)) throw new Error(`la visita ${corr} de la ficha ${fid} aún no existe en la base nueva`); continue; }
      if (!eq) throw new Error(`equipo ${e.id_equipo} sin equivalente en eqp_`);
      let h = B.hist.get(`${Number(e.id_equipo)}|${t(e.version)}`);
      if (!h) { h = await versionCitada(run, eq, e); B.hist.set(`${Number(e.id_equipo)}|${t(e.version)}`, h); }   // la versión citada no existe en el historial: se crea (no se pierden tienefc/errores del uso)
      const est = t(e.estado) || 'ACTIVO';
      filas.push({ id_visita: vid, id_equipo: eq, id_equipo_historial: h, id_persona: P(B, e.id_muestreador), seleccionado: yes(e.seleccionado, false), usado_instalacion: sn(e.usado_instalacion), usado_retiro: sn(e.usado_retiro), estado: est === 'DESACTIVADO' ? 'DESACTIVADO' : 'ACTIVO',
        snap_tiene_factor_correccion: sn(e.tienefc), snap_error_0: num(e.error0), snap_error_15: num(e.error15), snap_error_30: num(e.error30) });
    }
    await run(`DELETE FROM eqp_uso WHERE id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@f)`, { f: fnueva });
    for (const f of filas) { const e = Object.entries(f); await run(`INSERT INTO eqp_uso (${e.map(([k]) => `[${k}]`).join(',')}) VALUES (${e.map((_, i) => `@p${i}`).join(',')})`, Object.fromEntries(e.map(([, v], i) => [`p${i}`, v]))); }
  },
  async borrar({ ctx, run, clave }) { const f = await fichaNueva(ctx, run, clave); if (f) await run(`DELETE FROM eqp_uso WHERE id_visita IN (SELECT id FROM fic_visita WHERE id_ficha=@f)`, { f }); },
};

/* ---------- historial de la ficha (mae_ficha_historial → fic_ficha_historial) ---------- */
const historialFicha = {
  async upsert(c) {
    const { ctx, run, leg, clave } = c; const B = await base(ctx, run);
    const h = (await legado(leg, `SELECT * FROM mae_ficha_historial WHERE id_historial=@v`, { v: clave }))[0]; if (!h) return 'SIN_FILA';
    const ficha = await exigirFicha(ctx, run, h.id_fichaingresoservicio);
    const usu = Number(h.id_usuario) > 0 ? B.usr.get(Number(h.id_usuario)) ?? null : null; if (Number(h.id_usuario) > 0 && !usu) throw new Error(`usuario ${h.id_usuario} sin equivalente en usr_`);
    await upsertMapeado(run, { tablaLegado: 'mae_ficha_historial', idLegado: Number(clave), tabla: 'fic_ficha_historial', obj: { id_ficha: ficha, fecha: dt(h.fecha) ?? undefined, id_usuario: usu, snap_nombre_usuario: usu ? B.usrNom.get(usu) ?? null : null,
      accion: (t(h.accion) || '(sin acción)').slice(0, 50), estado_anterior: t(h.estado_anterior)?.slice(0, 50) ?? null, estado_nuevo: t(h.estado_nuevo)?.slice(0, 50) ?? null, observacion: raw(h.observacion) } });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'mae_ficha_historial', idLegado: Number(clave), tabla: 'fic_ficha_historial' }),
};

export const manejadores = { mae_ficha_historial: historialFicha, [MAP_ENC]: ficha, App_Ma_FichaIngresoServicio_DET: analisis, App_Ma_Agenda_MUESTREOS: visita, App_Ma_Resultados: resultados, App_Ma_Equipos_MUESTREOS: usoEquipos };
void raw; void dt; void fichaLeg;
