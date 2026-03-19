import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkSchema() {
    try {
        const pool = await getConnection();
        
        const tables = [
            'App_Ma_Agenda_MUESTREOS',
            'App_Ma_FichaIngresoServicio_ENC',
            'App_Ma_Agenda_Muestreo_Fotos',
            'App_Ma_Agenda_Muestreo_Informes',
            'App_Ma_Muestreadores_Envio',
            'mae_estadomuestreo'
        ];
        
        for (const table of tables) {
            try {
                const result = await pool.request().query(`SELECT TOP 1 * FROM ${table}`);
                console.log(`\nColumns in ${table}:`);
                console.log(Object.keys(result.recordset[0]).join(', '));
            } catch (e) {
                console.log(`\nError querying ${table}: ${e.message}`);
                
                // Try to find similar tables
                const search = await pool.request()
                    .input('name', sql.VarChar, `%${table.split('_').pop()}%`)
                    .query("SELECT name FROM sys.tables WHERE name LIKE @name");
                if (search.recordset.length > 0) {
                    console.log(`Similar tables found: ${search.recordset.map(r => r.name).join(', ')}`);
                }
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
