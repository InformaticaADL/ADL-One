// MEDICION DEL EFECTO DE LOS INDICES: corre la misma carga de trabajo de facturacion y mide, por fase, el tiempo, las consultas enviadas,
// el CPU de SQL Server y las lecturas logicas. SOLO en la copia local (con candado). Uso: node indices-medicion.mjs <etiqueta>
process.chdir('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone');
import fs from 'fs';
const base = 'file:///C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/src/';
const db0 = await import(base + 'config/databaseSalud.js'); // candado: solo este equipo
const { facturacionSaludService: s } = await import(base + 'services/facturacion-salud.service.js');
const pool = await db0.getConnectionSalud();
const quien = (await pool.request().query("SELECT @@SERVERNAME s")).recordset[0].s;
if (!/ADLLOCAL/i.test(quien)) { console.log('ABORTO: el servidor no es ADLLOCAL:', quien); process.exit(2); }
const etiqueta = process.argv[2] || 'sin-etiqueta';
const num = (v) => Number(v) || 0; const txt = (x) => String(x ?? '').trim();
const inicio = (await pool.request().query('SELECT SYSDATETIME() t')).recordset[0].t;

// ---- instrumentacion: cuenta TODAS las peticiones (tambien las de transacciones); el CPU y las lecturas salen de las estadisticas de consultas de SQL Server ----
let consultas = 0; const sqlMod = db0.default; const origQuery = sqlMod.Request.prototype.query;
sqlMod.Request.prototype.query = function (t, cb) { if (typeof t === 'string') consultas++; return origQuery.call(this, t, cb); };
const origRequest = pool.request.bind(pool);
const sesiones = async () => { const r = (await origRequest().query(`SELECT SUM(CAST(qs.total_worker_time AS bigint)) cpu_us, SUM(CAST(qs.total_logical_reads AS bigint)) lect FROM sys.dm_exec_query_stats qs CROSS APPLY (SELECT TOP 1 CAST(pa.value AS int) dbid FROM sys.dm_exec_plan_attributes(qs.plan_handle) pa WHERE pa.attribute = 'dbid') x WHERE x.dbid IN (DB_ID('LaboratorioADL'), DB_ID('Abastecimiento'))`)).recordset[0]; return { cpu: Math.round(num(r.cpu_us) / 1000), lect: num(r.lect) }; };
const resultados = [];
async function fase(nombre, fn) {
  const a = await sesiones(); const c0 = consultas; const t0 = performance.now();
  const extra = await fn();
  const b = await sesiones();
  const r = { fase: nombre, segundos: +((performance.now() - t0) / 1000).toFixed(1), consultas: consultas - c0, cpu_sql_ms: b.cpu - a.cpu, lecturas_logicas: b.lect - a.lect, ...(extra || {}) };
  resultados.push(r); console.log(JSON.stringify(r));
}

// ---- datos de apoyo ----------------------------------------------------------------------------------------------------------------------------------
const q = async (t) => (await origRequest().query('SET DATEFORMAT dmy; ' + t)).recordset;
const ELIGE = { 1: 1, 2: 2, 3: 4, 4: 5, 5: 3, 10: 3, 18: 8 };
const rangoMes = { fecha_proceso_ini: '01/10/2026', fecha_proceso_fin: '16/11/2026' };

// calentamiento (no se mide): deja la cache en el mismo punto en las tres configuraciones
await s.getDashboardSalud(); await s.listarPrefacturasSalud({ limite: 50 });

await fase('1. Pantallas y listados (3 vueltas: resumen, prefacturas, ficha de factura, listado de exportacion, DTE, otras ventas)', async () => {
  for (let i = 0; i < 3; i++) {
    await s.getDashboardSalud(); await s.listarPrefacturasSalud({ limite: 50 }); await s.consultarFacturaSalud({ id_facturacion: 74906 });
    await s.listarFacturasExportacionSalud('NO emitidos'); await s.listarDocumentosDteSalud({}); await s.listarOtrasVentasSalud('NO emitidos');
  }
});
await fase('2. Elegibilidad: empresas con casos por facturar de los 6 programas', async () => {
  let empresas = 0; for (const p of [1, 2, 3, 4, 5, 8]) empresas += (await s.getEmpresasConCasosElegibles({ eligeprograma: p, ...rangoMes })).length; return { empresas };
});
await fase('3. Valorizar una empresa grande (Australis Mar: 95 casos, 280 lineas)', async () => {
  const v = await s.valorizarCasosSalud({ id_empresaservicio: 96, eligeprograma: 4, ...rangoMes, valor_uf: 41242.32, valor_usd: 0 }); return { casos: v.casosValorizados, lineas: v.lineasValorizadas };
});

