import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkSchema() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT TOP 1 * FROM App_Ma_FichaIngresoServicio_ENC");
        const columns = Object.keys(result.recordset[0]);
        console.log('Columns containing "tipo":');
        console.log(columns.filter(c => c.toLowerCase().includes('tipo')));
        
        console.log('\nColumns in ENC:');
        console.log(columns.join(', '));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
