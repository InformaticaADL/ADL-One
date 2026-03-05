import sql from './src/config/database.js';
import { getConnection } from './src/config/database.js';

async function testQuery() {
    try {
        const pool = await getConnection();
        // find a valid Ficha using the SP from recent IDs
        for (let i = 100; i > 0; i--) {
            const requestEnc = pool.request();
            requestEnc.input('xunafichacomercial', i);
            const resultEnc = await requestEnc.execute('MAM_FichaComercial_ConsultaComercial_ENC_unaficha');
            if (resultEnc.recordset && resultEnc.recordset.length > 0) {
                console.log(`Found working SP for ID ${i}`);
                console.log(Object.keys(resultEnc.recordset[0]));
                console.log(resultEnc.recordset[0]);
                break;
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

testQuery();
