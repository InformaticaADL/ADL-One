// Reproduce en la copia LOCAL TODOS los indices que tiene PRODUCCION en las tablas que la copia contiene. Origen: solo lectura.
// Uso: node indices-fieles.cjs <contraseña sa local>
const path = 'C:/Users/vremolcoy/Desktop/WebClientesV2/app/backend/';
require(path + 'node_modules/dotenv').config({ path: path + '.env' });
const sql = require('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/node_modules/mssql');
const consultaIdx = `SELECT OBJECT_NAME(i.object_id) tabla, i.index_id, i.name indice, i.type_desc tipo, i.is_unique uniq, i.is_primary_key pk, i.filter_definition filtro,
  STUFF((SELECT ', [' + c.name + ']' + CASE WHEN ic.is_descending_key=1 THEN ' DESC' ELSE '' END FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.is_included_column=0 ORDER BY ic.key_ordinal FOR XML PATH('')),1,2,'') llaves,
  STUFF((SELECT ', [' + c.name + ']' FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.is_included_column=1 FOR XML PATH('')),1,2,'') incluidas
  FROM sys.indexes i JOIN sys.objects o ON o.object_id=i.object_id AND o.type='U' WHERE i.type > 0 AND i.is_hypothetical = 0 AND i.is_disabled = 0`;
(async () => {
  const cfgL = (database) => ({ user: 'sa', password: process.argv[2], server: 'localhost', port: 14330, database, options: { encrypt: true, trustServerCertificate: true }, requestTimeout: 600000 });
  const cfgP = (database) => ({ server: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PWD, database, options: { encrypt: false, trustServerCertificate: true, readOnlyIntent: true }, requestTimeout: 300000 });
  for (const bd of ['LaboratorioADL', 'Abastecimiento']) {
    const loc = await new sql.ConnectionPool(cfgL(bd)).connect();
    const id = (await loc.request().query(`SELECT @@SERVERNAME s, CAST(SERVERPROPERTY('MachineName') AS nvarchar(100)) m`)).recordset[0];
    if (!/ADLLOCAL/i.test(id.s)) throw new Error('NO ES LA INSTANCIA LOCAL: ' + id.s);
    const tablasLocal = new Map((await loc.request().query(`SELECT t.name tabla, c.name col FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id`)).recordset.reduce((m, r) => { const k = r.tabla.toLowerCase(); (m.get(k) || m.set(k, new Set()).get(k)).add(r.col.toLowerCase()); return m; }, new Map()));
    const prod = await new sql.ConnectionPool(cfgP(bd)).connect();
    const idx = (await prod.request().query(consultaIdx)).recordset;
    await prod.close();
    let ok = 0, salto = 0; const fallos = [];
    // primero los agrupados (clave primaria / clustered), despues los demas
    const orden = [...idx].sort((a, b) => (b.tipo === 'CLUSTERED') - (a.tipo === 'CLUSTERED'));
    for (const x of orden) {
      const t = x.tabla.toLowerCase(); const cols = tablasLocal.get(t);
      const colsIdx = [...String(x.llaves || '').matchAll(/\[(.+?)\]/g), ...String(x.incluidas || '').matchAll(/\[(.+?)\]/g)].map((m) => m[1].toLowerCase());
      if (!cols || colsIdx.some((c) => !cols.has(c))) { salto++; continue; }
      const nombre = x.indice ? `[${x.indice}]` : null;
      let ddl;
      if (x.pk) ddl = `ALTER TABLE dbo.[${x.tabla}] ADD CONSTRAINT ${nombre} PRIMARY KEY ${x.tipo === 'CLUSTERED' ? 'CLUSTERED' : 'NONCLUSTERED'} (${x.llaves})`;
      else ddl = `CREATE ${x.uniq ? 'UNIQUE ' : ''}${x.tipo === 'CLUSTERED' ? 'CLUSTERED' : 'NONCLUSTERED'} INDEX ${nombre || '[IX_auto_' + x.tabla + '_' + x.index_id + ']'} ON dbo.[${x.tabla}] (${x.llaves})${x.incluidas ? ' INCLUDE (' + x.incluidas + ')' : ''}${x.filtro ? ' WHERE ' + x.filtro : ''}`;
      try { await loc.request().batch(ddl); ok++; } catch (e) { fallos.push(`${x.tabla}.${x.indice}: ${e.message.slice(0, 90)}`); }
    }
    console.log(`${bd}: ${ok} indices creados, ${salto} omitidos (tabla o columnas que la copia no tiene), ${fallos.length} con error`);
    fallos.slice(0, 8).forEach((f) => console.log('   FALLO', f));
    await loc.close();
  }
})().catch((e) => console.log('ERR', e.message));
