// Manejadores del módulo cli_ (empresas, servicios, centros, contactos). Mismas reglas que scripts/migracion-cli.mjs, por fila.
//
// REGLA DE LAS FILAS FUSIONADAS: en la pantalla de revisión una persona puede fusionar dos empresas/servicios/centros; entonces
// los ids del legado de AMBAS filas apuntan a una sola fila nueva, y la del descartado queda marcada FUSIONADO_REVISION en
// mig_id_map. Si esa fila descartada sigue cambiando en el legado, el motor NO pisa la fila que quedó: registra un AVISO.
//
// Otras reglas: RUT único (la fila que ya tenía el RUT lo conserva; la que llega después queda "RUT#id" y va a revisión),
// RUT vacío o de relleno → "SIN-RUT-id"; el padre de un servicio sale de mae_empresa.id_empresaservicio (luego RUT igual, fichas o
// contactos) y un servicio HABILITADO sin padre genera su propia empresa; fac_cliente_config manda sobre requiere_oc / requiere_hes /
// forma de pago / correo de facturación (esos campos no se pisan si el servicio tiene configuración).
import sql from 'mssql';
import { norm, t, si, numero, insertar, actualizar, fijarMapa, upsertMapeado } from '../comun.js';
import { mapa, filaLegado } from './contexto.js';
import { clave as claveNombre, rutClave, rlegalDe, coordOk, enChile, coordTexto, metros, ESQUEMAS } from '../datos/clientes.js';
import { CONTACTO_MANUAL } from '../datos/contactosManuales.js';

const fusionada = (nota) => String(nota ?? '').startsWith('FUSIONADO_REVISION');
const previoMapa = async (run, tabla, id) => (await run(`SELECT id_nuevo, nota FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: tabla, l: id }))[0];
const numL = (leg, sqlText, id) => leg.request().input('v', sql.Numeric(18, 0), Number(id)).query(sqlText);
const mejorEmp = (a, b) => (si(b.habilitado) - si(a.habilitado)) || (Number(a.id_empresa) - Number(b.id_empresa));
const mejorCen = (a, b) => (si(b.vigente) - si(a.vigente)) || (Number(a.id_centro) - Number(b.id_centro));
const cortar = (s, n) => { const x = t(s); return x ? x.slice(0, n) : null; };

// Todas las empresas del legado (650 filas): se leen una vez por pasada.
async function empresasLegado(ctx, leg) {
  if (!ctx.empLeg) { const filas = (await leg.request().query(`SELECT * FROM mae_empresa`)).recordset; ctx.empLeg = new Map(filas.map((e) => [Number(e.id_empresa), e])); }
  return ctx.empLeg;
}
const fichasDe = async (leg, col, id) => (await numL(leg, `SELECT COUNT(*) n FROM App_Ma_FichaIngresoServicio_ENC WHERE ${col}=@v`, id)).recordset[0].n;

// Fila del legado que corresponde a una fila nueva (para armar el detalle de la cola de revisión).
const legadoDe = async (run, tabla, idNuevo) => (await run(`SELECT TOP 1 id_legado FROM mig_id_map WHERE tabla_legado=@t AND id_nuevo=@i ORDER BY CASE WHEN nota IS NULL THEN 0 ELSE 1 END, id_legado`, { t: tabla, i: idNuevo }))[0]?.id_legado;
const parExiste = async (run, entidad, a, b) => (await run(`SELECT 1 x FROM revision_duplicado WHERE entidad=@e AND ((id_registro_a=@a AND id_registro_b=@b) OR (id_registro_a=@b AND id_registro_b=@a))`, { e: entidad, a, b })).length > 0;
const insertarPar = (run, entidad, a, b, criterio, dist, det, obs) => run(`INSERT INTO revision_duplicado (entidad, id_registro_a, id_registro_b, criterio, distancia_metros, detalle_json, observacion) VALUES (@e,@a,@b,@c,@d,@j,@o)`,
  { e: entidad, a, b, c: criterio, d: dist != null ? Math.round(dist * 100) / 100 : null, j: JSON.stringify(det), o: obs });

// Borra la fila nueva solo si ningún otro id legado apunta a ella (una fusión deja varias filas del legado en una nueva).
async function borrarCompartido(run, tablaLegado, idLegado, tabla) {
  const previo = await previoMapa(run, tablaLegado, idLegado); if (!previo) return;
  await run(`DELETE FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: tablaLegado, l: idLegado });
  if (!(await run(`SELECT 1 x FROM mig_id_map WHERE tabla_nueva=@n AND id_nuevo=@i`, { n: tabla, i: previo.id_nuevo })).length) await run(`DELETE FROM ${tabla} WHERE id=@i`, { i: previo.id_nuevo });
}

