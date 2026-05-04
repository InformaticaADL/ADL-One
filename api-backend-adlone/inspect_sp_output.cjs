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
        
        console.log('--- Calling SP: Consulta_App_Ma_ReferenciaAnalisis ---');
        const res = await sql.query("DECLARE @xid_normativareferencia INT = 1; EXEC Consulta_App_Ma_ReferenciaAnalisis @xid_normativareferencia");
        if (res.recordset.length > 0) {
            console.log('Columns:');
            console.log(Object.keys(res.recordset[0]));
            // Also print a sample row to see values
            console.log('\nSample Row:');
            console.dir(res.recordset[0], { depth: null });
        } else {
            console.log('No results returned from SP.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await sql.close();
    }
}

run();
