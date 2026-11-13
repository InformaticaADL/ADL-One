// REPRODUCE EN ADL ONE (copia local) lo que el equipo hizo en ADLSOFT, a partir de las facturas de ADLSOFT ya cargadas en
// LaboratorioADL_comparacion (cargar-facturas-adlsoft.cjs). NO elimina nada: parte de los casos pendientes de la copia.
//   node reproducir-corrida.mjs <contraseña sa local> --desde=<id>                 -> solo muestra el PLAN (no escribe)
//   node reproducir-corrida.mjs <contraseña sa local> --desde=<id> --ejecutar      -> valoriza y crea las prefacturas
// Opciones: --manuales=archivo.json   valores escritos a mano en ADLSOFT, [{id_caso,item,id_tecnica,n_analisis,vtaunitario}], se aplican tras valorizar
//           --manuales-auto           deduce los valores a mano: líneas que ADLSOFT dejó con valor y que en la copia quedan en 0 tras valorizar (SAMIC, derivaciones)
//           --uf=NNN.NN               forzar la UF (si el equipo escribió otra que la guardada en la factura)
//           --salida=archivo.json     bitácora de lo ejecutado (por defecto reproduccion-<fecha>.json)
//           --solo=ID,ID              reproducir solo las corridas que contienen esas facturas de ADLSOFT
// Una «corrida» = facturas de ADLSOFT con la misma empresa, programa, UF y rango de proceso: ADLSOFT las creó con una sola valorización.
// Las corridas se ejecutan en el orden en que ADLSOFT creó su primera factura (para que los números internos tengan opción de coincidir).
process.chdir('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone');
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { sql, conectarLocal } = require('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/scripts/pruebas-salud/comparacion/lib-facturas.cjs');
const base = 'file:///C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/src/';
const pwd = process.argv[2];
const arg = (n, d) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').split('=').slice(1).join('=') || d;
const desde = Number(arg('desde', 0)); const ejecutar = process.argv.includes('--ejecutar');
const num = (v) => Number(v) || 0; const txt = (x) => String(x ?? '').trim();
if (!pwd || !desde) { console.log('Uso: node reproducir-corrida.mjs <pwd sa local> --desde=<id> [--ejecutar] [--manuales=a.json] [--uf=N] [--solo=ID,ID]'); process.exit(1); }

// ---- lo que hizo ADLSOFT (base de comparación) --------------------------------------------------------------------------------
const cmp = await conectarLocal(pwd, 'LaboratorioADL_comparacion');
const filas = (await cmp.request().query("SELECT tabla, id_facturacion, clave, fila FROM dbo.filas WHERE origen = 'ADLSOFT' AND id_facturacion > " + desde)).recordset.map((r) => ({ ...r, fila: JSON.parse(r.fila) }));
await cmp.close();
const encs = filas.filter((f) => f.tabla === 'facturacion_enc').map((f) => f.fila).sort((a, b) => a.id_facturacion - b.id_facturacion);
if (!encs.length) { console.log('No hay facturas de ADLSOFT cargadas con id >', desde, '(¿corriste cargar-facturas-adlsoft.cjs?)'); process.exit(1); }

// ---- ADL ONE (candado: solo la copia local de esta máquina) -----------------------------------------------------------------------
const db0 = await import(base + 'config/databaseSalud.js');
const { facturacionSaludService: s, PROGRAMAS_SALUD } = await import(base + 'services/facturacion-salud.service.js');
const pool = await db0.getConnectionSalud();
const q = async (t) => (await pool.request().query(t)).recordset;
const quien = (await q('SELECT @@SERVERNAME s'))[0].s;
if (!/ADLLOCAL/i.test(quien)) { console.log('ABORTO: el servidor no es ADLLOCAL:', quien); process.exit(2); }

const eligeDe = (idPrograma) => PROGRAMAS_SALUD.find((p) => p.ids_programa.includes(num(idPrograma)))?.eligeprograma ?? null;
const solo = arg('solo', '') ? new Set(arg('solo', '').split(',').map(Number)) : null;
const casosDe = (id) => [...new Set(filas.filter((f) => f.tabla === 'facturacion_det' && f.id_facturacion === id).map((f) => num(f.fila.id_caso)))];

