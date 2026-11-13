// Devuelve LaboratorioADL y Abastecimiento a como estaban al crear las instantaneas. Uso: node restaurar2.cjs <contraseña sa local>
const sql = require('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/node_modules/mssql');
(async () => {
  const p = await new sql.ConnectionPool({ user: 'sa', password: process.argv[2], server: 'localhost', port: 14330, database: 'master', options: { encrypt: true, trustServerCertificate: true }, requestTimeout: 600000 }).connect();
  const id = (await p.request().query(`SELECT @@SERVERNAME s`)).recordset[0];
  if (!/ADLLOCAL/i.test(id.s)) throw new Error('NO ES LA INSTANCIA LOCAL: ' + id.s);
  for (const bd of ['Abastecimiento', 'LaboratorioADL']) {
    const snap = `${bd}_antes_prueba`;
    if (!(await p.request().query(`SELECT 1 x FROM sys.databases WHERE name='${snap}'`)).recordset.length) { console.log('no hay instantanea de', bd); continue; }
    await p.request().query(`ALTER DATABASE ${bd} SET SINGLE_USER WITH ROLLBACK IMMEDIATE`);
    try { await p.request().query(`RESTORE DATABASE ${bd} FROM DATABASE_SNAPSHOT = '${snap}'`); console.log('restaurada', bd); }
    finally { await p.request().query(`ALTER DATABASE ${bd} SET MULTI_USER`); }
  }
  await p.close();
})().catch(e => console.log('ERR', e.message));
