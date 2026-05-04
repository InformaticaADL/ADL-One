import fs from 'fs';
import path from 'path';
import { getConnection } from './src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
        
        // Check inspectores
        const inspRes = await pool.request().execute('consulta_inspectorambiental');
        const inspectores = inspRes.recordset.map(r => r.nombre_inspector || r.nombre);
        console.log("Inspectores:", inspectores.slice(0, 10));

        // Check mae_referenciaanalisis
        const refRes = await pool.request().query(`
                SELECT TOP 5 ra.id_referenciaanalisis, ra.nombre_referenciaanalisis, ra.id_normativareferencia, ra.id_tecnica
                FROM mae_referenciaanalisis ra
            `);
        console.log("Referencias Analisis:", refRes.recordset);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();

async function run() {
    try {
        const filePath = 'C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\temp_bulk_pdfs\\formato_test.pdf';
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        console.log("--- RAW EXTRACTED TEXT ---");
        console.log(data.text);
        console.log("--------------------------");

        // Let's connect to DB and check the inspector name
        const pool = await getConnection();
        const inspRes = await pool.request().execute('consulta_inspectorambiental');
        
        console.log("--- CATÁLOGO INSPECTORES ---");
        const inspectores = inspRes.recordset.map(r => ({ id: r.id_inspectorambiental || r.id, nombre: r.nombre_inspector || r.nombre }));
        console.log(inspectores);
        
        // Find "Pablo Flores" or "Flores" in the catalog
        const found = inspectores.filter(i => i.nombre.toLowerCase().includes('pablo') || i.nombre.toLowerCase().includes('flores'));
        console.log("Buscando Pablo Flores:", found);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
