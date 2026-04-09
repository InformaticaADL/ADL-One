const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        
        // Fix solicitud 123 (equipo ID 18 = MEDIDOR PH PORTÁTIL [pHp.102/MA.PM])
        const r = await sql.query("SELECT id_solicitud, datos_json FROM mae_solicitud WHERE id_solicitud = 123");
        if (r.recordset.length > 0) {
            const datos = JSON.parse(r.recordset[0].datos_json);
            datos.nombre_equipo_full = 'MEDIDOR PH PORTÁTIL [pHp.102/MA.PM]';
            await sql.query`UPDATE mae_solicitud SET datos_json = ${JSON.stringify(datos)} WHERE id_solicitud = 123`;
            console.log('✅ Solicitud 123 corregida:', datos.nombre_equipo_full);
        }

        // Fix any other recent requests missing nombre_equipo_full
        const all = await sql.query("SELECT id_solicitud, datos_json FROM mae_solicitud WHERE datos_json LIKE '%id_equipo%' AND datos_json NOT LIKE '%nombre_equipo_full%'");
        console.log(`Found ${all.recordset.length} requests to fix`);
        for (const row of all.recordset) {
            const datos = JSON.parse(row.datos_json);
            const eqId = datos.id_equipo;
            if (eqId) {
                const eq = await sql.query`SELECT LTRIM(RTRIM(nombre)) + ' [' + LTRIM(RTRIM(codigo)) + ']' as full_name FROM mae_equipo WHERE id_equipo = ${eqId}`;
                if (eq.recordset.length > 0) {
                    datos.nombre_equipo_full = eq.recordset[0].full_name;
                    await sql.query`UPDATE mae_solicitud SET datos_json = ${JSON.stringify(datos)} WHERE id_solicitud = ${row.id_solicitud}`;
                    console.log(`✅ Fixed #${row.id_solicitud}: ${datos.nombre_equipo_full}`);
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
