const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        const ids = [120, 121, 122];
        
        for (const id of ids) {
            const r = await sql.query(`SELECT datos_json FROM mae_solicitud WHERE id_solicitud = ${id}`);
            if (r.recordset.length === 0) continue;
            
            const json = JSON.parse(r.recordset[0].datos_json);
            if (json.id_equipo && !json.nombre_equipo_full) {
                const eqRes = await sql.query(`SELECT LTRIM(RTRIM(nombre)) + ' [' + LTRIM(RTRIM(codigo)) + ']' as full_name FROM mae_equipo WHERE id_equipo = ${json.id_equipo}`);
                if (eqRes.recordset.length > 0) {
                    json.nombre_equipo_full = eqRes.recordset[0].full_name;
                    await sql.query(`UPDATE mae_solicitud SET datos_json = N'${JSON.stringify(json).replace(/'/g, "''")}' WHERE id_solicitud = ${id}`);
                    console.log(`✅ Solicitud ${id} corregida con equipo: ${json.nombre_equipo_full}`);
                }
            }
        }
    } catch(e) { 
        console.error(e); 
    } finally { 
        sql.close(); 
    } 
} 
run();
