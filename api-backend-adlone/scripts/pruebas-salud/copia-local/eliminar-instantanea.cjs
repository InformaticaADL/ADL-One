const sql = require('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/node_modules/mssql');
(async () => {
  const p = await new sql.ConnectionPool({ user: 'sa', password: process.argv[2], server: 'localhost', port: 14330, database: 'master', options: { encrypt: true, trustServerCertificate: true } }).connect();
  const id = (await p.request().query(`SELECT @@SERVERNAME s`)).recordset[0];
  if (!/ADLLOCAL/i.test(id.s)) throw new Error('NO ES LA INSTANCIA LOCAL: ' + id.s);
  for (const bd of ['LaboratorioADL', 'Abastecimiento']) { const snap = `${bd}_antes_prueba`; if ((await p.request().query(`SELECT 1 x FROM sys.databases WHERE name='${snap}'`)).recordset.length) { await p.request().query(`DROP DATABASE ${snap}`); console.log('eliminada', snap); } }
  console.log('bases:', (await p.request().query(`SELECT name FROM sys.databases WHERE name LIKE 'Laboratorio%' OR name LIKE 'Abastec%'`)).recordset.map(x => x.name).join(', '));
  await p.close();
})().catch(e => console.log('ERR', e.message));
