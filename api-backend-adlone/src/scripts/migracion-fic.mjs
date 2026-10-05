/* =====================================================================
   Migración de fic_ (fichas, análisis, visitas, mediciones, resultados): legado → esquema v5 (base "…TEST")
   =====================================================================
   Uso:
     node src/scripts/migracion-fic.mjs                 → ensayo: carga TODO y hace ROLLBACK
     node src/scripts/migracion-fic.mjs --apply         → carga y confirma (COMMIT)
     node src/scripts/migracion-fic.mjs --apply --reset → borra antes lo cargado y vuelve a cargar
       (antes: node src/scripts/migracion-fac-docs.mjs --solo-reset --reset --apply, porque los casos de prefactura apuntan a las visitas;
        después: node src/scripts/migracion-fac-docs.mjs --reset --apply)

   SEGURIDAD
     - Del legado SOLO lee (SELECT).
     - Solo escribe en una base cuyo nombre contenga "TEST" (MIG_TEST_DB, por
       defecto "ADL ONE TEST"); si no, se niega a arrancar.
     - Todo ocurre en una transacción; sin --apply termina en ROLLBACK.

   ALCANCE
     Requiere los módulos ya migrados: geo_, cat_, per_, eqp_, cli_, usr_ y los catálogos de la ficha
     (migracion-fic-cat.mjs); todos se resuelven por mig_id_map, aquí no se crea ninguno.
     Carga fichas → análisis → visitas → procesos → mediciones → resultados → uso de equipos, con los
     catálogos de la ficha, el instrumento ambiental (texto → tipo + número + año), la zona UTM, las
     coordenadas y la ubicación, el cargo y la jefatura, y los usuarios que crearon/programaron.
     Descartado a propósito (verificado con datos y código): cliente_entrega (copia del contacto),
     calculo_horas (siempre 0), ficha_habilitado (nunca se lee), dia/mes/ano (derivan de fecha_muestreo),
     id_normativa/id_normativareferencia sueltos (se derivan de la referencia de análisis).
   ===================================================================== */
import dotenv from 'dotenv'; dotenv.config();
import sql from 'mssql';
import { versionCitada } from '../sync/datos/equipoHistorial.js';

const APPLY = process.argv.includes('--apply');
const RESET = process.argv.includes('--reset');
const TEST_DB = process.env.MIG_TEST_DB || 'ADL ONE TEST';
if (!/TEST/i.test(TEST_DB)) { console.error(`ABORTADO: la base destino "${TEST_DB}" no contiene "TEST".`); process.exit(1); }

const cfg = (database) => ({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database,
  requestTimeout: 120000, options: { encrypt: true, trustServerCertificate: true } });
const leg = await new sql.ConnectionPool(cfg(process.env.DB_DATABASE)).connect();
const dst = await new sql.ConnectionPool(cfg(TEST_DB)).connect();
const L = async (q) => (await leg.request().query(q)).recordset;

/* ---------- utilidades ---------- */
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const t = (v) => (v == null ? null : (String(v).trim() || null));
const num = (v) => { if (v == null || String(v).trim() === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const sn = (v) => (v == null || String(v).trim() === '' ? null : /^(S|SI|1|TRUE)$/i.test(String(v).trim()));
const yes = (v, def = true) => { const b = sn(v); return b == null ? def : b; };
const dateOnly = (d) => (d instanceof Date && d.getUTCFullYear() > 1900 && d.getUTCFullYear() !== 1999 ? d : null);
const combine = (d, h) => {
  if (!(d instanceof Date) || d.getUTCFullYear() <= 1900 || d.getUTCFullYear() === 1999) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(h ?? '').trim());
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), m ? +m[1] : 0, m ? +m[2] : 0, m && m[3] ? +m[3] : 0));
};
const warns = new Map();
const warn = (k, ejemplo) => { const w = warns.get(k) || { n: 0, ej: [] }; w.n++; if (w.ej.length < 3 && ejemplo != null) w.ej.push(ejemplo); warns.set(k, w); };

const tx = new sql.Transaction(dst);
await tx.begin();
const run = async (text, params = {}) => {
  const rq = new sql.Request(tx);
  for (const [k, v] of Object.entries(params)) rq.input(k, v === undefined ? null : v);
  return (await rq.query(text)).recordset;
};
const ins = async (table, obj) => {
  const e = Object.entries(obj).filter(([, v]) => v !== undefined);
  const cols = e.map(([k]) => `[${k}]`).join(','), ps = e.map((_, i) => `@p${i}`).join(',');
  const params = Object.fromEntries(e.map(([, v], i) => [`p${i}`, v]));
  // OUTPUT ... INTO: SQL Server no admite OUTPUT sin INTO en tablas con triggers (fic_resultado).
  return (await run(`DECLARE @o TABLE (id INT); INSERT INTO ${table} (${cols}) OUTPUT INSERTED.id INTO @o VALUES (${ps}); SELECT id FROM @o;`, params))[0].id;
};
const count = async (table) => (await run(`SELECT COUNT(*) n FROM ${table}`))[0].n;

