// Mide por separado cada listado (CPU de SQL y lecturas) en la copia LOCAL. Solo lectura.
process.chdir('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone');
const base = 'file:///C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/src/';
const db0 = await import(base + 'config/databaseSalud.js');
const { facturacionSaludService: s } = await import(base + 'services/facturacion-salud.service.js');
const pool = await db0.getConnectionSalud();
if (!/ADLLOCAL/i.test((await pool.request().query('SELECT @@SERVERNAME s')).recordset[0].s)) { console.log('ABORTO'); process.exit(2); }
const num = (v) => Number(v) || 0;
const cpu = async () => { const r = (await pool.request().query(`SELECT SUM(CAST(qs.total_worker_time AS bigint)) c, SUM(CAST(qs.total_logical_reads AS bigint)) l FROM sys.dm_exec_query_stats qs CROSS APPLY (SELECT TOP 1 CAST(pa.value AS int) dbid FROM sys.dm_exec_plan_attributes(qs.plan_handle) pa WHERE pa.attribute = 'dbid') x WHERE x.dbid IN (DB_ID('LaboratorioADL'), DB_ID('Abastecimiento'))`)).recordset[0]; return { c: num(r.c) / 1000, l: num(r.l) }; };
const casos = [
  ['dashboard (resumen)', () => s.getDashboardSalud()],
  ['lista de prefacturas (50)', () => s.listarPrefacturasSalud({ limite: 50 })],
  ['ficha de una factura', () => s.consultarFacturaSalud({ id_facturacion: 74906 })],
  ['listado para exportar facturas de casos', () => s.listarFacturasExportacionSalud('NO emitidos')],
  ['listado DTE', () => s.listarDocumentosDteSalud({})],
  ['listado de otras ventas', () => s.listarOtrasVentasSalud('NO emitidos')]
];
await s.getDashboardSalud();
const filas = [];
for (const [nombre, f] of casos) { const a = await cpu(); const t0 = performance.now(); await f(); await f(); const b = await cpu(); filas.push({ listado: nombre, segundos_2_veces: +((performance.now() - t0) / 1000).toFixed(1), cpu_ms: Math.round(b.c - a.c), lecturas: b.l - a.l }); }
console.table(filas);
for (const sp of ['fac_consulta_facturaelectronica_exporta', 'fac_consulta_facturaelectronica_exporta_fea']) { const d = String((await pool.request().query(`SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.${sp}')) d`)).recordset[0].d).replace(/\s+/g, ' '); console.log('\n' + sp + ':\n' + d.slice(0, 1500)); }
await db0.closeConnectionSalud(); process.exit(0);
