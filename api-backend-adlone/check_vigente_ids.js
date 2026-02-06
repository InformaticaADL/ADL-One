
import { getConnection } from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const pool = await getConnection();

        console.log('--- FICHAS CON ESTADO VIGENTE ---');
        const result = await pool.request().query("SELECT id_fichaingresoservicio, fichaingresoservicio, id_validaciontecnica, estado_ficha FROM App_Ma_FichaIngresoServicio_ENC WHERE estado_ficha = 'VIGENTE'");
        console.table(result.recordset);

        console.log('\n--- FICHAS QUE TRAE EL SP (Muestra de 10) ---');
        const spResult = await pool.request().execute('MAM_FichaComercial_ConsultaCoordinador');
        const spRows = spResult.recordset.slice(0, 10).map(r => ({
            id: r.id,
            estado_texto: r.estado_ficha,
            // We can't see id_val_tecnica in SP output unless the SP returns it. 
            // The modified SP returns id_fichaingresoservicio, so we can cross ref if needed.
        }));
        console.table(spRows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

run();
