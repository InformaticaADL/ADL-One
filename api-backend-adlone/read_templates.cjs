const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        const r = await sql.query("SELECT codigo_evento, cuerpo_template_html FROM mae_evento_notificacion WHERE codigo_evento IN ('AVISO_PERDIDO_NUEVO', 'AVISO_PROBLEMA_NUEVO')");
        r.recordset.forEach(row => {
            console.log('--- EVENT:', row.codigo_evento, '---');
            console.log(row.cuerpo_template_html);
        });
    } catch(e) { 
        console.error(e); 
    } finally { 
        sql.close(); 
    } 
} 
run();
