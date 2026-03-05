import sql from './src/config/database.js';
import { getConnection } from './src/config/database.js';
import fichaService from './src/services/ficha.service.js';

async function testQuery() {
    try {
        const ficha = await fichaService.getFichaById(91);
        if (ficha) {
            console.log("SUCCESS! Ficha ID:", ficha.id_fichaingresoservicio);
            console.log("Empresa:", ficha.nombre_empresa);
        } else {
            console.log("Ficha returned null.");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit();
    }
}
testQuery();
