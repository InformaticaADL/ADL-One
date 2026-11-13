// Compara el listado nuevo (filtro previo) con el procedimiento original de ADLSOFT + filtro en memoria. Solo copia local, solo lectura.
process.chdir('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone');
const b = 'file:///C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/src/';
const db0 = await import(b + 'config/databaseSalud.js');
const ex = await import(b + 'services/facturacion-salud.exportacion.js');
const pool = await db0.getConnectionSalud();
if (!/ADLLOCAL/i.test((await pool.request().query('SELECT @@SERVERNAME s')).recordset[0].s)) { console.log('NO ES LOCAL'); process.exit(2); }
const cpu = async () => Number((await pool.request().query(`SELECT SUM(CAST(total_worker_time AS bigint)) c FROM sys.dm_exec_query_stats`)).recordset[0].c) / 1000;
for (const estado of ['NO emitidos', 'Emitidos', 'Eliminado', 'Todos']) {
  let c0 = await cpu(); let t = performance.now();
  const orig = ex.filtrarLista((await pool.request().query('EXEC dbo.fac_consulta_facturaelectronica_exporta;')).recordset, estado);
  const ms1 = performance.now() - t, cpu1 = (await cpu()) - c0;
  c0 = await cpu(); t = performance.now();
  const nuevo = await ex.listarFacturasParaExportar(pool, { estado });
  const ms2 = performance.now() - t, cpu2 = (await cpu()) - c0;
  const igual = JSON.stringify(orig) === JSON.stringify(nuevo);
  console.log(estado.padEnd(12), 'filas', orig.length, '/', nuevo.length, igual ? 'IGUAL' : 'DISTINTO', '| original', Math.round(ms1), 'ms', Math.round(cpu1), 'ms CPU | nuevo', Math.round(ms2), 'ms', Math.round(cpu2), 'ms CPU');
}
await db0.closeConnectionSalud(); process.exit(0);