/* ---------- mae_empresa → cli_empresa ---------- */
const resumenEmp = async (leg, e) => ({ legado_id: Number(e.id_empresa), nombre: norm(e.nombre_empresa), fantasia: t(e.nombre_fantasia), rut: norm(e.rut_empresa), habilitada: si(e.habilitado), fichas: await fichasDe(leg, 'id_empresa', e.id_empresa), direccion: t(e.direccion_empresa), email: t(e.email_empresa) });

const empresa = {
  async upsert({ ctx, run, leg, clave }) {
    const e = await filaLegado(leg, 'mae_empresa', 'id_empresa', clave); if (!e) return 'SIN_FILA'; const idL = Number(e.id_empresa);
    const previo = await previoMapa(run, 'mae_empresa', idL);
    if (previo && fusionada(previo.nota)) return `AVISO: la empresa ${idL} "${norm(e.nombre_empresa)}" fue fusionada en la revisión; su cambio en el legado no se aplicó a la fila que quedó`;
    const k = rutClave(e.rut_empresa); let rut;
    if (!k) rut = `SIN-RUT-${idL}`;
    else {
      // el RUT es único: lo conserva la fila que ya lo tenía; las demás con el MISMO RUT (aunque esté escrito distinto: puntos, guiones)
      // quedan "RUT#id". Es dueño de un RUT un miembro del grupo cuyo RUT guardado no lleva sufijo.
      const base = norm(e.rut_empresa).slice(0, 20); let conflicto = (await run(`SELECT TOP 1 id FROM cli_empresa WHERE rut=@r ${previo ? 'AND id<>@i' : ''}`, { r: base, i: previo?.id_nuevo ?? 0 }))[0] != null;
      if (!conflicto) for (const o of (await empresasLegado(ctx, leg)).values()) {
        if (Number(o.id_empresa) === idL || rutClave(o.rut_empresa) !== k) continue;
        const om = await previoMapa(run, 'mae_empresa', Number(o.id_empresa)); if (!om || om.id_nuevo === previo?.id_nuevo) continue;
        const guardado = (await run(`SELECT rut FROM cli_empresa WHERE id=@i`, { i: om.id_nuevo }))[0]?.rut; if (guardado && !guardado.includes('#')) { conflicto = true; break; }
      }
      rut = conflicto ? `${base}#${idL}` : base;
    }
    const obj = { rut: rut.slice(0, 20), razon_social: (t(e.nombre_empresa) || `Empresa ${idL}`).slice(0, 200), nombre_fantasia: t(e.nombre_fantasia), direccion: t(e.direccion_empresa), email: t(e.email_empresa), telefono: cortar(e.fono_empresa, 60),
      ...rlegalDe(e), rlegal_direccion: t(e.rlegal_direccion), habilitado: si(e.habilitado) };
    const id = await upsertMapeado(run, { tablaLegado: 'mae_empresa', idLegado: idL, tabla: 'cli_empresa', obj });
    if (previo) return;
    // empresa nueva: ¿podría ser una ya existente? (RUT o nombre iguales) → cola de revisión, nunca se fusiona sola
    const otros = [];
    for (const o of (await empresasLegado(ctx, leg)).values()) { if (Number(o.id_empresa) === idL) continue; const om = await previoMapa(run, 'mae_empresa', Number(o.id_empresa)); if (om && om.id_nuevo !== id) otros.push({ o, nuevo: om.id_nuevo }); }
    // Como el cargador: cada grupo de duplicados es una ESTRELLA alrededor de su mejor fila (habilitada, luego id menor).
    const estrella = async (grupo, criterio, obs) => {
      if (!grupo.length) return;
      const mejor = [...grupo.map((x) => x.o), e].sort(mejorEmp)[0];
      for (const c of (mejor === e ? grupo : grupo.filter((x) => x.o === mejor))) {
        if (await parExiste(run, 'CLI_EMPRESA', c.nuevo, id)) continue;
        const [A, B, nA, nB] = mejor === e ? [e, c.o, id, c.nuevo] : [c.o, e, c.nuevo, id];
        await insertarPar(run, 'CLI_EMPRESA', nA, nB, criterio, null, { a: await resumenEmp(leg, A), b: await resumenEmp(leg, B) }, obs);
      }
    };
    await estrella(otros.filter((x) => k && rutClave(x.o.rut_empresa) === k), 'MISMO_RUT', 'Mismo RUT; la segunda se cargó con sufijo #id');
    const nk = claveNombre(e.nombre_empresa);
    await estrella(otros.filter((x) => nk && claveNombre(x.o.nombre_empresa) === nk), 'MISMO_NOMBRE', 'Mismo nombre con RUT distinto');
  },
  borrar: ({ run, clave }) => borrarCompartido(run, 'mae_empresa', Number(clave), 'cli_empresa'),
};

