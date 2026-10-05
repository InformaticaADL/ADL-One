/* =====================================================================
   Migración del módulo cli_ : legado (PruebasInformatica) → esquema v5
   =====================================================================
   Uso:
     node src/scripts/migracion-cli.mjs                 → ensayo: carga y hace ROLLBACK
     node src/scripts/migracion-cli.mjs --apply         → carga y confirma (COMMIT)
     node src/scripts/migracion-cli.mjs --apply --reset → borra lo cli_ previo y recarga
       (antes: node src/scripts/migracion-fic.mjs --solo-reset --reset --apply,
        porque las fichas de prueba referencian cli_)

   SEGURIDAD: del legado solo lee; solo escribe en una base cuyo nombre contenga "TEST";
   una transacción; sin --apply termina en ROLLBACK. Requiere geo_ y per_ ya migrados.

   REGLAS
     - Se cargan TODAS las filas (nada se fusiona solo). Los posibles duplicados van a
       revision_duplicado (PENDIENTE) para revisarlos en la pantalla de ADL ONE.
     - Empresa (mae_empresa → cli_empresa): el RUT es único en el nuevo esquema. RUT repetido:
       queda con el RUT la mejor fila (habilitada, luego id menor) y las demás con "RUT#id";
       cada par va a la cola (CLI_EMPRESA / MISMO_RUT). RUT vacío o de relleno (00000000-0, NA…)
       → "SIN-RUT-id", sin par. Mismo nombre con RUT distinto → par MISMO_NOMBRE.
     - Servicio (mae_empresaservicios → cli_empresa_servicio): el padre sale de
       mae_empresa.id_empresaservicio; si no, empresa de igual RUT; si no, empresa de las fichas
       o de sus contactos. Sin padre no se carga (se informa). Pares por RUT → CLI_SERVICIO.
     - Centro (mae_centro → cli_centro): geo por mig_id_map. Se vincula (cli_empresa_centro) al
       servicio de su empresa y a los pares (centro, servicio) de las fichas.
       Pares para revisar: mismo nombre y misma empresa; o ≤100 m con coordenadas confiables
       (una coordenada es confiable si la comparten ≤2 nombres distintos).
     - Contacto: al servicio indicado; si no, al servicio de su empresa. Cargo vía mig_id_map.
   ===================================================================== */
import dotenv from 'dotenv'; dotenv.config();
import sql from 'mssql';
import { CONTACTO_MANUAL } from '../sync/datos/contactosManuales.js';

const APPLY = process.argv.includes('--apply');
const RESET = process.argv.includes('--reset');
const TEST_DB = process.env.MIG_TEST_DB || 'ADL ONE TEST';
if (!/TEST/i.test(TEST_DB)) { console.error(`ABORTADO: la base destino "${TEST_DB}" no contiene "TEST".`); process.exit(1); }

const cfg = (database) => ({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database,
  requestTimeout: 120000, options: { encrypt: true, trustServerCertificate: true } });
