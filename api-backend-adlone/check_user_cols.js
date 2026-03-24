import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkMoreSchema() {
    try {
        const pool = await getConnection();
        
        console.log('--- mae_usuario ---');
        const resultUser = await pool.request().query("SELECT TOP 1 * FROM mae_usuario");
        console.log('Columns:', Object.keys(resultUser.recordset[0]).join(', '));
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkMoreSchema();