try {
  /* ---------- 0. Reset / comprobación de base vacía ---------- */
  const ORDEN = ['eqp_uso','fic_resultado','fic_visita_medicion','fic_visita_proceso','fic_visita_evento','fic_visita_documento','fic_visita',
    'fic_ficha_analisis','fic_ficha','fic_tipo_entrega','fic_laboratorio_ensayo','fic_transporte','fic_frecuencia']; // geo_, cat_, per_, eqp_ y cli_ tienen su propio módulo: no se tocan
  const previo = await count('fic_ficha');
  if (previo > 0 && !RESET) throw new Error('La base de prueba ya tiene datos cargados. Usa --reset para borrarlos y recargar.');
  if (RESET) for (const tb of ORDEN) await run(`DELETE FROM ${tb}`);
  if (process.argv.includes('--solo-reset')) { // vacía lo cargado por este script y termina (no recarga)
    if (!APPLY) { console.log('Ensayo de --solo-reset: se revierte. Agrega --apply para confirmar.'); await tx.rollback(); } else { await tx.commit(); console.log('Datos de fichas/clientes/personas/equipos vaciados en', TEST_DB); }
    await leg.close(); await dst.close(); process.exit(0);
  }

  // Los módulos ya migrados NO se recargan aquí: se resuelven por mig_id_map.
  const desdeMapa = async (tablaLegado) => new Map((await run(`SELECT id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado=@t`, { t: tablaLegado })).map((r) => [Number(r.id_legado), r.id_nuevo]));

  /* ---------- 1. Lectura del legado ---------- */
  const ENC = await L(`SELECT * FROM App_Ma_FichaIngresoServicio_ENC ORDER BY id_fichaingresoservicio`);
  const AG  = await L(`SELECT * FROM App_Ma_Agenda_MUESTREOS ORDER BY id_agendamam`);
  const DET = await L(`SELECT * FROM App_Ma_FichaIngresoServicio_DET ORDER BY id_fichaingresoservicio, item`);
  const RES = await L(`SELECT * FROM App_Ma_Resultados WHERE tipo_analisis<>'CostoOperativo'`);
  const EQM = await L(`SELECT * FROM App_Ma_Equipos_MUESTREOS`);
  const ids = (arr) => [...new Set(arr.filter((x) => x != null && Number(x) > 0).map(Number))];
  const inList = (a) => (a.length ? a.join(',') : 'NULL');

  /* ---------- 2. Personas (muestreadores/supervisores) e inspectores ---------- */
  const PLACEHOLDER_SUP = 1002; // "Sin supervisión"
  const idsPers = ids([...AG.flatMap((a) => [a.id_muestreador, a.id_muestreador2, a.id_supervisor, a.id_supervisor_retiro]),
    ...RES.map((r) => r.id_muestreador), ...EQM.map((e) => e.id_muestreador)]).filter((x) => x !== PLACEHOLDER_SUP);
  const eqIdsPre = ids([...EQM.map((e) => e.id_equipo), ...AG.map((a) => a.temperatura_fc)]);
  const MEQ = eqIdsPre.length ? await L(`SELECT * FROM mae_equipo WHERE id_equipo IN (${inList(eqIdsPre)})`) : [];
  const idsPersAll = ids([...idsPers, ...MEQ.map((e) => e.id_muestreador)]).filter((x) => x !== PLACEHOLDER_SUP);
  const MUE = idsPersAll.length ? await L(`SELECT * FROM mae_muestreador WHERE id_muestreador IN (${inList(idsPersAll)})`) : [];
  // Módulo per_ ya migrado: las personas se resuelven por mig_id_map (no se crean aquí).
  const persMap = await desdeMapa('mae_muestreador'); // ids de sedes/marcadores no están (o apuntan a 0): quedan NULL
  for (const [k, v] of [...persMap]) if (!v) persMap.delete(k);
  if (!persMap.size) throw new Error('per_ no está migrado (mig_id_map sin mae_muestreador). Ejecuta antes migracion-per.mjs.');
  const nomPers = new Map(); // nombre actual de la persona, para el snapshot al completar un proceso
  for (const r of await run(`SELECT p.id, p.nombre FROM per_persona p`)) for (const [leg, nuevo] of persMap) if (nuevo === r.id) nomPers.set(leg, r.nombre);
  for (const x of idsPersAll) if (!persMap.has(x)) warn('persona referenciada sin equivalente en per_ (sede/marcador): queda NULL', x);
  const P = (v) => { const n = Number(v); return n > 0 && n !== PLACEHOLDER_SUP ? persMap.get(n) ?? null : null; };
  const NP = (v) => { const n = Number(v); return n > 0 ? nomPers.get(n) ?? null : null; };
  const inspMap = await desdeMapa('mae_inspectorambiental');

  /* ---------- 3. Clientes: empresa, servicio, centro, contacto ---------- */
  const idsEmp = ids(ENC.map((e) => e.id_empresa)), idsSrv = ids(ENC.map((e) => e.id_empresaservicio));
  const idsCen = ids(ENC.map((e) => e.id_centro)), idsCon = ids(ENC.map((e) => e.id_contacto));
  const EMP = idsEmp.length ? await L(`SELECT * FROM mae_empresa WHERE id_empresa IN (${inList(idsEmp)})`) : [];
  const SRV = idsSrv.length ? await L(`SELECT * FROM mae_empresaservicios WHERE id_empresaservicio IN (${inList(idsSrv)})`) : [];
  const CEN = idsCen.length ? await L(`SELECT * FROM mae_centro WHERE id_centro IN (${inList(idsCen)})`) : [];
  const CON = idsCon.length ? await L(`SELECT * FROM mae_contacto WHERE id_contacto IN (${inList(idsCon)})`) : [];
  // cli_ tiene su propio módulo (migracion-cli.mjs): aquí solo se resuelve por mig_id_map.
  // Si dos empresas/centros legados se fusionaron en la revisión, ambos ids legados apuntan al mismo id nuevo.
  const empMap = await desdeMapa('mae_empresa'), srvMap = await desdeMapa('mae_empresaservicios'), cenMap = await desdeMapa('mae_centro'), conMap = await desdeMapa('mae_contacto');
  if (!empMap.size || !cenMap.size) throw new Error('cli_ no está migrado (mig_id_map sin mae_empresa/mae_centro). Ejecuta antes migracion-cli.mjs.');
  for (const f of ENC) {
    if (Number(f.id_empresa) > 0 && !empMap.has(Number(f.id_empresa))) warn('ficha con empresa sin equivalente en cli_ (queda NULL)', f.id_empresa);
    if (Number(f.id_empresaservicio) > 0 && !srvMap.has(Number(f.id_empresaservicio))) warn('ficha con servicio sin equivalente en cli_ (queda NULL)', f.id_empresaservicio);
    if (Number(f.id_centro) > 0 && !cenMap.has(Number(f.id_centro))) warn('ficha con centro sin equivalente en cli_ (queda NULL)', f.id_centro);
    if (Number(f.id_contacto) > 0 && !conMap.has(Number(f.id_contacto))) warn('ficha con contacto sin equivalente en cli_ (queda NULL)', f.id_contacto);
  }

  /* ---------- 4. Catálogos que las visitas necesitan ---------- */
  const tecMap = await desdeMapa('mae_tecnica');      // módulo cat_
  const raMap = await desdeMapa('App_Ma_ReferenciaAnalisis');
  if (!tecMap.size) throw new Error('cat_ no está migrado (mig_id_map sin mae_tecnica). Ejecuta antes migracion-cat.mjs.');
  const frMap = new Map(); const frNom = new Map();
  const FR = ids(AG.map((a) => a.id_frecuencia)); const FRR = FR.length ? await L(`SELECT * FROM mae_frecuencia WHERE id_frecuencia IN (${inList(FR)})`) : [];
  for (const f of FRR) { const nombre = t(f.nombre_frecuencia) || `Frecuencia ${f.id_frecuencia}`;
    if (frNom.has(nombre.toLowerCase())) { frMap.set(Number(f.id_frecuencia), frNom.get(nombre.toLowerCase())); continue; }
    const id = await ins('fic_frecuencia', { nombre, orden: num(f.orden), multiplicador_anual: num(f.multiplicadopor), dias: num(f.dias), habilitado: yes(f.habilitado) });
    frNom.set(nombre.toLowerCase(), id); frMap.set(Number(f.id_frecuencia), id); }
  const labMap = new Map(); const idsLab = ids([...DET.flatMap((d) => [d.id_laboratorioensayo, d.id_laboratorioensayo_2]), ...RES.map((r) => r.id_laboratorioensayo)]);
  const LAB = idsLab.length ? await L(`SELECT * FROM mae_laboratorioensayo WHERE id_laboratorioensayo IN (${inList(idsLab)})`) : [];
  for (const l of LAB) labMap.set(Number(l.id_laboratorioensayo), await ins('fic_laboratorio_ensayo', { nombre: t(l.nombre_laboratorioensayo) || `Lab ${l.id_laboratorioensayo}`, es_etfa: yes(l.etfa, false), email: t(l.correo_electronico), habilitado: yes(l.habilitado) }));
  const entMap = new Map(); const idsEnt = ids(DET.map((d) => d.id_tipoentrega));
  const ENT = idsEnt.length ? await L(`SELECT * FROM mae_tipoentrega WHERE id_tipoentrega IN (${inList(idsEnt)})`) : [];
  for (const e of ENT) entMap.set(Number(e.id_tipoentrega), await ins('fic_tipo_entrega', { nombre: t(e.nombre_tipoentrega) || `Entrega ${e.id_tipoentrega}`, habilitado: yes(e.habilitado) }));

  /* ---------- 5. Equipos e historial: módulo eqp_ ya migrado, se resuelve por mig_id_map ---------- */
  const eqMap = await desdeMapa('mae_equipo');
  if (!eqMap.size) throw new Error('eqp_ no está migrado (mig_id_map sin mae_equipo). Ejecuta antes migracion-eqp.mjs.');
  const inv = new Map([...eqMap].map(([leg, nuevo]) => [nuevo, leg]));
  const hisMap = new Map(); const hisUlt = new Map();
  for (const r of await run(`SELECT id, id_equipo, version FROM eqp_historial`)) { const leg = inv.get(r.id_equipo); if (leg != null) hisMap.set(`${leg}|${r.version}`, r.id); }
  for (const e of MEQ) { const k = `${Number(e.id_equipo)}|${t(e.version) || 'v1'}`; if (hisMap.has(k)) hisUlt.set(Number(e.id_equipo), hisMap.get(k)); } // versión vigente (línea base)

  /* ---------- 5b. Catálogos de la ficha, usuarios, cargos, zonas: por mig_id_map ---------- */
  const CT = {}; for (const [k, tl] of Object.entries({ lugar: 'mae_lugaranalisis', obj: 'mae_objetivomuestreo_ma', instr: 'mae_instrumentoambiental', tmuestreo: 'mae_tipomuestreo', tmuestra: 'mae_tipomuestra_ma', comp: 'mae_tipomuestra',
    sub: 'mae_subarea', act: 'mae_actividadmuestreo', desc: 'mae_tipodescarga', modal: 'mae_modalidad', forma: 'mae_formacanal', disp: 'mae_dispositivohidraulico', um: 'mae_umedida', zona: 'mae_zonautm', cargo: 'mae_cargo', jef: 'mae_jefaturatecnica' })) CT[k] = await desdeMapa(tl);
  if (!CT.lugar.size || !CT.obj.size) throw new Error('Los catálogos de la ficha no están migrados (mig_id_map sin mae_lugaranalisis). Ejecuta antes migracion-fic-cat.mjs.');
  const USR = await desdeMapa('mae_usuario#usr'); if (!USR.size) throw new Error('usr_ no está migrado (mig_id_map sin mae_usuario#usr). Ejecuta antes migracion-usr.mjs.');
  const usrNom = new Map((await run(`SELECT id, nombre FROM usr_usuario`)).map((r) => [r.id, r.nombre]));
  const cargoNom = new Map((await run(`SELECT id, nombre FROM per_cargo`)).map((r) => [r.id, r.nombre]));
  const zonaPorNombre = new Map((await run(`SELECT id, nombre FROM geo_zona_utm`)).map((r) => [String(r.nombre).trim().toUpperCase(), r.id]));
  const M = (mapa, v, etiqueta) => { if (v == null || norm(v) === '') return null; const n = Number(v); if (!(n >= 0)) return null; const r = mapa.get(n); if (r == null && n > 0) warn(`${etiqueta} sin equivalente (queda NULL)`, n); return r ?? null; };
  // Instrumento ambiental: el legado guarda TEXTO ("Resolución SISS 123/2011"); se descompone en tipo (catálogo) + número + año.
  const instrumentos = (await run(`SELECT id, nombre FROM fic_instrumento_ambiental`)).sort((a, b) => b.nombre.length - a.nombre.length); const idOtro = instrumentos.find((i) => /^otro$/i.test(i.nombre))?.id;
  const instrumento = (texto) => { const x = norm(texto); if (!x) return {};
    const c = instrumentos.find((i) => x.toLowerCase() === i.nombre.toLowerCase() || x.toLowerCase().startsWith(i.nombre.toLowerCase() + ' '));
    if (c) { const resto = x.slice(c.nombre.length).trim(); const m = /^(.*?)\/(\d{4})$/.exec(resto); return { id: c.id, numero: (m ? m[1].trim() : resto) || undefined, anio: m ? m[2] : undefined }; }
    const y = /\b(\d{4})$/.exec(x); if (x.length > 50) warn('instrumento ambiental de más de 50 caracteres (se recorta el número)', x.slice(0, 40));
    return { id: idOtro, numero: x.slice(0, 50), anio: y ? y[1] : undefined }; };

  /* ---------- 6. Ficha, análisis, visitas ---------- */
  const ESTADO_FICHA = { 1: 'APROBADA_TECNICA', 2: 'RECHAZADA_TECNICA', 3: 'PENDIENTE_TECNICA', 4: 'RECHAZADA_COORDINACION', 5: 'EN_PROCESO', 6: 'PENDIENTE_PROGRAMACION', 7: 'CANCELADO', 8: 'CICLO_FINALIZADO' };
  const ESTADO_VISITA = { 0: 'POR_ASIGNAR', 1: 'PENDIENTE', 3: 'EJECUTADO', 4: 'SUSPENDIDO_ADL', 5: 'SUSPENDIDO_TERRENO', 6: 'CANCELADO_ADL', 7: 'CANCELADO_TERRENO' };
  const idEstF = Object.fromEntries((await run(`SELECT id, codigo FROM fic_estado_ficha`)).map((r) => [r.codigo, r.id]));
  const idEstV = Object.fromEntries((await run(`SELECT id, codigo FROM fic_estado_visita`)).map((r) => [r.codigo, r.id]));
  const fichaMap = new Map(); const legEstadoFicha = new Map();
  const agPorFicha = new Map(); for (const a of AG) { const k = Number(a.id_fichaingresoservicio); if (!agPorFicha.has(k)) agPorFicha.set(k, []); agPorFicha.get(k).push(a); }
  for (const f of ENC) {
    const fid = Number(f.id_fichaingresoservicio); const a0 = (agPorFicha.get(fid) || [])[0] || {};
    const cod = ESTADO_FICHA[Number(f.id_validaciontecnica)]; if (!cod) warn('ficha con id_validaciontecnica desconocido', f.id_validaciontecnica);
    const emp = EMP.find((e) => Number(e.id_empresa) === Number(f.id_empresa)), srv = SRV.find((s) => Number(s.id_empresaservicio) === Number(f.id_empresaservicio));
    const cen = CEN.find((c) => Number(c.id_centro) === Number(f.id_centro)), con = CON.find((c) => Number(c.id_contacto) === Number(f.id_contacto));
    const costo = DET.find((d) => Number(d.id_fichaingresoservicio) === fid && d.tipo_analisis === 'CostoOperativo');
    const dur = num(f.ma_duracion_muestreo); const ins_ = instrumento(f.instrumento_ambiental);
    const zona = /^(\d{2}[A-Za-z])\b/.exec(norm(f.ma_coordenadas)); const idZona = zona ? zonaPorNombre.get(zona[1].toUpperCase()) ?? null : null; if (zona && !idZona) warn('zona UTM sin equivalente en geo_ (queda NULL)', zona[1]);
    const cargoNuevo = M(CT.cargo, f.id_cargo, 'cargo de la ficha');
    const id = await ins('fic_ficha', {
      tipo: t(f.tipo_fichaingresoservicio), id_empresa: empMap.get(Number(f.id_empresa)), id_empresa_servicio: srvMap.get(Number(f.id_empresaservicio)),
      id_centro: cenMap.get(Number(f.id_centro)) ?? null, id_contacto: conMap.get(Number(f.id_contacto)) ?? null,
      id_lugar_analisis: M(CT.lugar, f.id_lugaranalisis, 'lugar de análisis'), id_objetivo_muestreo: M(CT.obj, f.id_objetivomuestreo_ma, 'objetivo de muestreo'), id_instrumento_ambiental: ins_.id ?? null,
      numero_instrumento: ins_.numero ?? null, anio_instrumento: ins_.anio ?? null, id_tipo_muestreo: M(CT.tmuestreo, f.id_tipomuestreo, 'tipo de muestreo'), id_tipo_muestra: M(CT.tmuestra, f.id_tipomuestra_ma, 'tipo de muestra'),
      id_componente: M(CT.comp, f.id_tipomuestra, 'componente'), id_subarea: M(CT.sub, f.id_subarea, 'subárea'), id_actividad_muestreo: M(CT.act, f.id_actividadmuestreo, 'actividad de muestreo'), id_tipo_descarga: M(CT.desc, f.id_tipodescarga, 'tipo de descarga'),
      id_modalidad_caudal: M(CT.modal, f.id_modalidad, 'modalidad de caudal'), id_forma_canal: M(CT.forma, f.id_formacanal, 'forma de canal'), id_dispositivo_hidraulico: M(CT.disp, f.id_dispositivohidraulico, 'dispositivo hidráulico'),
      id_um_formacanal: M(CT.um, f.id_um_formacanal, 'unidad de forma de canal'), id_um_dispositivo: M(CT.um, f.id_um_dispositivohidraulico, 'unidad de dispositivo'),
      id_zona_utm: idZona, coordenadas_utm: t(f.ma_coordenadas), ubicacion: t(f.ubicacion),
      id_cargo_responsable: cargoNuevo, snap_nombre_cargo_responsable: cargoNuevo ? cargoNom.get(cargoNuevo) ?? null : null, id_persona_jefatura_tecnica: M(CT.jef, f.id_jefaturatecnica, 'jefatura técnica'),
      id_frecuencia: frMap.get(Number(a0.id_frecuencia)) ?? null, cantidad_frecuencia: num(a0.frecuencia), factor_frecuencia: num(a0.frecuencia_factor), total_servicios: num(a0.total_servicios),
      id_persona_inspector: inspMap.get(Number(a0.id_inspectorambiental)) ?? null,
      snap_nombre_empresa: t(emp?.nombre_empresa), snap_rut_empresa: t(emp?.rut_empresa), snap_rlegal_nombre: t(emp?.rlegal_nombre), snap_rlegal_rut: t(emp?.rlegal_rut),
      snap_nombre_empresa_servicio: t(srv?.nombre_empresaservicios), snap_nombre_centro: t(cen?.nombre_centro), snap_nombre_contacto: t(con?.nombre_contacto), snap_email_contacto: t(con?.email_contacto),
      snap_nombre_persona_responsable: t(f.responsablemuestreo), snap_costo_operativo_uf: num(costo?.uf_individual),
      nombre_tabla: t(f.nombre_tabla_largo), es_etfa: yes(f.etfa, false), punto_muestreo: t(f.ma_punto_muestreo),
      duracion_muestreo_hrs: dur != null ? Math.round(dur) : null, referencia_googlemaps: t(f.referencia_googlemaps),
      ubicacion_lat: num(f.ubicacion_lat), ubicacion_lon: num(f.ubicacion_lon), medicion_caudal: t(f.medicion_caudal),
      formacanal_medida: t(f.formacanal_medida), dispositivo_medida: t(f.dispositivohidraulico_medida),
      id_estado_ficha: idEstF[cod] ?? idEstF.PENDIENTE_TECNICA, es_remuestreo: f.es_remuestreo === true || f.es_remuestreo === 1,
      observaciones_comercial: t(f.observaciones_comercial)?.slice(0, 300), observaciones_tecnica: t(f.observaciones_jefaturatecnica)?.slice(0, 300), observaciones_coordinacion: t(f.observaciones_coordinador)?.slice(0, 300),
      id_usuario_creador: USR.get(Number(f.id_usuario)) ?? (Number(f.id_usuario) > 0 ? (warn('usuario creador de la ficha sin equivalente en usr_ (queda NULL)', f.id_usuario), null) : null), fecha_ficha_comercial: combine(f.fecha_fichacomercial, f.hora_fichacomercial) ?? undefined,
      fecha_jefatura_tecnica: combine(f.fecha_jefaturatecnica, f.hora_jefaturatecnica) ?? undefined, id_cotizacion: num(f.id_cotizacion) || null });
    fichaMap.set(fid, id); legEstadoFicha.set(id, idEstF[cod]);
  }
  for (const f of ENC) if (Number(f.id_ficha_original) > 0 && fichaMap.has(Number(f.id_ficha_original)))
    await run(`UPDATE fic_ficha SET id_ficha_original=@o WHERE id=@i`, { o: fichaMap.get(Number(f.id_ficha_original)), i: fichaMap.get(Number(f.id_fichaingresoservicio)) });

  const anMap = new Map(); const detPlan = new Map();
  for (const d of DET) {
    if (d.tipo_analisis === 'CostoOperativo') continue;
    const tipo = d.tipo_analisis === 'Terreno' ? 'TERRENO' : d.tipo_analisis === 'Laboratorio' ? 'LABORATORIO' : null;
    if (!tipo) { warn('análisis con tipo desconocido (no se carga)', d.tipo_analisis); continue; }
    const fid = fichaMap.get(Number(d.id_fichaingresoservicio)); const tec = tecMap.get(Number(d.id_tecnica));
    if (!fid || !tec) { warn('análisis sin ficha o técnica cargada', `${d.id_fichaingresoservicio}/${d.id_tecnica}`); continue; }
    const lab = tipo === 'LABORATORIO' ? labMap.get(Number(d.id_laboratorioensayo)) ?? null : null;
    if (tipo === 'TERRENO' && Number(d.id_laboratorioensayo) > 0) warn('análisis de terreno con laboratorio (queda NULL)', d.id_laboratorioensayo);
    anMap.set(`${Number(d.id_fichaingresoservicio)}|${Number(d.item)}`, await ins('fic_ficha_analisis', {
      id_ficha: fid, id_tecnica: tec, id_referencia_analisis: raMap.get(Number(d.id_referenciaanalisis)) ?? null, tipo_analisis: tipo, item: Number(d.item), id_laboratorio_ensayo: lab,
      id_laboratorio_ensayo_suplente: labMap.get(Number(d.id_laboratorioensayo_2)) ?? null, id_tipo_entrega: entMap.get(Number(d.id_tipoentrega)) ?? null,
      lleva_traduccion: yes(d.llevatraduccion, false), traduccion_0: t(d.traduccion_0), traduccion_1: t(d.traduccion_1),
      snap_limite_max_d: num(d.limitemax_d), snap_limite_max_h: num(d.limitemax_h), snap_lleva_error: yes(d.llevaerror, false), snap_error_min: num(d.error_min), snap_error_max: num(d.error_max),
      snap_precio_uf: num(d.uf_individual), activo: d.activo === true || d.activo === 1 }));
    detPlan.set(`${Number(d.id_fichaingresoservicio)}|${Number(d.item)}`, Number(d.id_laboratorioensayo) || 0);
  }

  const tipoFicha = new Map(ENC.map((f) => [Number(f.id_fichaingresoservicio), t(f.tipo_fichaingresoservicio)]));
  const vMap = new Map(); const vLeg = new Map(); const nVisitasProc = { INSTALACION: 0, RETIRO: 0, UNICO: 0 }; let nMed = 0;
  for (const a of AG) {
    const m = /^(\d+)-(\d+)-(Pendiente|Ejecutado)-(\d+)$/.exec(String(a.frecuencia_correlativo).trim()); if (!m) { warn('correlativo no parseable (visita no se carga)', a.frecuencia_correlativo); continue; }
    const fid = fichaMap.get(Number(a.id_fichaingresoservicio)); if (!fid) { warn('visita sin ficha cargada', a.id_agendamam); continue; }
    let cod = ESTADO_VISITA[Number(a.id_estadomuestreo)];
    if (String(a.estado_caso).trim() === 'CANCELADO' && !/CANCELADO/.test(cod || '')) { warn('visita con estado_caso CANCELADO y estado distinto (queda CANCELADO_ADL)', a.id_estadomuestreo); cod = 'CANCELADO_ADL'; }
    if (!cod) { warn('estado de visita desconocido (queda POR_ASIGNAR)', a.id_estadomuestreo); cod = 'POR_ASIGNAR'; }
    const iC = a.instalacion_completado === 'S', rC = a.retiro_completado === 'S';
    const carpeta = iC || rC ? String(a.frecuencia_correlativo).trim().replace('Pendiente', 'Ejecutado') : null;
    const vdd = num(a.vdd);
    const vid = await ins('fic_visita', {
      id_ficha: fid, numero_visita: Number(m[2]), id_estado_visita: idEstV[cod],
      id_usuario_programo: USR.get(Number(a.id_coordinador)) ?? (Number(a.id_coordinador) > 0 ? (warn('usuario que programó la visita sin equivalente en usr_ (queda NULL)', a.id_coordinador), undefined) : undefined),
      snap_nombre_usuario_programo: usrNom.get(USR.get(Number(a.id_coordinador))) ?? undefined, completada_en: a.fecha_completado instanceof Date ? a.fecha_completado : undefined,
      ruta_carpeta: carpeta, codigo_archivo_terreno: t(a.id_archivo_terreno),
      cond_flujo_laminar: sn(a.condicionmedicion_flujolaminar), cond_velocidad_uniforme: sn(a.condicionmedicion_velocidaduniforme), cond_observacion: t(a.condicionmedicion_observacion),
      vdd: vdd && vdd > 0 ? vdd : null, folio: num(a.Folio) || null, codigo_caso_adlab: t(a.caso_adlab),
      snap_nombre_confirma_caso: t(a.realizado_por_gem), caso_confirmado_en: a.fecha_realizado_gem instanceof Date ? a.fecha_realizado_gem : undefined,
      estado_facturacion: t(a.id_estado_facturacion), id_agendamam_legacy: Number(a.id_agendamam), correlativo_legacy: String(a.frecuencia_correlativo).trim() });
    vMap.set(`${Number(a.id_fichaingresoservicio)}|${String(a.frecuencia_correlativo).trim()}`, vid); vLeg.set(vid, a);
    if (a.notificado_completado === true || a.notificado_completado === 1) await run(`UPDATE fic_visita SET completado_notificado_en=SYSDATETIME() WHERE id=@i`, { i: vid });
    if (a.informe_notificado === 'S') await run(`UPDATE fic_visita SET informe_notificado_en=SYSDATETIME() WHERE id=@i`, { i: vid });

    /* procesos */
    const puntual = tipoFicha.get(Number(a.id_fichaingresoservicio)) === 'Puntual';
    if (!['Puntual', 'Compuesta'].includes(tipoFicha.get(Number(a.id_fichaingresoservicio)))) warn('tipo de ficha desconocido (se trata como Compuesta)', tipoFicha.get(Number(a.id_fichaingresoservicio)));
    const obs = (v) => { const x = t(v); return x && x !== 'Sin observaciones.' ? x.slice(0, 500) : null; };
    const proc = async (tipo, o) => {
      const done = o.completado === true;
      const pid = await ins('fic_visita_proceso', { id_visita: vid, tipo, fecha_programada: o.fecha ?? undefined, id_persona_muestreador: o.pers, snap_nombre_muestreador: done ? o.nomPers : undefined,
        id_persona_supervisor: o.sup, snap_nombre_supervisor: done && o.sup ? o.nomSup : undefined, observador_nombre: t(o.obsNom)?.slice(0, 150), observador_cargo: t(o.obsCar)?.slice(0, 100),
        observaciones: obs(o.observ), llegada_en: o.llegada instanceof Date ? o.llegada : undefined, fin_trabajo_en: o.fin instanceof Date ? o.fin : undefined, completado: done });
      nVisitasProc[tipo]++; return pid;
    };
    const med = async (pid, momento, o) => {
      const ph = num(o.ph); if (ph != null && (ph < 0 || ph > 14)) warn('pH fuera de 0–14 (queda NULL)', ph);
      const row = { medido_en: o.en ?? undefined, ph: ph != null && ph >= 0 && ph <= 14 ? ph : null, temperatura: num(o.temp), temperatura_corregida: num(o.corr), totalizador: o.tot && o.tot > 0 ? o.tot : null };
      if (Object.values(row).every((v) => v == null || v === undefined)) return;
      let eq = null; if (row.temperatura_corregida != null && Number(a.temperatura_fc) > 0) { eq = eqMap.get(Number(a.temperatura_fc)) ?? null; if (!eq) warn('termómetro de temperatura_fc no cargado', a.temperatura_fc); }
      await ins('fic_visita_medicion', { id_proceso: pid, momento, ...row, id_equipo_temperatura: eq }); nMed++;
    };
    const inicio = { en: combine(a.ma_muestreo_fechai, a.ma_muestreo_horai), ph: a.ma_phi, temp: a.ma_temperaturai, corr: a.temperatura_corregidai, tot: num(a.totalizador_inicio) };
    const termino = { en: combine(a.ma_muestreo_fechat, a.ma_muestreo_horat), ph: a.ma_pht, temp: a.ma_temperaturat, corr: a.temperatura_corregidat, tot: num(a.totalizador_final) };
    const compuesta = { en: combine(a.ma_fecha_compuesta, a.ma_hora_compuesta), ph: a.ma_ph_compuesta, temp: a.ma_temperatura_compuesta, corr: a.temperatura_corregidacompuesta };
    const sup1 = P(a.id_supervisor), supR = P(a.id_supervisor_retiro);
    if (puntual) {
      const pid = await proc('UNICO', { fecha: dateOnly(a.fecha_muestreo), pers: P(a.id_muestreador), nomPers: NP(a.id_muestreador), sup: sup1, nomSup: NP(a.id_supervisor),
        obsNom: a.nombre_observadorterreno, obsCar: a.cargo_observadorterreno, observ: a.observaciones_muestreador,
        llegada: a.retiro_hora_inicio_trabajo ?? a.instalacion_hora_inicio_trabajo, fin: a.retiro_hora_fin_trabajo ?? a.instalacion_hora_fin_trabajo, completado: iC });
      await med(pid, 'INICIO', inicio); await med(pid, 'TERMINO', termino);
    } else {
      const p1 = await proc('INSTALACION', { fecha: dateOnly(a.fecha_muestreo), pers: P(a.id_muestreador), nomPers: NP(a.id_muestreador), sup: sup1, nomSup: NP(a.id_supervisor),
        obsNom: a.nombre_observadorterreno, obsCar: a.cargo_observadorterreno, observ: a.observaciones_muestreador, llegada: a.instalacion_hora_inicio_trabajo, fin: a.instalacion_hora_fin_trabajo, completado: iC });
      const p2 = await proc('RETIRO', { fecha: dateOnly(a.fecha_retiro), pers: P(a.id_muestreador2), nomPers: NP(a.id_muestreador2), sup: supR, nomSup: NP(a.id_supervisor_retiro),
        obsNom: a.nombre_observadorterreno_retiro, obsCar: a.cargo_observadorterreno_retiro, observ: a.observaciones_muestreador2, llegada: a.retiro_hora_inicio_trabajo, fin: a.retiro_hora_fin_trabajo, completado: rC });
      await med(p1, 'INICIO', inicio); await med(p2, 'TERMINO', termino); await med(p2, 'COMPUESTA', compuesta);
    }
  }

  /* ---------- 7. Resultados y uso de equipos ---------- */
  let nRes = 0, nResSinVisita = 0, nLabEfectivo = 0;
  for (const r of RES) {
    const vid = vMap.get(`${Number(r.id_fichaingresoservicio)}|${String(r.frecuencia_correlativo).trim()}`);
    const an = anMap.get(`${Number(r.id_fichaingresoservicio)}|${Number(r.item)}`);
    if (!vid || !an) { nResSinVisita++; warn('resultado sin visita o análisis (no se carga)', `${r.id_fichaingresoservicio}|${String(r.frecuencia_correlativo).trim()}|item ${r.item}`); continue; }
    const planificado = detPlan.get(`${Number(r.id_fichaingresoservicio)}|${Number(r.item)}`) || 0;
    const real = Number(r.id_laboratorioensayo) || 0; let efectivo = null;
    if (real > 0 && planificado > 0 && real !== planificado) { efectivo = labMap.get(real) ?? null; nLabEfectivo++; }
    const cump = t(r.cumplimiento) || t(r.cumplimiento_app);
    await ins('fic_resultado', { id_visita: vid, id_ficha_analisis: an, snap_limite_max_d: num(r.limitemax_d), snap_limite_max_h: num(r.limitemax_h), snap_lleva_error: yes(r.llevaerror, false),
      snap_error_min: num(r.error_min), snap_error_max: num(r.error_max), id_persona_muestreador: P(r.id_muestreador), medido_en: combine(r.fecha_muestreador, r.hora_muestreador) ?? undefined,
      valor_texto: t(r.estado)?.slice(0, 50), cumple: cump == null ? null : /^cumple$/i.test(cump), resultado_cargado_en: combine(r.resultado_fecha, r.resultado_hora) ?? undefined,
      id_laboratorio_ensayo_efectivo: efectivo });
    nRes++;
  }
  let nUso = 0;
  for (const e of EQM) {
    const vid = vMap.get(`${Number(e.id_fichaingresoservicio)}|${String(e.frecuencia_correlativo).trim()}`); const eq = eqMap.get(Number(e.id_equipo));
    if (!vid || !eq) { warn('uso de equipo sin visita o equipo (no se carga)', `${e.id_fichaingresoservicio}|${String(e.frecuencia_correlativo).trim()}|${e.id_equipo}`); continue; }
    let h = hisMap.get(`${Number(e.id_equipo)}|${t(e.version)}`); if (!h) { warn('versión de equipo citada por un uso y ausente del historial (se crea una fila de esa versión)', `${e.id_equipo}|${e.version}`); h = await versionCitada(run, eq, e); hisMap.set(`${Number(e.id_equipo)}|${t(e.version)}`, h); }
    const est = t(e.estado) || 'ACTIVO';
    await ins('eqp_uso', { id_visita: vid, id_equipo: eq, id_equipo_historial: h, id_persona: P(e.id_muestreador), seleccionado: yes(e.seleccionado, false),
      usado_instalacion: sn(e.usado_instalacion), usado_retiro: sn(e.usado_retiro), estado: est === 'DESACTIVADO' ? 'DESACTIVADO' : 'ACTIVO',
      snap_tiene_factor_correccion: sn(e.tienefc), snap_error_0: num(e.error0), snap_error_15: num(e.error15), snap_error_30: num(e.error30) });
    nUso++;
  }

  /* ---------- 8. Conciliación ---------- */
  const esperado = { fic_ficha: ENC.length, fic_visita: AG.length, fic_ficha_analisis: DET.filter((d) => d.tipo_analisis !== 'CostoOperativo').length, fic_resultado: RES.length, eqp_uso: EQM.length };
  const filas = [];
  for (const [tb, exp] of Object.entries(esperado)) { const n = await count(tb); filas.push({ tabla: tb, legado: exp, nuevo: n, ok: n === exp ? 'OK' : 'DIFIERE' }); }
  for (const tb of ['fic_visita_proceso', 'fic_visita_medicion', 'per_persona', 'cli_empresa', 'cli_empresa_servicio', 'cli_centro', 'cli_contacto', 'cat_tecnica', 'eqp_equipo', 'eqp_historial'])
    filas.push({ tabla: tb, legado: '-', nuevo: await count(tb), ok: '' });
  console.log(`\n== CONCILIACIÓN DE CONTEOS (${APPLY ? 'con --apply' : 'ENSAYO, se revierte'}) ==`); console.table(filas);
  console.log('procesos por tipo:', JSON.stringify(nVisitasProc), '| mediciones:', nMed, '| resultados con laboratorio efectivo distinto del planificado:', nLabEfectivo);

  /* Trigger nuevo vs. legado: ANTES de restaurar los valores legado */
  const trg = await run(`SELECT v.id, v.id_agendamam_legacy leg, CASE WHEN v.informe_emitido_en IS NULL THEN 0 ELSE 1 END nuevo FROM fic_visita v`);
  let coinciden = 0, difieren = []; for (const x of trg) { const a = vLeg.get(x.id); const leg1 = a.informe_emitido === 'S' ? 1 : 0; if (leg1 === x.nuevo) coinciden++; else difieren.push({ visita_legacy: x.leg, legado: leg1, trigger_nuevo: x.nuevo, estado_legacy: a.id_estadomuestreo }); }
  console.log(`\n== TRIGGER NUEVO vs INFORME EMITIDO DEL LEGADO ==\nvisitas que coinciden: ${coinciden} de ${trg.length}; difieren: ${difieren.length}`); if (difieren.length) console.table(difieren.slice(0, 15));
  const estF = await run(`SELECT f.id, f.id_estado_ficha e FROM fic_ficha f`); const cambiadas = estF.filter((x) => x.e !== legEstadoFicha.get(x.id)).length;
  console.log(`fichas cuyo estado cambió por el trigger durante la carga: ${cambiadas}`);

  /* Restaurar los valores del legado (el trigger los pudo modificar al cargar) */
  for (const [vid, a] of vLeg) await run(`UPDATE fic_visita SET informe_emitido_en=@f WHERE id=@i`, { i: vid, f: a.informe_emitido === 'S' ? (a.fecha_informe_emitido instanceof Date ? a.fecha_informe_emitido : new Date()) : null });
  for (const [fid, est] of legEstadoFicha) await run(`UPDATE fic_ficha SET id_estado_ficha=@e WHERE id=@i`, { i: fid, e: est });

  /* ---------- 9. Avisos ---------- */
  console.log('\n== AVISOS DE CALIDAD DE DATOS ==');
  if (!warns.size) console.log('ninguno'); for (const [k, w] of warns) console.log(`- ${k}: ${w.n}${w.ej.length ? '  ej: ' + w.ej.join(' | ') : ''}`);

  if (APPLY) { await tx.commit(); console.log('\nCOMMIT realizado en', TEST_DB); } else { await tx.rollback(); console.log('\nROLLBACK (ensayo): no se guardó nada. Usa --apply para confirmar.'); }
} catch (e) {
  try { await tx.rollback(); } catch {}
  console.error('\nERROR — se revirtió todo:', e.message); if (e.precedingErrors?.length) console.error(e.precedingErrors.map((x) => x.message).join('\n'));
  process.exitCode = 1;
} finally { await leg.close(); await dst.close(); }
