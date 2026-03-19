import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkSchema() {
    try {
        const pool = await getConnection();
        
        const tables = ['mae_tipofichaingresoservicio', 'mae_objetivomuestreo_ma'];
        for (const table of tables) {
            try {
                const result = await pool.request().query(`SELECT TOP 1 * FROM ${table}`);
                console.log(`\nColumns in ${table}:`);
                console.log(Object.keys(result.recordset[0]).join(', '));
            } catch (e) {
                console.log(`\nError querying ${table}: ${e.message}`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
