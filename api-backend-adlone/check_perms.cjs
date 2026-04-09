const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        const r = await sql.query("SELECT * FROM rel_solicitud_tipo_permiso WHERE id_tipo = 11"); 
        console.log('Permisos 11:', r.recordset);
        
        const r2 = await sql.query("SELECT * FROM rel_usuario_rol WHERE id_usuario = 464"); 
        console.log('Roles de vremolcoy (464):', r2.recordset);
        
    } catch(e) { 
        console.error(e); 
    } finally { 
        sql.close(); 
    } 
} 
run();