/* ---------- mae_empresaservicios → cli_empresa_servicio ---------- */
async function padreDeServicio(ctx, run, leg, s) {
  const idL = Number(s.id_empresaservicio); if (!(idL > 0)) return null;   // id 0 = "ninguno" en el legado: no es un servicio real (6 empresas lo usan para "sin servicio")
  const todas = [...(await empresasLegado(ctx, leg)).values()].sort(mejorEmp);
  const cand = todas.find((e) => Number(e.id_empresaservicio) === idL); if (cand) return { padre: Number(cand.id_empresa), via: 'empresa' };
  const k = rutClave(s.rut_empresaservicios); if (k) { const p = todas.find((e) => rutClave(e.rut_empresa) === k); if (p) return { padre: Number(p.id_empresa), via: 'rut' }; }
  const f = (await numL(leg, `SELECT TOP 1 id_empresa FROM App_Ma_FichaIngresoServicio_ENC WHERE id_empresaservicio=@v AND id_empresa>0 ORDER BY id_fichaingresoservicio`, idL)).recordset[0]; if (f) return { padre: Number(f.id_empresa), via: 'ficha' };
  const c = (await numL(leg, `SELECT TOP 1 id_empresa FROM mae_contacto WHERE id_empresaservicio=@v AND id_empresa>0 ORDER BY id_contacto`, idL)).recordset[0]; if (c && (await empresasLegado(ctx, leg)).has(Number(c.id_empresa))) return { padre: Number(c.id_empresa), via: 'contacto' };
  return null;
}

const resumenSrv = async (run, leg, s, empresaNombre) => ({ legado_id: Number(s.id_empresaservicio), nombre: norm(s.nombre_empresaservicios), rut: norm(s.rut_empresaservicios), habilitado: si(s.habilitado), fichas: await fichasDe(leg, 'id_empresaservicio', s.id_empresaservicio), empresa: empresaNombre, email_facturacion: t(s.email_facturacion) });

