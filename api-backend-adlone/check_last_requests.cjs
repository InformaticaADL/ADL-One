const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        const r = await sql.query("SELECT TOP 5 id_solicitud, id_tipo, datos_json FROM mae_solicitud ORDER BY id_solicitud DESC");
        console.log(JSON.stringify(r.recordset, null, 2));
    } catch(e) { 
        console.error(e); 
    } finally { 
        sql.close(); 
    } 
} 
run();
