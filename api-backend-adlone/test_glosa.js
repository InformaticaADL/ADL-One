import { getConnection } from './src/config/database.js';

async function testQuery() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT *
            FROM App_Ma_FichaIngresoServicio_ENC 
            WHERE fichaingresoservicio = '93' OR id_fichaingresoservicio = 93
        `);
        console.log("Ficha 93 query results:");
        if (result.recordset.length > 0) {
            const row = result.recordset[0];
            for (const key in row) {
                if (row[key] !== null) {
                    console.log(`${key}: ${row[key]}`);
                }
            }
        } else {
            console.log("No record found for Ficha 93");
        }
        process.exit(0);
    } catch (error) {
        console.error("Error connecting or querying:", error);
        process.exit(1);
    }
}

testQuery();
