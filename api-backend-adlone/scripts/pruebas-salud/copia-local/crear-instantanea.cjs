// Crea instantaneas de LaboratorioADL y de Abastecimiento (guias de despacho) en la instancia LOCAL. Uso: node snap2.cjs <contraseña sa local>
const sql = require('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/node_modules/mssql');
(async () => {
  const p = await new sql.ConnectionPool({ user: 'sa', password: process.argv[2], server: 'localhost', port: 14330, database: 'master', options: { encrypt: true, trustServerCertificate: true }, requestTimeout: 300000 }).connect();
  const id = (await p.request().query(`SELECT @@SERVERNAME s, CAST(SERVERPROPERTY('MachineName') AS nvarchar(100)) m`)).recordset[0];
  if (!/ADLLOCAL/i.test(id.s)) throw new Error('NO ES LA INSTANCIA LOCAL: ' + id.s);
  console.log('servidor:', id.s, '| maquina:', id.m);
  for (const bd of ['LaboratorioADL', 'Abastecimiento']) {
    const snap = `${bd}_antes_prueba`;
    if ((await p.request().query(`SELECT 1 x FROM sys.databases WHERE name='${snap}'`)).recordset.length) { console.log('ya existe', snap); continue; }
    const f = (await p.request().query(`SELECT name, physical_name FROM sys.master_files WHERE database_id = DB_ID('${bd}') AND type_desc = 'ROWS'`)).recordset;
    const dir = f[0].physical_name.replace(/[^\\/]+$/, '');
    await p.request().query(`CREATE DATABASE ${snap} ON ${f.map(x => `(NAME = [${x.name}], FILENAME = '${dir}${snap}_${x.name}.ss')`).join(', ')} AS SNAPSHOT OF ${bd}`);
    console.log('instantanea creada:', snap);
  }
  await p.close();
})().catch(e => console.log('ERR', e.message));