const corridas = new Map();
for (const e of encs) {
  const casos = casosDe(e.id_facturacion); if (!casos.length) continue;
  const prog = num((await q(`SELECT TOP 1 id_programa FROM dbo.muestras WHERE id_caso = ${casos[0]}`))[0]?.id_programa);
  const elige = eligeDe(prog);
  const ufForzada = arg('uf', '');
  const clave = [e.id_empresaservicio, elige ?? 'prog' + prog, ufForzada || e.uf, txt(e.fecha_proceso_ini), txt(e.fecha_proceso_fin)].join('|');
  if (!corridas.has(clave)) corridas.set(clave, { clave, empresa: num(e.id_empresaservicio), prog, elige, facturas: [], casos: new Set(), enc: e, uf: Number(ufForzada) || num(e.uf) });
  const c = corridas.get(clave); c.facturas.push(e.id_facturacion); casos.forEach((x) => c.casos.add(x));
}
const lista = [...corridas.values()].filter((c) => !solo || c.facturas.some((f) => solo.has(f)));

// ---- plan -------------------------------------------------------------------------------------------------------------------------
console.log(`Servidor: ${quien} | ${ejecutar ? 'EJECUCIÓN' : 'PLAN (no escribe)'} | corridas de ADLSOFT: ${lista.length}\n`);
const problemas = [];
for (const [i, c] of lista.entries()) {
  const casos = [...c.casos];
  const est = await q(`SELECT estado, ISNULL(id_facturacion,0) fac, COUNT(*) n FROM dbo.muestras_detalle WHERE id_caso IN (${casos.join(',')}) GROUP BY estado, ISNULL(id_facturacion,0)`);
  const yaFacturadas = est.filter((x) => x.fac > 0).reduce((a, x) => a + x.n, 0);
  c.pendientes = est.filter((x) => x.fac === 0).reduce((a, x) => a + x.n, 0);
  const e = c.enc;
  console.log(`${i + 1}. empresa ${c.empresa} · programa ${c.prog}${c.elige ? ` (elige ${c.elige})` : ' — SIN MAPEO EN ADL ONE'} · UF ${c.uf} · proceso ${txt(e.fecha_proceso_ini)} a ${txt(e.fecha_proceso_fin)} · criterio ${txt(e.facturado_por)}`);
  console.log(`   facturas ADLSOFT: ${c.facturas.join(', ')} · ${casos.length} casos · líneas pendientes en la copia: ${c.pendientes}${yaFacturadas ? ` · YA FACTURADAS en la copia: ${yaFacturadas}` : ''}`);
  if (!c.elige) problemas.push(`corrida ${i + 1}: programa ${c.prog} no es de Salud en ADL ONE (¿Medio Ambiente?)`);
  if (yaFacturadas) problemas.push(`corrida ${i + 1}: hay líneas ya facturadas en la copia (¿falta el refresco previo a las 9:00, o se está ensayando sobre facturas viejas?)`);
  if (!c.pendientes) problemas.push(`corrida ${i + 1}: no hay líneas pendientes para reproducir`);
}
if (problemas.length) { console.log('\nPROBLEMAS:'); problemas.forEach((p) => console.log(' -', p)); }
if (!ejecutar) { console.log('\n(Plan solamente. Agrega --ejecutar para valorizar y crear las prefacturas.)'); await db0.closeConnectionSalud(); process.exit(problemas.length ? 3 : 0); }

