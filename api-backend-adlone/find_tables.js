import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function findRelevantTables() {
    try {
        const pool = await getConnection();
        const keywords = ['muestreo', 'foto', 'informe', 'notificacion', 'envio', 'agenda', 'completado'];
        
        let query = "SELECT name FROM sys.tables WHERE ";
        query += keywords.map(k => `name LIKE '%${k}%'`).join(' OR ');
        query += " ORDER BY name";
        
        const result = await pool.request().query(query);
        console.log('Relevant tables found:');
        console.log(result.recordset.map(r => r.name).join(', '));
        
        // Also check columns in App_Ma_Agenda_MUESTREOS to find status
        console.log('\nChecking columns in App_Ma_Agenda_MUESTREOS:');
        const colResult = await pool.request().query("SELECT TOP 1 * FROM App_Ma_Agenda_MUESTREOS");
        if (colResult.recordset.length > 0) {
            console.log(Object.keys(colResult.recordset[0]).join(', '));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findRelevantTables();
