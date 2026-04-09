const sql = require('mssql');
const config = {
    server: '192.168.10.5',
    port: 1433,
    database: 'PruebasInformatica',
    user: 'sa',
    password: 'MGmerlin.10',
    options: {
        trustServerCertificate: true
    }
};

async function run() {
    try {
        await sql.connect(config);
        const schema = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_solicitud'");
        console.log('SCHEMA:');
        console.log(JSON.stringify(schema.recordset, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        sql.close();
    }
}

run();
