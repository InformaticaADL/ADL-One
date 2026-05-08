import { getConnection } from './src/config/database.js';

async function fixPerms() {
    try {
        const pool = await getConnection();
        const mods = await pool.request().query("SELECT permissions_str FROM mae_menu_modulo WHERE id_modulo = 'medio_ambiente'");
        if (mods.recordset.length > 0) {
            let perms = mods.recordset[0].permissions_str;
            console.log('Original perms:', perms);
            
            // Remove MA_COMERCIAL_HISTORIAL_ACCESO
            perms = perms.split(',').map(p => p.trim()).filter(p => p !== 'MA_COMERCIAL_HISTORIAL_ACCESO').join(',');
            
            console.log('New perms:', perms);
            
            await pool.request()
                .input('perms', perms)
                .query("UPDATE mae_menu_modulo SET permissions_str = @perms WHERE id_modulo = 'medio_ambiente'");
            
            console.log('Updated medio_ambiente permissions in mae_menu_modulo');
        }
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
fixPerms();
