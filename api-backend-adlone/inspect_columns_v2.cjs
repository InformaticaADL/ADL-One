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
        
        console.log('--- Columns for mae_referenciaanalisis (case insensitive) ---');
        // Get all columns from the table regardless of INFORMATION_SCHEMA quirks
        const res = await sql.query("SELECT TOP 1 * FROM mae_referenciaanalisis");
        if (res.recordset.length > 0) {
            console.log(Object.keys(res.recordset[0]));
        } else {
            console.log('Table exists but has no data - cannot infer columns via SELECT TOP 1');
            // Try information schema with upper
            const res2 = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE UPPER(TABLE_NAME) = 'MAE_REFERENCIAANALISIS'");
            console.log(res2.recordset.map(c => c.COLUMN_NAME));
        }

    } catch (err) {
        console.error('Error querying table:', err.message);
    } finally {
        await sql.close();
    }
}

run();
