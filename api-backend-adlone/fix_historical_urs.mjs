
import sql from './src/config/database.js';
import { getConnection } from './src/config/database.js';

async function fixRecentRequests() {
    const pool = await getConnection();
    console.log('--- Starting FINAL URS Data Correction ---');

    const requests = await pool.request()
        .query(`
            SELECT TOP 50 id_solicitud, s.id_solicitante, datos_json, id_tipo,
                   m.nombre_muestreador, u.nombre_usuario, u.usuario
            FROM mae_solicitud s
            LEFT JOIN mae_muestreador m ON s.id_solicitante = m.id_muestreador
            LEFT JOIN mae_usuario u ON s.id_solicitante = u.id_usuario
            WHERE id_tipo IN (10, 11, 12, 13, 14, 15)
            ORDER BY id_solicitud DESC
        `);

    console.log(`Found ${requests.recordset.length} recent URS requests.`);

    for (const row of requests.recordset) {
        let datos = {};
        try {
            datos = JSON.parse(row.datos_json || '{}');
        } catch (e) {
            continue;
        }

        let updated = false;

        // A. Resolve Equipment with code [CODE]
        const eqId = datos.id_equipo || datos.equipo_id || datos.idEquipo || datos.equipo;
        if (eqId) {
            const currentFull = datos.nombre_equipo_full || '';
            if (!currentFull.includes('[') || currentFull.length < 5) {
                try {
                    const eqRes = await pool.request()
                        .input('id', sql.Int, Number(eqId))
                        .query("SELECT LTRIM(RTRIM(nombre)) + ' [' + LTRIM(RTRIM(codigo)) + ']' as full_name, LTRIM(RTRIM(codigo)) as code, LTRIM(RTRIM(nombre)) as name FROM mae_equipo WHERE id_equipo = @id");
                    
                    if (eqRes.recordset.length > 0) {
                        const eq = eqRes.recordset[0];
                        datos.nombre_equipo_full = eq.full_name;
                        datos.nombre_equipo = eq.name;
                        datos.codigo_equipo = eq.code;
                        updated = true;
                    }
                } catch (err) {}
            }
        }

        // B. Standardize Dates (DD-MM-YYYY)
        const dateFields = ['fecha_suceso', 'fecha_extravio', 'fecha_ocurrencia', 'fecha_solicitud', 'fecha_anulacion', 'fecha_baja'];
        dateFields.forEach(field => {
            let val = datos[field];
            if (val && !String(val).match(/^\d{2}-\d{2}-\d{4}$/)) {
                try {
                    const parts = val.split('T')[0].split('-');
                    let d = null;
                    if (parts.length === 3) {
                        if (parts[0].length === 4) d = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        else if (parts[2].length === 4) d = `${parts[0]}-${parts[1]}-${parts[2]}`;
                    }
                    if (d) {
                        datos[field] = d;
                        updated = true;
                    }
                } catch (e) {}
            }
        });

        // C. Aliases & Solicitor Name for consistency
        const humanName = row.nombre_muestreador || row.nombre_usuario || row.usuario || 'Desconocido';
        datos.solicitante_nombre = humanName;
        if (datos.fecha_extravio && !datos.fecha_suceso) {
            datos.fecha_suceso = datos.fecha_extravio;
            updated = true;
        }

        if (updated) {
            console.log(`Updating ID ${row.id_solicitud} (Solicitant: ${humanName})`);
            await pool.request()
                .input('id', sql.Numeric(10, 0), row.id_solicitud)
                .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datos))
                .query("UPDATE mae_solicitud SET datos_json = @datos WHERE id_solicitud = @id");
        }
    }

    console.log('--- FINAL Correction Finished ---');
    process.exit(0);
}

fixRecentRequests();
