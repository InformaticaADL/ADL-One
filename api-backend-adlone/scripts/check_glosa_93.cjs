const sql = require('mssql');
const { getConnection } = require('../src/config/db.config.js');

async function testQuery() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT id_fichaingresoservicio, tipo_fichaingresoservicio, id_tabla, nombre_tabla_largo, 
            id_normativa, nombre_normativa, id_normativareferencia, nombre_normativareferencia,
            id_actividadmuestreo, nombre_actividadmuestreo
            FROM App_Ma_FichaIngresoServicio_ENC 
            WHERE fichaingresoservicio = '93' OR id_fichaingresoservicio = 93
        `);
        console.log("Ficha 93 query results:");
        console.dir(result.recordset, { depth: null });
        process.exit(0);
    } catch (error) {
        console.error("Error connecting or querying:", error);
        process.exit(1);
    }
}

testQuery();
