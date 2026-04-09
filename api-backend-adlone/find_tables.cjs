const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        const r = await sql.query("SELECT name FROM sys.tables WHERE name LIKE '%ficha%' OR name LIKE '%agenda%' OR name LIKE '%servicio%' OR name LIKE '%muestreo%'"); 
        console.log(JSON.stringify(r.recordset, null, 2)); 
    } catch(e) { console.error(e); } finally { sql.close(); } 
} 
run();