const servicio = {
  async upsert({ ctx, run, leg, clave }) {
    const s = await filaLegado(leg, 'mae_empresaservicios', 'id_empresaservicio', clave); if (!s) return 'SIN_FILA'; const idL = Number(s.id_empresaservicio);
    const previo = await previoMapa(run, 'mae_empresaservicios', idL);
    if (previo && fusionada(previo.nota)) return `AVISO: el servicio ${idL} "${norm(s.nombre_empresaservicios)}" fue fusionado en la revisión; su cambio en el legado no se aplicó a la fila que quedó`;
    // empresa padre
    let idEmp = null; const r = await padreDeServicio(ctx, run, leg, s);
    if (r) { idEmp = (await mapa(ctx, run, 'mae_empresa')).get(r.padre); if (!idEmp) throw new Error(`la empresa ${r.padre} (padre del servicio) aún no existe en cli_empresa`); }
    if (!idEmp && si(s.habilitado) && norm(s.nombre_empresaservicios)) {   // servicio habilitado sin empresa: se crea la suya
      const der = await previoMapa(run, 'mae_empresaservicios#empresa_derivada', idL);
      if (der) idEmp = der.id_nuevo;
      else {
        const k = rutClave(s.rut_empresaservicios); const base = norm(s.rut_empresaservicios);
        const libre = k && base.length <= 20 && !(await run(`SELECT 1 x FROM cli_empresa WHERE rut=@r`, { r: base })).length;
        idEmp = await insertar(run, 'cli_empresa', { rut: libre ? base : `SIN-RUT-S${idL}`, razon_social: norm(s.nombre_empresaservicios).slice(0, 200), nombre_fantasia: t(s.nombre_fantasia) ?? undefined, direccion: t(s.direccion_empresaservicios) ?? undefined, email: t(s.email_empresaservicios) ?? undefined, habilitado: true });
        await fijarMapa(run, 'mae_empresaservicios#empresa_derivada', idL, 'cli_empresa', idEmp, 'servicio habilitado sin empresa padre: se creó su empresa');
      }
    }
    if (!idEmp) return previo ? 'AVISO: el servicio ya no tiene empresa padre resoluble; se conserva como estaba' : (si(s.habilitado) ? `AVISO: servicio HABILITADO ${idL} sin empresa padre resoluble: no se copia` : undefined);
    const idNuevoPrevio = previo?.id_nuevo;
    const cfg = idNuevoPrevio ? (await run(`SELECT 1 x FROM fac_cliente_config WHERE id_empresa_servicio=@i`, { i: idNuevoPrevio })).length > 0 : false;
    const cfgLeg = cfg ? (await numL(leg, `SELECT email_facturacion FROM fac_cliente_config WHERE id_empresaservicio=@v`, idL)).recordset[0] : null;
    const comuna = Number(s.id_comuna) > 0 ? (await mapa(ctx, run, 'mae_comuna')).get(Number(s.id_comuna)) ?? null : null;
    const esq = norm(s.precio_lista) ? (ESQUEMAS.get(norm(s.precio_lista).toLowerCase()) ?? null) : null;
    const obj = { id_empresa: idEmp, nombre: (t(s.nombre_empresaservicios) || `Servicio ${idL}`).slice(0, 200), rut: cortar(s.rut_empresaservicios, 20), direccion: t(s.direccion_empresaservicios), email: t(s.email_empresaservicios), telefono: cortar(s.fono_empresaservicios, 100),
      giro: t(s.giro_empresaservicios), id_comuna: comuna, contacto_nombre: t(s.contacto_empresaservicios), contacto_email: t(s.email_contacto), contacto_telefono: cortar(s.fono_contacto, 100),
      habilitado: si(s.habilitado), ciudad: cortar(s.ciudad_empresaservicios, 100), esquema_precio: esq, precio_especial: si(s.precio_especial), cobra_costo_operativo: si(s.costo_op), factor_km: numero(s.factor_km), tablact: si(s.tablact) };
    // con configuración de facturación, ella manda sobre estos campos
    if (!cfg) { obj.requiere_oc = si(s.mam_oc); obj.email_facturacion = t(s.email_facturacion); }
    else if (!t(cfgLeg?.email_facturacion)) obj.email_facturacion = t(s.email_facturacion);
    const id = await upsertMapeado(run, { tablaLegado: 'mae_empresaservicios', idLegado: idL, tabla: 'cli_empresa_servicio', obj });
    if (previo) return;
    // servicio nuevo: mismo RUT que otro → cola de revisión
    const k = rutClave(s.rut_empresaservicios); if (!k) return;
    const otros = (await leg.request().query(`SELECT * FROM mae_empresaservicios`)).recordset.filter((o) => Number(o.id_empresaservicio) !== idL && rutClave(o.rut_empresaservicios) === k);
    const nomEmp = async (idN) => (await run(`SELECT e.razon_social FROM cli_empresa_servicio s JOIN cli_empresa e ON e.id=s.id_empresa WHERE s.id=@i`, { i: idN }))[0]?.razon_social ?? null;
    // estrella alrededor del mejor servicio del grupo (habilitado primero, luego id menor), igual que el cargador
    const mejorSrv = (a, b) => (si(b.habilitado) - si(a.habilitado)) || (Number(a.id_empresaservicio) - Number(b.id_empresaservicio));
    const enGrupo = []; for (const o of otros) { const om = await previoMapa(run, 'mae_empresaservicios', Number(o.id_empresaservicio)); if (om && om.id_nuevo !== id) enGrupo.push({ o, nuevo: om.id_nuevo }); }
    const mejorS = [...enGrupo.map((x) => x.o), s].sort(mejorSrv)[0];
    for (const { o, nuevo } of (mejorS === s ? enGrupo : enGrupo.filter((x) => x.o === mejorS))) {
      const om = { id_nuevo: nuevo }; if (await parExiste(run, 'CLI_SERVICIO', om.id_nuevo, id)) continue;
      const oMejor = mejorS !== s;
      const [A, B, nA, nB] = oMejor ? [o, s, om.id_nuevo, id] : [s, o, id, om.id_nuevo];
      await insertarPar(run, 'CLI_SERVICIO', nA, nB, 'MISMO_RUT', null, { a: await resumenSrv(run, leg, A, await nomEmp(nA)), b: await resumenSrv(run, leg, B, await nomEmp(nB)) }, 'Mismo RUT de facturación');
    }
  },
  borrar: ({ run, clave }) => borrarCompartido(run, 'mae_empresaservicios', Number(clave), 'cli_empresa_servicio'),
};