// ciclo completo de una prefactura real (3 casos) + operaciones por numero de factura
const idEmitida = 74609;
const enc = (await q(`SELECT * FROM dbo.facturacion_enc WHERE id_facturacion = ${idEmitida}`))[0];
const casos = (await q(`SELECT DISTINCT id_caso FROM dbo.facturacion_det WHERE id_facturacion = ${idEmitida}`)).map((d) => num(d.id_caso));
const fi = (await q(`SELECT CONVERT(varchar(10), MIN(CONVERT(datetime, fecha_informe, 103)), 103) a, CONVERT(varchar(10), MAX(CONVERT(datetime, fecha_informe, 103)), 103) b FROM dbo.muestras WHERE id_caso IN (${casos.join(',')}) AND ISDATE(fecha_informe) = 1`))[0];
const rango = { fecha_proceso_ini: fi.a, fecha_proceso_fin: fi.b };
let nueva = 0;
await fase('4. Ciclo de una prefactura: eliminar, valorizar y crear (3 casos)', async () => {
  await s.eliminarPrefacturaSalud(idEmitida);
  await s.valorizarCasosSalud({ id_empresaservicio: num(enc.id_empresaservicio), eligeprograma: 1, ...rango, valor_uf: num(enc.uf), valor_usd: 0 });
  const c = await s.crearPrefacturasSalud({ id_empresaservicio: num(enc.id_empresaservicio), eligeprograma: 1, criterio_agrupacion: txt(enc.facturado_por) || 'Na', casos_ids: casos, fecha_facturacion: txt(enc.fecha_facturacion), id_formapago: num(enc.id_formapago), id_glosa: num(enc.id_glosa), glosa: txt(enc.glosa), observaciones: txt(enc.observaciones), nota: txt(enc.nota), mes: txt(enc.mes), ano: txt(enc.ano), ...rango, fecha_informe_ini: txt(enc.fecha_informe_ini), fecha_informe_fin: txt(enc.fecha_informe_fin) });
  nueva = num(c.prefacturas[0].id_facturacion);
});
await fase('5. Operaciones sobre esa factura: grabar totales, grabar folio, PDF resumen, nota de credito parcial y eliminar', async () => {
  await s.grabarFacturaSalud({ id_facturacion: nueva, factura: 0, uf: 41300, ingresos: [], descuentos: [] });
  await s.grabarFacturaSalud({ id_facturacion: nueva, factura: 99001, uf: 41300 });
  await s.generarPdfResumenSalud(nueva);
  const lista = await s.listarCasosDeFacturaSalud(nueva);
  await s.crearNotaCreditoCasosSalud({ id_facturacion_referencia: nueva, ids_caso: [num(lista[0].id_caso)], cod_razon: 3, fecha_documento: '16/11/2026', id_formapago: 1, concepto_cobro: 'NC parcial' });
  await s.eliminarPrefacturaSalud(nueva);
});

const tot = resultados.reduce((a, r) => ({ segundos: a.segundos + r.segundos, consultas: a.consultas + r.consultas, cpu_sql_ms: a.cpu_sql_ms + r.cpu_sql_ms, lecturas_logicas: a.lecturas_logicas + r.lecturas_logicas }), { segundos: 0, consultas: 0, cpu_sql_ms: 0, lecturas_logicas: 0 });
console.log('TOTAL ' + JSON.stringify(tot));
fs.writeFileSync(process.env.SALIDA || './indices-' + etiqueta + '.json', JSON.stringify({ etiqueta, resultados, total: tot }, null, 1));
await db0.closeConnectionSalud(); process.exit(0);
