const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        
        // 1. Remove (Móvil) from descriptions
        await sql.query(`
            UPDATE mae_solicitud_tipo 
            SET nombre = REPLACE(nombre, ' (Móvil)', '') 
            WHERE nombre LIKE '%Móvil%' OR id_tipo IN (11, 12)
        `);
        console.log('✅ Nombres (Tipo 11, 12) actualizados');

        // 2. Fetch all requests with id_tipo IN (11, 12) to update their JSON
        const res = await sql.query(`SELECT id_solicitud, datos_json FROM mae_solicitud WHERE id_tipo IN (11, 12)`);
        
        for (let row of res.recordset) {
            let json = {};
            try {
                json = JSON.parse(row.datos_json);
            } catch(e) { continue; }

            if (json.id_equipo && !json.nombre_equipo_full) {
                const eqRes = await sql.query(`
                    SELECT LTRIM(RTRIM(nombre)) + ' [' + LTRIM(RTRIM(codigo)) + ']' as full_name 
                    FROM mae_equipo 
                    WHERE id_equipo = ${json.id_equipo}
                `);

                if (eqRes.recordset.length > 0) {
                    json.nombre_equipo_full = eqRes.recordset[0].full_name;
                    await sql.query(`
                        UPDATE mae_solicitud 
                        SET datos_json = '${JSON.stringify(json)}'
                        WHERE id_solicitud = ${row.id_solicitud}
                    `);
                    console.log(`✅ Solicitud ${row.id_solicitud} actualizada con: ${json.nombre_equipo_full}`);
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
