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
        
        console.log('--- Searching for tables/views containing "referencia" or "analisis" ---');
        const res = await sql.query("SELECT name, type FROM sys.objects WHERE (name LIKE '%referencia%' OR name LIKE '%analisis%') AND type IN ('U', 'V') ORDER BY name");
        console.dir(res.recordset, { depth: null });

    } catch (err) {
        console.error(err);
    } finally {
        await sql.close();
    }
}

run();
