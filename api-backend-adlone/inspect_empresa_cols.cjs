const sql = require('mssql');
const config = {
    user: 'sa',
    password: 'MGmerlin.10',
    server: '192.168.10.5',
    database: 'PruebasInformatica',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function run() {
    try {
        await sql.connect(config);
        
        console.log('--- Columns for mae_empresa ---');
        const res1 = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_empresa'");
        console.log(res1.recordset.map(r => r.COLUMN_NAME));
        
        console.log('\n--- Columns for mae_empresaservicios ---');
        const res2 = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_empresaservicios'");
        console.log(res2.recordset.map(r => r.COLUMN_NAME));

    } catch (err) {
        console.error(err);
    } finally {
        await sql.close();
    }
}

run();
