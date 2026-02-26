const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '123456',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'ADL_One',
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function checkPerms() {
    try {
        const pool = await sql.connect(config);
        const res = await pool.request().query("SELECT codigo, nombre, modulo, submodulo FROM mae_permiso WHERE codigo LIKE '%MA%' OR modulo IN ('AI', 'Medio Ambiente') ORDER BY modulo, submodulo;");
        console.table(res.recordset);
    } catch (err) {
        console.error(err);
    } finally {
        sql.close();
        process.exit();
    }
}
checkPerms();
