import 'dotenv/config';
import { getConnection } from './src/config/database.js';

async function getFrequencies() {
    try {
        const pool = await getConnection();
        const result = await pool.request().execute('Consulta_Frecuencia_Periodo');
        console.log('Frequencies:', JSON.stringify(result.recordset, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

getFrequencies();
