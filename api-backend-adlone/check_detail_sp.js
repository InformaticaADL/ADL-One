
import { getConnection } from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("sp_helptext 'MAM_FichaComercial_ConsultaCoordinadorDetalle'");
        console.log(result.recordset.map(r => r.Text).join(''));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

run();