const leg = await new sql.ConnectionPool(cfg(process.env.DB_DATABASE)).connect();
const dst = await new sql.ConnectionPool(cfg(TEST_DB)).connect();
const L = async (q) => (await leg.request().query(q)).recordset;
const tx = new sql.Transaction(dst); await tx.begin();
const run = async (text, params = {}) => { const rq = new sql.Request(tx); for (const [k, v] of Object.entries(params)) rq.input(k, v === undefined ? null : v); return (await rq.query(text)).recordset; };
const ins = async (table, obj) => {
  const e = Object.entries(obj).filter(([, v]) => v !== undefined);
  const params = Object.fromEntries(e.map(([, v], i) => [`p${i}`, v]));
  return (await run(`DECLARE @o TABLE (id INT); INSERT INTO ${table} (${e.map(([k]) => `[${k}]`).join(',')}) OUTPUT INSERTED.id INTO @o VALUES (${e.map((_, i) => `@p${i}`).join(',')}); SELECT id FROM @o;`, params))[0].id;
};
const mapear = (tl, il, tn, inu, nota = null) => run(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo, nota) VALUES (@a,@b,@c,@d,@e)`, { a: tl, b: il, c: tn, d: inu, e: nota });
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const t = (s) => norm(s) || null;
const num = (v) => { if (v == null || norm(v) === '') return null; const n = Number(norm(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const yes = (v, def = false) => { if (v === true || v === 1) return true; if (v === false || v === 0) return false; const x = norm(v); return x === '' ? def : /^(S|SI|1|TRUE)$/i.test(x); };
const warns = new Map(); const warn = (k, ej) => { const w = warns.get(k) || { n: 0, ej: [] }; w.n++; if (w.ej.length < 4 && ej != null) w.ej.push(ej); warns.set(k, w); };
const cortar = (s, n, k) => { const x = t(s); if (x && x.length > n) { warn(`${k}: texto truncado a ${n}`, x.slice(0, 30)); return x.slice(0, n); } return x; };
const clave = (s) => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]/g, '').replace(/\s+/g, ' ').trim();
const rutClave = (s) => { const x = norm(s).replace(/[.\s-]/g, '').toLowerCase(); return /^0*$/.test(x) || /^([0-9])\1+[0-9k]?$/.test(x) || /^(na|nd|sn|noaplica|noinformado)$/.test(x) ? null : x; };
const pareceRut = (x) => /^[0-9][0-9.]*-?[0-9kK]$/.test(norm(x));
const coordOk = (lat, lon) => lat != null && lon != null && Math.abs(lat) > 0.0001 && Math.abs(lon) > 0.0001 && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
const enChile = (lat, lon) => lat >= -56 && lat <= -17 && lon >= -80 && lon <= -66;   // continente e islas (Juan Fernández -78,8)
const metros = (a, b, c, d) => { const R = 6371000, r = Math.PI / 180, dp = (c - a) * r, dl = (d - b) * r;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

try {
  const TABLAS = ['cli_contacto', 'cli_empresa_centro', 'cli_centro', 'cli_empresa_servicio', 'cli_empresa'];
  let previo = 0; for (const tb of TABLAS) previo += (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  if (previo > 0 && !RESET) throw new Error('Las tablas cli_ ya tienen datos. Usa --reset para borrarlas y recargar.');
  if (RESET) {
    await run(`DELETE FROM revision_duplicado WHERE entidad IN ('CLI_EMPRESA','CLI_SERVICIO','CLI_CENTRO')`);
    await run(`DELETE FROM mig_id_map WHERE tabla_nueva LIKE 'cli[_]%'`);
    for (const tb of TABLAS) { try { await run(`DELETE FROM ${tb}`); } catch (e) { throw new Error(`No se pudo vaciar ${tb}: hay filas que la referencian (fichas de prueba). Ejecuta antes migracion-fic.mjs --solo-reset --reset --apply. Detalle: ${e.message}`); } }
  }
  const desdeMapa = async (tl) => new Map((await run(`SELECT id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado=@t`, { t: tl })).map((r) => [Number(r.id_legado), r.id_nuevo]));
  const GEO = { comuna: await desdeMapa('mae_comuna'), zona: await desdeMapa('mae_zonas'), sector: await desdeMapa('mae_zonageografica'), barrio: await desdeMapa('mae_barrio'), agua: await desdeMapa('mae_tipoagua'), utm: await desdeMapa('mae_zonautm'), region: await desdeMapa('mae_region') };
  // Coordenadas de respaldo (mae_centro.ma_latitud / ma_longitud): texto con coma decimal ("-41,44090") o en grados ("41°30'18,19''").
  // Solo se usan cuando el centro no trae latitud/longitud decimales. En grados sin signo se asume hemisferio sur / oeste (Chile).
  const coordTexto = (v) => {
    const x = norm(v); if (!x || x === '0') return null;
    const d = /^(-?)(\d+)[°º]\s*(\d+)['′]\s*([\d.,]+)/.exec(x);
    if (d) { const g = Number(d[2]) + Number(d[3]) / 60 + Number(d[4].replace(',', '.')) / 3600; return -g; }
    const n = Number(x.replace(',', '.')); return Number.isFinite(n) ? n : null;
  };
  const ESQUEMAS = new Map([['precio lista', 'Precio lista'], ['precio convenio', 'Precio convenio'], ['precio recargo', 'Precio recargo']]);
  const CARGO = await desdeMapa('mae_cargo');
  if (!GEO.comuna.size) throw new Error('geo_ no está migrado (mig_id_map sin mae_comuna). Ejecuta antes migracion-geo.mjs.');

  const EMP = await L(`SELECT * FROM mae_empresa ORDER BY id_empresa`);
  const SRV = await L(`SELECT * FROM mae_empresaservicios ORDER BY id_empresaservicio`);
  const CEN = await L(`SELECT * FROM mae_centro ORDER BY id_centro`);
  const CON = await L(`SELECT * FROM mae_contacto ORDER BY id_contacto`);
  const ENC = await L(`SELECT id_empresa, id_empresaservicio, id_centro, COUNT(*) n FROM App_Ma_FichaIngresoServicio_ENC GROUP BY id_empresa, id_empresaservicio, id_centro`);
  const fichasEmp = new Map(), fichasCen = new Map(), fichasSrv = new Map();
  for (const f of ENC) { const n = Number(f.n); const add = (m, k) => m.set(Number(k), (m.get(Number(k)) || 0) + n); add(fichasEmp, f.id_empresa); add(fichasCen, f.id_centro); add(fichasSrv, f.id_empresaservicio); }

  /* ---------- 1. Empresas ---------- */
  const mejor = (a, b) => (yes(b.habilitado) - yes(a.habilitado)) || (Number(a.id_empresa) - Number(b.id_empresa));
  const grupoRut = new Map();
  for (const e of [...EMP].sort(mejor)) { const k = rutClave(e.rut_empresa); if (k) { (grupoRut.get(k) || grupoRut.set(k, []).get(k)).push(e); } }
  const rlegal = (e) => { let n = t(e.rlegal_nombre), r = t(e.rlegal_rut);
    if (r && !pareceRut(r) && n && pareceRut(n)) { warn('empresa: nombre y RUT del representante legal venían intercambiados (se corrigió)', Number(e.id_empresa)); [n, r] = [r, n]; }
    else if (r && r.length > 20) { warn('empresa.rlegal_rut no es un RUT (se pasa a nombre si estaba vacío)', r.slice(0, 30)); if (!n) n = r; r = null; }
    return { rlegal_nombre: n ?? undefined, rlegal_rut: r ?? undefined }; };
  const empMap = new Map(), empFila = new Map(); const empresaPar = [];
  for (const e of EMP) {
    const idL = Number(e.id_empresa); const k = rutClave(e.rut_empresa); let rut;
    if (!k) { rut = `SIN-RUT-${idL}`; warn('empresa sin RUT o con RUT de relleno (queda SIN-RUT-id)', norm(e.rut_empresa) || '(vacío)'); }
    else { const g = grupoRut.get(k); rut = g[0] === e ? norm(e.rut_empresa) : `${norm(e.rut_empresa)}#${idL}`; }
    if (rut.length > 20) { warn('RUT de empresa recortado a 20', rut); rut = rut.slice(0, 20); }
    const id = await ins('cli_empresa', { rut, razon_social: (t(e.nombre_empresa) || `Empresa ${idL}`).slice(0, 200), nombre_fantasia: t(e.nombre_fantasia), direccion: t(e.direccion_empresa), email: t(e.email_empresa),
      telefono: cortar(e.fono_empresa, 60, 'empresa.telefono'), ...rlegal(e), rlegal_direccion: t(e.rlegal_direccion), habilitado: yes(e.habilitado) });
    empMap.set(idL, id); empFila.set(idL, e); await mapear('mae_empresa', idL, 'cli_empresa', id, rut.includes('#') ? 'RUT repetido: sufijado' : null);
  }
  const resumenEmp = (e) => ({ legado_id: Number(e.id_empresa), nombre: norm(e.nombre_empresa), fantasia: t(e.nombre_fantasia), rut: norm(e.rut_empresa), habilitada: yes(e.habilitado), fichas: fichasEmp.get(Number(e.id_empresa)) || 0, direccion: t(e.direccion_empresa), email: t(e.email_empresa) });
  const yaEmp = new Set();
  const parEmp = (a, b, criterio, obs) => { const k = [Number(a.id_empresa), Number(b.id_empresa)].sort((x, y) => x - y).join('|'); if (yaEmp.has(k)) return; yaEmp.add(k);
    empresaPar.push({ a: empMap.get(Number(a.id_empresa)), b: empMap.get(Number(b.id_empresa)), criterio, det: { a: resumenEmp(a), b: resumenEmp(b) }, obs }); };
  for (const g of grupoRut.values()) for (const o of g.slice(1)) parEmp(g[0], o, 'MISMO_RUT', 'Mismo RUT; la segunda se cargó con sufijo #id');
  const porNombre = new Map(); for (const e of [...EMP].sort(mejor)) { const k = clave(e.nombre_empresa); if (k) (porNombre.get(k) || porNombre.set(k, []).get(k)).push(e); }
  for (const g of porNombre.values()) for (const o of g.slice(1)) parEmp(g[0], o, 'MISMO_NOMBRE', 'Mismo nombre con RUT distinto');

  /* ---------- 2. Servicios ---------- */
  const srvDeEmpresa = new Map(); // empresa legado → servicio legado (mae_empresa.id_empresaservicio)
  const padresPorSrv = new Map();
  for (const e of [...EMP].sort(mejor)) { const s = Number(e.id_empresaservicio); if (s > 0) { srvDeEmpresa.set(Number(e.id_empresa), s); (padresPorSrv.get(s) || padresPorSrv.set(s, []).get(s)).push(Number(e.id_empresa)); } }
  const empPorRut = new Map(); for (const [k, g] of grupoRut) empPorRut.set(k, Number(g[0].id_empresa));
  const padreFicha = new Map(); for (const f of ENC) { const s = Number(f.id_empresaservicio), e = Number(f.id_empresa); if (s > 0 && e > 0 && !padreFicha.has(s)) padreFicha.set(s, e); }
  const padreContacto = new Map(); for (const c of CON) { const s = Number(c.id_empresaservicio), e = Number(c.id_empresa); if (s > 0 && e > 0 && empMap.has(e) && !padreContacto.has(s)) padreContacto.set(s, e); }
  const rutDerivado = new Set(); const srvMap = new Map(), srvFila = new Map(), srvPadre = new Map(); const origen = { empresa: 0, rut: 0, ficha: 0, contacto: 0, derivada: 0 }; const sinPadre = [];
  for (const s of SRV) {
    const idL = Number(s.id_empresaservicio); let padre = null, via = null;
    const cand = padresPorSrv.get(idL);
    if (cand?.length) { padre = cand[0]; via = 'empresa'; if (cand.length > 1) warn('servicio referenciado por varias empresas (padre = la mejor; ver cola CLI_EMPRESA)', `${idL}: ${cand.join(',')}`); }
    else if (rutClave(s.rut_empresaservicios) && empPorRut.has(rutClave(s.rut_empresaservicios))) { padre = empPorRut.get(rutClave(s.rut_empresaservicios)); via = 'rut'; }
    else if (padreFicha.has(idL)) { padre = padreFicha.get(idL); via = 'ficha'; }
    else if (padreContacto.has(idL)) { padre = padreContacto.get(idL); via = 'contacto'; }
    if ((!padre || !empMap.has(padre)) && yes(s.habilitado) && norm(s.nombre_empresaservicios)) {
      const k = rutClave(s.rut_empresaservicios); const rut = (k && !empPorRut.has(k) && !rutDerivado.has(k) && norm(s.rut_empresaservicios).length <= 20) ? norm(s.rut_empresaservicios) : `SIN-RUT-S${idL}`; if (k) rutDerivado.add(k);
      const idE = await ins('cli_empresa', { rut, razon_social: norm(s.nombre_empresaservicios).slice(0, 200), nombre_fantasia: t(s.nombre_fantasia), direccion: t(s.direccion_empresaservicios), email: t(s.email_empresaservicios), habilitado: true });
      await mapear('mae_empresaservicios#empresa_derivada', idL, 'cli_empresa', idE, 'servicio habilitado sin empresa padre: se creó su empresa'); padre = -idL; empMap.set(padre, idE); empFila.set(padre, { nombre_empresa: s.nombre_empresaservicios, rut_empresa: s.rut_empresaservicios }); via = 'derivada';
      warn('servicio habilitado sin empresa: se creó una empresa derivada del servicio', `${idL} ${norm(s.nombre_empresaservicios)}`);
    }
    if (!padre || !empMap.has(padre)) { sinPadre.push(idL); warn('servicio sin empresa padre, deshabilitado o vacío (NO se carga)', `${idL} ${norm(s.nombre_empresaservicios)}`); continue; }
    origen[via]++;
    const id = await ins('cli_empresa_servicio', { id_empresa: empMap.get(padre), nombre: (t(s.nombre_empresaservicios) || `Servicio ${idL}`).slice(0, 200), rut: cortar(s.rut_empresaservicios, 20, 'servicio.rut'),
      direccion: t(s.direccion_empresaservicios), email: t(s.email_empresaservicios), telefono: cortar(s.fono_empresaservicios, 100, 'servicio.telefono'), giro: t(s.giro_empresaservicios),
      id_comuna: GEO.comuna.get(Number(s.id_comuna)) ?? undefined, contacto_nombre: t(s.contacto_empresaservicios), contacto_email: t(s.email_contacto), contacto_telefono: cortar(s.fono_contacto, 100, 'servicio.contacto_telefono'),
      email_facturacion: t(s.email_facturacion), requiere_oc: yes(s.mam_oc), habilitado: yes(s.habilitado),
      ciudad: cortar(s.ciudad_empresaservicios, 100, 'servicio.ciudad') ?? undefined, esquema_precio: ESQUEMAS.get(norm(s.precio_lista).toLowerCase()) ?? (norm(s.precio_lista) ? (warn('servicio con esquema de precio no válido (queda vacío)', norm(s.precio_lista)), undefined) : undefined),
      precio_especial: yes(s.precio_especial), cobra_costo_operativo: yes(s.costo_op), factor_km: num(s.factor_km) ?? undefined, tablact: yes(s.tablact) });
    srvMap.set(idL, id); srvFila.set(idL, s); srvPadre.set(idL, padre); await mapear('mae_empresaservicios', idL, 'cli_empresa_servicio', id, `padre por ${via}`);
  }
  const resumenSrv = (s) => ({ legado_id: Number(s.id_empresaservicio), nombre: norm(s.nombre_empresaservicios), rut: norm(s.rut_empresaservicios), habilitado: yes(s.habilitado), fichas: fichasSrv.get(Number(s.id_empresaservicio)) || 0, empresa: norm(empFila.get(srvPadre.get(Number(s.id_empresaservicio)))?.nombre_empresa), email_facturacion: t(s.email_facturacion) });
  const servicioPar = []; const gsrv = new Map();
  for (const s of [...srvFila.values()].sort((a, b) => (yes(b.habilitado) - yes(a.habilitado)) || (Number(a.id_empresaservicio) - Number(b.id_empresaservicio)))) { const k = rutClave(s.rut_empresaservicios); if (k) (gsrv.get(k) || gsrv.set(k, []).get(k)).push(s); }
  for (const g of gsrv.values()) for (const o of g.slice(1)) servicioPar.push({ a: srvMap.get(Number(g[0].id_empresaservicio)), b: srvMap.get(Number(o.id_empresaservicio)), criterio: 'MISMO_RUT', det: { a: resumenSrv(g[0]), b: resumenSrv(o) }, obs: 'Mismo RUT de facturación' });

  /* ---------- 3. Centros ---------- */
  const cenMap = new Map(), cenFila = new Map(), cenCoord = new Map(); let sinGeo = 0;
  for (const c of CEN) {
    const idL = Number(c.id_centro); let lat0 = num(c.latitud) || num(c.geo_latitud), lon0 = num(c.longitud) || num(c.geo_longitud);
    if (!coordOk(lat0, lon0)) { const la = coordTexto(c.ma_latitud), lo = coordTexto(c.ma_longitud); if (coordOk(la, lo) && enChile(la, lo)) { lat0 = la; lon0 = lo; warn('centro sin coordenadas decimales: se recuperaron de ma_latitud/ma_longitud', idL); } else if (coordOk(la, lo)) warn('ma_latitud/ma_longitud fuera de Chile (NO se usan)', `${idL}: ${la},${lo}`); }
    if (coordOk(lat0, lon0) && !enChile(lat0, lon0)) warn('centro con coordenadas fuera de Chile (se cargan tal cual; revisar: ¿invertidas o sin signo?)', `${idL}: ${lat0},${lon0}`);
    const okc = coordOk(lat0, lon0); if (!okc && (lat0 || lon0)) warn('centro con coordenadas inválidas (quedan vacías)', `${idL}: ${lat0},${lon0}`);
    const id = await ins('cli_centro', { nombre: (t(c.nombre_centro) || `Centro ${idL}`).slice(0, 150), codigo: cortar(c.codigo_centro, 60, 'centro.codigo'),
      latitud: okc ? Math.round(lat0 * 1e7) / 1e7 : undefined, longitud: okc ? Math.round(lon0 * 1e7) / 1e7 : undefined, utm_norte: num(c.utm_norte) || undefined, utm_este: num(c.utm_este) || undefined,
      ubicacion: t(c.ubicacion), habilitado: yes(c.vigente), id_region: GEO.region.get(Number(c.id_region)) ?? undefined,
      observaciones: (String(c.observaciones ?? '').trim() || undefined)?.slice(0, 500), nombre_corto: cortar(c.nombre_corto, 100, 'centro.nombre_corto') ?? undefined, nombre_alternativo: cortar(c.nombre_alternativo, 120, 'centro.nombre_alternativo') ?? undefined,
      id_comuna: GEO.comuna.get(Number(c.id_comuna)) ?? undefined, id_zona: GEO.zona.get(Number(c.id_zona)) ?? undefined, id_sector: GEO.sector.get(Number(c.id_zonageografica)) ?? undefined,
      id_barrio: GEO.barrio.get(Number(c.id_barrio)) ?? undefined, id_tipo_agua: GEO.agua.get(Number(c.id_tipoagua)) ?? undefined });
    if (!GEO.comuna.get(Number(c.id_comuna))) sinGeo++;
    cenMap.set(idL, id); cenFila.set(idL, c); if (okc) cenCoord.set(idL, [lat0, lon0]); await mapear('mae_centro', idL, 'cli_centro', id);
  }
  // vínculos centro ↔ servicio
  const vinc = new Set(); let nVinc = 0, sinServicio = 0, difFicha = 0;
  const vincular = async (cl, sl) => { const c = cenMap.get(cl), s = srvMap.get(sl); if (!c || !s) return false; const k = `${c}|${s}`; if (vinc.has(k)) return true; vinc.add(k);
    await ins('cli_empresa_centro', { id_centro: c, id_empresa_servicio: s, habilitado: yes(cenFila.get(cl).vigente) }); nVinc++; return true; };
  for (const c of CEN) { const cl = Number(c.id_centro); const sl = srvDeEmpresa.get(Number(c.id_empresa)); if (!(sl && await vincular(cl, sl))) { sinServicio++; } }
  for (const f of ENC) { const cl = Number(f.id_centro), sl = Number(f.id_empresaservicio); if (cenMap.has(cl) && srvMap.has(sl)) { if (!vinc.has(`${cenMap.get(cl)}|${srvMap.get(sl)}`)) difFicha++; await vincular(cl, sl); } }
  if (difFicha) warn('vínculo centro-servicio que solo existe por las fichas (no por la empresa del centro)', difFicha);

  // pares de centros a revisar
  const nombreCentro = (c) => clave(c.nombre_centro);
  const nombresPorCoord = new Map(); const ckey = (ll) => `${ll[0].toFixed(5)}|${ll[1].toFixed(5)}`;
  for (const [id, ll] of cenCoord) { const k = ckey(ll); (nombresPorCoord.get(k) || nombresPorCoord.set(k, new Set()).get(k)).add(nombreCentro(cenFila.get(id))); }
  const confiable = (id) => cenCoord.has(id) && nombresPorCoord.get(ckey(cenCoord.get(id))).size <= 2;
  const resumenCen = (c) => { const id = Number(c.id_centro); const ll = cenCoord.get(id); const e = empFila.get(Number(c.id_empresa)); return { legado_id: id, nombre: norm(c.nombre_centro), codigo: t(c.codigo_centro), empresa: norm(e?.nombre_empresa) || null, rut: norm(e?.rut_empresa) || null,
    lat: ll?.[0] ?? null, lon: ll?.[1] ?? null, habilitado: yes(c.vigente), fichas: fichasCen.get(id) || 0, ubicacion: t(c.ubicacion) }; };
  const yaCen = new Set(); const centroPar = []; const cnt = { nombreEmpresa: 0, coord: 0, sinCoordConfiable: 0 };
  const parCen = (a, b, criterio, obs) => { const ia = Number(a.id_centro), ib = Number(b.id_centro); const k = ia < ib ? `${ia}|${ib}` : `${ib}|${ia}`; if (yaCen.has(k)) return; yaCen.add(k);
    const d = cenCoord.has(ia) && cenCoord.has(ib) && confiable(ia) && confiable(ib) ? metros(...cenCoord.get(ia), ...cenCoord.get(ib)) : null;
    centroPar.push({ a: cenMap.get(ia), b: cenMap.get(ib), criterio, dist: d, det: { a: resumenCen(a), b: resumenCen(b) }, obs }); };
  const mejorC = (a, b) => (yes(b.vigente) - yes(a.vigente)) || (Number(a.id_centro) - Number(b.id_centro));
  const gne = new Map(); for (const c of [...CEN].sort(mejorC)) { const k = `${nombreCentro(c)}|${Number(c.id_empresa)}`; if (nombreCentro(c)) (gne.get(k) || gne.set(k, []).get(k)).push(c); }
  for (const g of gne.values()) for (const o of g.slice(1)) { parCen(g[0], o, 'MISMO_NOMBRE_MISMA_EMPRESA', 'Mismo nombre y misma empresa'); cnt.nombreEmpresa++; }
  const celda = new Map(); const CEL = 0.002; const cid = (ll) => [Math.floor(ll[0] / CEL), Math.floor(ll[1] / CEL)];
  for (const [id, ll] of cenCoord) if (confiable(id)) { const [x, y] = cid(ll); const k = `${x}|${y}`; (celda.get(k) || celda.set(k, []).get(k)).push(id); }
  for (const [id, ll] of cenCoord) { if (!confiable(id)) continue; const [x, y] = cid(ll);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const o of celda.get(`${x + dx}|${y + dy}`) || []) { if (o <= id) continue;
      if (metros(...ll, ...cenCoord.get(o)) <= 100) { const before = yaCen.size; parCen(cenFila.get(id), cenFila.get(o), 'COORDENADAS_CERCANAS', 'A 100 m o menos, coordenadas confiables'); if (yaCen.size > before) cnt.coord++; } } }
  cnt.sinCoordConfiable = [...cenFila.keys()].filter((id) => cenCoord.has(id) && !confiable(id)).length;

  /* ---------- 4. Contactos ---------- */
  // Contactos habilitados cuyo id_empresa (689-694) no existe en mae_empresa (llega a 688) y con servicio 0.
  // Enlazados por evidencia: dominio del correo (bajatrout→BAJA TROUT, glaciarsur→GLACIARSUR, multi-xsalmon→Multiexport)
  // y por compartir el mismo id_empresa erróneo (3223 con 3222). 3220 (gmail) y 3228 (sealand) quedan sin cargar.
  // (la tabla vive en src/sync/datos/contactosManuales.js: la comparte el motor de sincronización)
  let nCon = 0, sinSrvCon = 0, sinCargo = 0;
  for (const c of CON) {
    const idL = Number(c.id_contacto); let sl = Number(c.id_empresaservicio); if (!srvMap.has(sl)) sl = srvDeEmpresa.get(Number(c.id_empresa));
    if (!srvMap.has(sl) && CONTACTO_MANUAL.has(idL) && srvMap.has(CONTACTO_MANUAL.get(idL))) { sl = CONTACTO_MANUAL.get(idL); warn('contacto enlazado a mano por evidencia (ver CONTACTO_MANUAL)', idL); }
    if (!srvMap.has(sl)) { sinSrvCon++; warn(yes(c.habilitado) ? 'contacto HABILITADO sin servicio (NO se carga)' : 'contacto deshabilitado y sin servicio (NO se carga)', idL); continue; }
    const cargoL = Number(c.id_cargo); const cargo = CARGO.get(cargoL); if (cargoL > 0 && !cargo) { sinCargo++; warn('contacto con cargo que no existe en per_cargo (queda vacío)', cargoL); }
    const id = await ins('cli_contacto', { id_empresa_servicio: srvMap.get(sl), nombre: (t(c.nombre_contacto) || `Contacto ${idL}`).slice(0, 150), email: cortar(c.email_contacto, 150, 'contacto.email'),
      telefono: cortar(c.fono_contacto, 50, 'contacto.telefono'), id_cargo: cargo ?? undefined, habilitado: yes(c.habilitado) });
    await mapear('mae_contacto', idL, 'cli_contacto', id); nCon++;
  }

  /* ---------- 5. Cola de revisión ---------- */
  const cola = async (entidad, p) => ins('revision_duplicado', { entidad, id_registro_a: p.a, id_registro_b: p.b, criterio: p.criterio, distancia_metros: p.dist != null ? Math.round(p.dist * 100) / 100 : undefined, detalle_json: JSON.stringify(p.det), observacion: p.obs });
  for (const p of empresaPar) await cola('CLI_EMPRESA', p);
  for (const p of servicioPar) await cola('CLI_SERVICIO', p);
  for (const p of centroPar) await cola('CLI_CENTRO', p);

  /* ---------- Conciliación ---------- */
  const cuenta = async (tb) => (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  console.log(`\n== Conciliación (${APPLY ? 'APLICAR' : 'ENSAYO'} en [${TEST_DB}]) ==`);
  console.table([
    { tabla: 'empresas', legado: EMP.length, nuevo: await cuenta('cli_empresa') },
    { tabla: 'servicios', legado: SRV.length, nuevo: await cuenta('cli_empresa_servicio') },
    { tabla: 'centros', legado: CEN.length, nuevo: await cuenta('cli_centro') },
    { tabla: 'contactos', legado: CON.length, nuevo: await cuenta('cli_contacto') },
    { tabla: 'vínculos centro↔servicio', legado: '—', nuevo: await cuenta('cli_empresa_centro') },
  ]);
  console.log('padre de los servicios (origen):', JSON.stringify(origen), '| sin padre:', sinPadre.length);
  console.log(`centros sin servicio vinculado: ${sinServicio} | sin comuna resuelta: ${sinGeo} | con coordenadas: ${cenCoord.size} (confiables: ${[...cenCoord.keys()].filter(confiable).length}, no confiables: ${cnt.sinCoordConfiable})`);
  console.log(`contactos sin servicio: ${sinSrvCon} | cargo no resuelto: ${sinCargo}`);
  console.table((await run(`SELECT entidad, criterio, COUNT(*) pares FROM revision_duplicado WHERE entidad LIKE 'CLI[_]%' GROUP BY entidad, criterio ORDER BY 1,2`)));
  console.log('\n== Advertencias =='); for (const [k, w] of warns) console.log(`  ${w.n} × ${k}${w.ej.length ? '  ej: ' + w.ej.join(' | ') : ''}`);
  if (APPLY) { await tx.commit(); console.log('\nCOMMIT realizado.'); } else { await tx.rollback(); console.log('\nENSAYO: ROLLBACK (nada se guardó). Usa --apply para confirmar.'); }
} catch (e) { try { await tx.rollback(); } catch {} console.error('\nERROR (ROLLBACK):', e.message); process.exitCode = 1; }
finally { await leg.close(); await dst.close(); }
