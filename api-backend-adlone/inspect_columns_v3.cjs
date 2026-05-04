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
        
        console.log('--- Searching for analysis reference table ---');
        const res = await sql.query("SELECT name FROM sys.tables WHERE name LIKE '%referencia%'");
        console.dir(res.recordset.map(r => r.name));

        const namesToTry = ['mae_referenciaanalisis', 'MAE_REFERENCIAANALISIS', 'mae_referencia_analisis'];
        for (const name of namesToTry) {
            try {
                const cols = await sql.query(`SELECT TOP 0 * FROM ${name}`);
                console.log(`\nTable ${name} found! Columns:`);
                console.log(Object.keys(cols.recordset.columns));
                break;
            } catch (e) {
                // console.log(`Table ${name} not found: ${e.message}`);
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sql.close();
    }
}

run();
