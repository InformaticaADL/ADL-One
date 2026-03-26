import { getConnection } from './src/config/database.js';
import sql from 'mssql';
import fichaService from './src/services/ficha.service.js';

async function test() {
    try {
        // Need a valid id and correlativo from the list
        const pool = await getConnection();
        const listResult = await pool.request().query("SELECT TOP 1 id_fichaingresoservicio, frecuencia_correlativo FROM App_Ma_Agenda_MUESTREOS WHERE id_estadomuestreo = 3");
        
        if (listResult.recordset.length === 0) {
            console.log("No executed muestreos found for testing.");
            return;
        }

        const { id_fichaingresoservicio, frecuencia_correlativo } = listResult.recordset[0];
        console.log(`Testing getExecutionDetail for ID: ${id_fichaingresoservicio}, Corr: ${frecuencia_correlativo}`);

        const detail = await fichaService.getExecutionDetail(id_fichaingresoservicio, frecuencia_correlativo);
        console.log("Detail aggregate successful:");
        console.log(" - Agenda found:", !!detail.agenda);
        console.log(" - Parameters count:", detail.parameters.length);
        console.log(" - Equipment count:", detail.equipment.length);
        console.log(" - Media record:", detail.media ? 'Found' : 'Not found');
        console.log(" - Signatures count:", detail.signatures.length);

        await pool.close();
    } catch (err) {
        console.error("Test failed:", err);
    }
}

test();
