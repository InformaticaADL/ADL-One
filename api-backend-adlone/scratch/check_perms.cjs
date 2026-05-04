const sql = require('mssql');
const config = {
    server: '192.168.10.5',
    database: 'PruebasInformatica',
    user: 'sa',
    password: 'MGmerlin.10',
    options: {
        trustServerCertificate: true
    }
};

async function checkPermissions() {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query("SELECT * FROM mae_permiso");
        console.log(JSON.stringify(result.recordset, null, 2));
        await sql.close();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkPermissions();
