import { getConnection } from './src/config/database.js';
import sql from 'mssql';
try {
    const pool = await getConnection();

    // IDs de los nuevos permisos
    const ids = [45, 46]; // AI_MA_NOTIF_REC, AI_MA_NOTIF_ENV

    console.log('--- Limpiando relaciones huérfanas ---');
    const result = await pool.request()
        .query(`DELETE FROM rel_rol_permiso WHERE id_permiso IN (${ids.join(',')})`);

    console.log(`✅ Se eliminaron ${result.rowsAffected[0]} vínculos antiguos de la tabla rel_rol_permiso.`);
    console.log('Ahora el administrador puede asignar estos permisos desde la interfaz profesionalmente.');
} catch (e) {
    console.error(e);
} finally {
    process.exit(0);
}