// ---- ejecución --------------------------------------------------------------------------------------------------------------------
const manuales = arg('manuales', '') ? JSON.parse(fs.readFileSync(arg('manuales', ''), 'utf8')) : [];
const bitacora = { inicio: new Date().toISOString(), servidor: quien, desde, corridas: [] };
for (const [i, c] of lista.entries()) {
  const reg = { n: i + 1, empresa: c.empresa, programa: c.prog, uf: c.uf, facturas_adlsoft: c.facturas };
  bitacora.corridas.push(reg);
  if (!c.elige || !c.pendientes) { reg.omitida = 'ver PROBLEMAS del plan'; console.log(`\n${i + 1}. OMITIDA`); continue; }
  try {
    const e = c.enc; const casos = [...c.casos];
    const v = await s.valorizarCasosSalud({ id_empresaservicio: c.empresa, eligeprograma: c.elige, fecha_proceso_ini: txt(e.fecha_proceso_ini), fecha_proceso_fin: txt(e.fecha_proceso_fin), valor_uf: c.uf, valor_usd: num(e.usd) });
    reg.valorizacion = { casos: v.casosValorizados, lineas: v.lineasValorizadas };
    const mias = manuales.filter((m) => casos.includes(num(m.id_caso)));
    if (process.argv.includes('--manuales-auto')) {
      const adl = filas.filter((f) => f.tabla === 'muestras_detalle' && c.facturas.includes(f.id_facturacion) && num(f.fila.vtatotal) > 0).map((f) => f.fila);
      const ahora = await q(`SELECT id_caso, item, id_tecnica, ISNULL(vtatotal,0) vtatotal FROM dbo.muestras_detalle WHERE id_caso IN (${casos.join(',')})`);
      const cero = new Set(ahora.filter((x) => num(x.vtatotal) === 0).map((x) => num(x.id_caso) + '|' + num(x.item) + '|' + num(x.id_tecnica)));
      for (const f of adl) if (cero.has(num(f.id_caso) + '|' + num(f.item) + '|' + num(f.id_tecnica))) mias.push({ id_caso: f.id_caso, item: f.item, id_tecnica: f.id_tecnica, n_analisis: f.n_analisis, vtaunitario: f.vtaunitario });
    }
    for (const m of mias) await s.actualizarLineaCasoManual({ id_caso: num(m.id_caso), item: num(m.item), id_tecnica: num(m.id_tecnica), n_analisis: num(m.n_analisis), vtaunitario: num(m.vtaunitario) });
    reg.manuales_aplicados = mias.length;
    const ocs = filas.filter((f) => f.tabla === 'facturacion_ocompra' && c.facturas.includes(f.id_facturacion)).map((f) => f.fila)
      .filter((o, k, a) => a.findIndex((z) => z.ocompra === o.ocompra && z.tipo === o.tipo) === k).sort((a, b) => num(a.orden) - num(b.orden))
      .map((o) => ({ tipo: txt(o.tipo) || 'OC', ocompra: txt(o.ocompra), ocompra_fecha: txt(o.ocompra_fecha), referencia: txt(o.referencia) }));
    reg.prefacturas_adlone = [];
    for (const idF of c.facturas) {
      const eF = encs.find((x) => x.id_facturacion === idF);
      const ocsF = ocs.length ? filas.filter((f) => f.tabla === 'facturacion_ocompra' && f.id_facturacion === idF).map((f) => f.fila).sort((a, b) => num(a.orden) - num(b.orden))
        .map((o) => ({ tipo: txt(o.tipo) || 'OC', ocompra: txt(o.ocompra), ocompra_fecha: txt(o.ocompra_fecha), referencia: txt(o.referencia) })) : [];
      const r = await s.crearPrefacturasSalud({
        id_empresaservicio: c.empresa, eligeprograma: c.elige, criterio_agrupacion: txt(eF.facturado_por) || 'Na', casos_ids: casosDe(idF),
        fecha_facturacion: txt(eF.fecha_facturacion), id_formapago: num(eF.id_formapago), id_glosa: num(eF.id_glosa), glosa: txt(eF.glosa), observaciones: txt(eF.observaciones),
        nota: txt(eF.nota), mes: txt(eF.mes), ano: txt(eF.ano), fecha_proceso_ini: txt(eF.fecha_proceso_ini), fecha_proceso_fin: txt(eF.fecha_proceso_fin),
        fecha_informe_ini: txt(eF.fecha_informe_ini), fecha_informe_fin: txt(eF.fecha_informe_fin), ordenes_compra: ocsF
      });
      reg.prefacturas_adlone.push(...r.prefacturas.map((p) => num(p.id_facturacion)));
    }
    console.log(`\n${i + 1}. ok: ${reg.valorizacion.casos} casos, ${reg.valorizacion.lineas} líneas · prefacturas ADL ONE ${reg.prefacturas_adlone.join(', ')} (ADLSOFT: ${c.facturas.join(', ')})`);
  } catch (err) { reg.error = err.message; console.log(`\n${i + 1}. ERROR: ${err.message}`); }
}
const archivo = arg('salida', `reproduccion-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
fs.writeFileSync(archivo, JSON.stringify(bitacora, null, 1));
console.log('\nbitácora:', archivo, '\nSiguiente paso: node comparar-facturas.cjs "<pwd>" --desde=' + desde + ' --desdeB=<mayor id de la copia antes de reproducir> --esperadas=factura,emitido');
await db0.closeConnectionSalud(); process.exit(bitacora.corridas.some((x) => x.error) ? 4 : 0);
