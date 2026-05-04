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
        
        console.log('--- Columns for mae_referenciaanalisis ---');
        const res = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_referenciaanalisis'");
        console.dir(res.recordset.map(c => c.COLUMN_NAME), { maxArrayLength: null });

    } catch (err) {
        console.error(err);
    } finally {
        await sql.close();
    }
}

run();
