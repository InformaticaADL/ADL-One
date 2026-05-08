import { getConnection } from './src/config/database.js';

async function check() {
    try {
        const pool = await getConnection();
        const mods = await pool.request().query("SELECT * FROM mae_menu_modulo WHERE id_modulo IN ('medio_ambiente', 'gem')");
        console.log('Modules:', mods.recordset);
        const links = await pool.request().query("SELECT * FROM mae_menu_link WHERE id_modulo IN ('medio_ambiente', 'gem')");
        console.log('Links:', links.recordset);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
check();
