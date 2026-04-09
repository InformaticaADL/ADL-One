const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        
        // Assign functionally to URS (3) and ensure they are not hidden
        const query = `
            UPDATE mae_evento_notificacion 
            SET id_funcionalidad = 3, oculto_en_hub = 0
            WHERE codigo_evento IN (
                'AVISO_CONSULTA_EQUIPO_NUEVA', 
                'AVISO_CONSULTA_FICHA_NUEVA',
                'AVISO_CONSULTA_NUEVA',
                'AVISO_PROBLEMA_NUEVO',
                'AVISO_PERDIDO_NUEVO',
                'AVISO_CANCELACION_NUEVA'
            )
        `;
        const result = await sql.query(query);
        console.log(`✅ Eventos actualizados (${result.rowsAffected[0]} filas)`);

        // Verify
        const verify = await sql.query("SELECT id_evento, codigo_evento, id_funcionalidad, oculto_en_hub FROM mae_evento_notificacion WHERE id_funcionalidad = 3");
        console.log('\n=== CATALOGO URS ACTUALIZADO ===');
        console.log(JSON.stringify(verify.recordset, null, 2));

    } catch(e) { console.error(e); } finally { sql.close(); } 
} 
run();
