const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        const r = await sql.query("SELECT id_solicitud, id_tipo, datos_json FROM mae_solicitud WHERE id_solicitud = 120");
        if (r.recordset.length === 0) return;
        
        const row = r.recordset[0];
        const json = JSON.parse(row.datos_json);
        if (json.id_equipo) {
            const eqRes = await sql.query(`SELECT LTRIM(RTRIM(nombre)) + ' [' + LTRIM(RTRIM(codigo)) + ']' as full_name FROM mae_equipo WHERE id_equipo = ${json.id_equipo}`);
            if (eqRes.recordset.length > 0) {
                json.nombre_equipo_full = eqRes.recordset[0].full_name;
                await sql.query(`UPDATE mae_solicitud SET datos_json = N'${JSON.stringify(json).replace(/'/g, "''")}' WHERE id_solicitud = 120`);
                console.log('✅ Solicitud 120 actualizada en DB');
            }
        }
    } catch(e) { 
        console.error(e); 
    } finally { 
        sql.close(); 
    } 
} 
run();
