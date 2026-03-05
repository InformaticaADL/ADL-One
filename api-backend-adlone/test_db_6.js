import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function test() {
    try {
        const pool = await getConnection();

        // Check the ficha that the user is editing (ID 96 based on the screenshot)
        const fichaRes = await pool.request().query(`
            SELECT id_fichaingresoservicio, id_empresaservicio
            FROM App_Ma_FichaIngresoServicio_ENC
            WHERE id_fichaingresoservicio = 96
        `);
        console.log("Ficha 96:", fichaRes.recordset[0]);

        const encId = fichaRes.recordset[0].id_empresaservicio;

        // Find which column in mae_empresa matches this ID
        const empRes = await pool.request().query(`
            SELECT id_empresa, id_empresaservicio, nombre_empresa
            FROM mae_empresa
            WHERE id_empresa = ${encId} OR id_empresaservicio = ${encId}
        `);
        console.log("Match in mae_empresa:", empRes.recordset);

        // Check what 'ACUICOLA VOLCANES SPA.' is
        const empNameRes = await pool.request().query(`
            SELECT id_empresa, id_empresaservicio, nombre_empresa
            FROM mae_empresa
            WHERE nombre_empresa LIKE '%VOLCANES%'
        `);
        console.log("Match by name:", empNameRes.recordset);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

test();
