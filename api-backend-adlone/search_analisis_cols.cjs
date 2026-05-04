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
        
        console.log('--- Searching for columns with name like %analisis% ---');
        const res = await sql.query("SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME LIKE '%analisis%'");
        console.dir(res.recordset, { depth: null });

    } catch (err) {
        console.error(err);
    } finally {
        await sql.close();
    }
}

run();
