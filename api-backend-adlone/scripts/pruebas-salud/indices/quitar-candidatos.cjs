const sql = require('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/node_modules/mssql');
(async () => {
  const cfg = (database) => ({ user: 'sa', password: process.argv[2], server: 'localhost', port: 14330, database, options: { encrypt: true, trustServerCertificate: true } });
  const m = await new sql.ConnectionPool(cfg('master')).connect();
  const s = (await m.request().query('SELECT @@SERVERNAME s')).recordset[0].s; await m.close();
  if (!/ADLLOCAL/i.test(s)) throw new Error('NO ES LOCAL ' + s);
  for (const bd of ['LaboratorioADL', 'Abastecimiento']) {
    const p = await new sql.ConnectionPool(cfg(bd)).connect();
    const xs = (await p.request().query(`SELECT 'DROP INDEX ' + QUOTENAME(i.name) + ' ON ' + QUOTENAME(OBJECT_NAME(i.object_id)) q FROM sys.indexes i JOIN sys.objects o ON o.object_id=i.object_id AND o.type='U' WHERE i.name LIKE 'IX[_]fdet[_]%' OR i.name LIKE 'IX[_]md[_]id%' OR i.name LIKE 'IX[_]fenc[_]%' OR i.name LIKE 'IX[_]fotro[_]%' OR i.name LIKE 'IX[_]fing[_]%' OR i.name LIKE 'IX[_]fdes[_]%' OR i.name LIKE 'IX[_]foc[_]%' OR i.name LIKE 'IX[_]focompra[_]%' OR i.name LIKE 'IX[_]gdenc[_]%' OR i.name LIKE 'IX[_]gddet[_]%'`)).recordset;
    for (const x of xs) await p.request().batch(x.q);
    console.log(bd, 'candidatos quitados:', xs.length); await p.close();
  }
})().catch(e => console.log('ERR', e.message));