/* ---------- mae_centro → cli_centro (+ vínculo con el servicio de su empresa) ---------- */
const resumenCen = async (run, leg, c, coord) => {
  const e = (await numL(leg, `SELECT nombre_empresa, rut_empresa FROM mae_empresa WHERE id_empresa=@v`, c.id_empresa)).recordset[0];
  return { legado_id: Number(c.id_centro), nombre: norm(c.nombre_centro), codigo: t(c.codigo_centro), empresa: norm(e?.nombre_empresa) || null, rut: norm(e?.rut_empresa) || null, lat: coord?.[0] ?? null, lon: coord?.[1] ?? null, habilitado: si(c.vigente), fichas: await fichasDe(leg, 'id_centro', c.id_centro), ubicacion: t(c.ubicacion) };
};

function coordenadasDe(c) {
  let lat = numero(c.latitud) || numero(c.geo_latitud), lon = numero(c.longitud) || numero(c.geo_longitud);
  if (!coordOk(lat, lon)) { const la = coordTexto(c.ma_latitud), lo = coordTexto(c.ma_longitud); if (coordOk(la, lo) && enChile(la, lo)) { lat = la; lon = lo; } }
  return coordOk(lat, lon) ? [lat, lon] : null;
}

const centro = {
  async upsert({ ctx, run, leg, clave }) {
    const c = await filaLegado(leg, 'mae_centro', 'id_centro', clave); if (!c) return 'SIN_FILA'; const idL = Number(c.id_centro);
    const previo = await previoMapa(run, 'mae_centro', idL);
    if (previo && fusionada(previo.nota)) return `AVISO: el centro ${idL} "${norm(c.nombre_centro)}" fue fusionado en la revisión; su cambio en el legado no se aplicó a la fila que quedó`;
    const g = async (tabla, v) => (Number(v) > 0 ? (await mapa(ctx, run, tabla)).get(Number(v)) ?? null : null);
    const ll = coordenadasDe(c);
    const obj = { nombre: (t(c.nombre_centro) || `Centro ${idL}`).slice(0, 150), codigo: cortar(c.codigo_centro, 60), latitud: ll ? Math.round(ll[0] * 1e7) / 1e7 : null, longitud: ll ? Math.round(ll[1] * 1e7) / 1e7 : null,
      utm_norte: numero(c.utm_norte) || null, utm_este: numero(c.utm_este) || null, ubicacion: t(c.ubicacion), habilitado: si(c.vigente), id_region: await g('mae_region', c.id_region),
      observaciones: (String(c.observaciones ?? '').trim() || null)?.slice(0, 500) ?? null, nombre_corto: cortar(c.nombre_corto, 100), nombre_alternativo: cortar(c.nombre_alternativo, 120),
      id_comuna: await g('mae_comuna', c.id_comuna), id_zona: await g('mae_zonas', c.id_zona), id_sector: await g('mae_zonageografica', c.id_zonageografica), id_barrio: await g('mae_barrio', c.id_barrio), id_tipo_agua: await g('mae_tipoagua', c.id_tipoagua) };
    const id = await upsertMapeado(run, { tablaLegado: 'mae_centro', idLegado: idL, tabla: 'cli_centro', obj });
    // vínculo con el servicio de su empresa (los vínculos que vienen de las fichas los crea el módulo fic_)
    const emp = (await empresasLegado(ctx, leg)).get(Number(c.id_empresa)); const slLeg = Number(emp?.id_empresaservicio) > 0 ? Number(emp.id_empresaservicio) : 0;
    const srv = slLeg ? (await mapa(ctx, run, 'mae_empresaservicios')).get(slLeg) : null;
    if (srv && !(await run(`SELECT 1 x FROM cli_empresa_centro WHERE id_centro=@c AND id_empresa_servicio=@s`, { c: id, s: srv })).length) await run(`INSERT INTO cli_empresa_centro (id_centro, id_empresa_servicio, habilitado) VALUES (@c,@s,@h)`, { c: id, s: srv, h: si(c.vigente) });
    await run(`UPDATE cli_empresa_centro SET habilitado=@h WHERE id_centro=@c AND habilitado<>@h`, { c: id, h: si(c.vigente) });
    if (previo) return;
    // centro nuevo: mismo nombre y misma empresa, o a 100 m o menos con coordenadas confiables → cola de revisión
    const otros = []; const nombre = claveNombre(c.nombre_centro);
    if (nombre) {   // mismo nombre y misma empresa: estrella alrededor del mejor centro del grupo (vigente primero, luego id menor), igual que el cargador
      const iguales = (await numL(leg, `SELECT * FROM mae_centro WHERE id_empresa=@v AND id_centro<>${idL}`, c.id_empresa)).recordset.filter((o) => claveNombre(o.nombre_centro) === nombre);
      const mejorC = [...iguales, c].sort(mejorCen)[0];
      for (const o of (mejorC === c ? iguales : [mejorC])) otros.push({ o, criterio: 'MISMO_NOMBRE_MISMA_EMPRESA' });
    }
    const confiable = async (lat, lon) => (await run(`SELECT COUNT(DISTINCT LOWER(nombre)) n FROM cli_centro WHERE ROUND(latitud,5)=ROUND(@a,5) AND ROUND(longitud,5)=ROUND(@b,5)`, { a: lat, b: lon }))[0].n <= 2;
    const conCoordConfiable = ll && await confiable(ll[0], ll[1]);
    if (conCoordConfiable) for (const cand of await run(`SELECT id, latitud, longitud FROM cli_centro WHERE id<>@i AND latitud BETWEEN @a-0.0025 AND @a+0.0025 AND longitud BETWEEN @b-0.0025 AND @b+0.0025`, { i: id, a: ll[0], b: ll[1] })) {
      if (metros(ll[0], ll[1], Number(cand.latitud), Number(cand.longitud)) > 100 || !(await confiable(Number(cand.latitud), Number(cand.longitud)))) continue;
      const lg = await legadoDe(run, 'mae_centro', cand.id); if (!lg || otros.some((x) => Number(x.o.id_centro) === Number(lg))) continue;
      const o = await filaLegado(leg, 'mae_centro', 'id_centro', lg); if (o) otros.push({ o, criterio: 'COORDENADAS_CERCANAS' });
    }
    for (const { o, criterio } of otros) {
      const om = await previoMapa(run, 'mae_centro', Number(o.id_centro)); if (!om || om.id_nuevo === id || await parExiste(run, 'CLI_CENTRO', om.id_nuevo, id)) continue;
      const oll = coordenadasDe(o); const [A, B] = mejorCen(o, c) <= 0 ? [o, c] : [c, o]; const [nA, nB] = A === o ? [om.id_nuevo, id] : [id, om.id_nuevo];
      const dist = ll && oll && conCoordConfiable && await confiable(oll[0], oll[1]) ? metros(ll[0], ll[1], oll[0], oll[1]) : null;
      await insertarPar(run, 'CLI_CENTRO', nA, nB, criterio, dist, { a: await resumenCen(run, leg, A, A === o ? oll : ll), b: await resumenCen(run, leg, B, B === o ? oll : ll) }, criterio === 'COORDENADAS_CERCANAS' ? 'A 100 m o menos, coordenadas confiables' : 'Mismo nombre y misma empresa');
    }
  },
  borrar: ({ run, clave }) => borrarCompartido(run, 'mae_centro', Number(clave), 'cli_centro'),
};

