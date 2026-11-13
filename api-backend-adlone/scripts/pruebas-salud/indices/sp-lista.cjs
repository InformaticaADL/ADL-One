const sql = require('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/node_modules/mssql');
(async () => {
  const p = await new sql.ConnectionPool({ user: 'sa', password: process.argv[2], server: 'localhost', port: 14330, database: 'LaboratorioADL', options: { encrypt: true, trustServerCertificate: true } }).connect();
  const d = String((await p.request().query(`SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.fac_consulta_facturaelectronica_exporta')) d`)).recordset[0].d).replace(/\s+/g, ' ');
  console.log('Desde el FROM:\n' + d.slice(d.indexOf('FROM dbo.facturacion_enc')));
  const n = (await p.request().query(`EXEC dbo.fac_consulta_facturaelectronica_exporta`)).recordset;
  console.log('\nfilas que devuelve el procedimiento:', n.length, '| de ellas NO emitidas:', n.filter(r => String(r.emitido ?? '').trim() !== 'S').length, '| facturas distintas:', new Set(n.map(r => r.id_facturacion)).size);
  await p.close();
})().catch(e => console.log('ERR', e.message));
