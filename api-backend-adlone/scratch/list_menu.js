
import 'dotenv/config';
import { getConnection } from '../src/config/database.js';

async function listMenu() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT * FROM mae_menu_modulo');
        console.log('--- mae_menu_modulo ---');
        console.table(result.recordset);
        
        const links = await pool.request().query('SELECT * FROM mae_menu_link');
        console.log('--- mae_menu_link ---');
        console.table(links.recordset);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

listMenu();