/* ---------- mae_contacto → cli_contacto ---------- */
const contacto = {
  async upsert({ ctx, run, leg, clave }) {
    const c = await filaLegado(leg, 'mae_contacto', 'id_contacto', clave); if (!c) return 'SIN_FILA'; const idL = Number(c.id_contacto);
    const SRV = await mapa(ctx, run, 'mae_empresaservicios');
    let sl = Number(c.id_empresaservicio);
    if (!(sl > 0) || !SRV.has(sl)) { const se = Number((await empresasLegado(ctx, leg)).get(Number(c.id_empresa))?.id_empresaservicio); sl = se > 0 ? se : 0; }   // el servicio de su empresa (0 = ninguno)
    if (!SRV.has(sl) && CONTACTO_MANUAL.has(idL) && SRV.has(CONTACTO_MANUAL.get(idL))) sl = CONTACTO_MANUAL.get(idL);
    if (!SRV.has(sl)) return si(c.habilitado) ? `AVISO: contacto HABILITADO ${idL} "${norm(c.nombre_contacto)}" sin servicio resoluble: no se copia` : undefined;
    const cargo = Number(c.id_cargo) > 0 ? (await mapa(ctx, run, 'mae_cargo')).get(Number(c.id_cargo)) ?? null : null;
    await upsertMapeado(run, { tablaLegado: 'mae_contacto', idLegado: idL, tabla: 'cli_contacto',
      obj: { id_empresa_servicio: SRV.get(sl), nombre: (t(c.nombre_contacto) || `Contacto ${idL}`).slice(0, 150), email: cortar(c.email_contacto, 150), telefono: cortar(c.fono_contacto, 50), id_cargo: cargo, habilitado: si(c.habilitado) } });
  },
  borrar: ({ run, clave }) => borrarCompartido(run, 'mae_contacto', Number(clave), 'cli_contacto'),
};

export const manejadores = { mae_empresa: empresa, mae_empresaservicios: servicio, mae_centro: centro, mae_contacto: contacto };
