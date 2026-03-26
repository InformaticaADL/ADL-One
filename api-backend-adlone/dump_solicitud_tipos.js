
const { getConnection } = require('./src/config/database.js');
const sql = require('mssql');

async function dumpSolicitudTipos() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT * FROM mae_solicitud_tipo");
        console.log(JSON.stringify(result.recordset, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

dumpSolicitudTipos();
