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
        
        console.log('--- Finding tables with column "nombre_referenciaanalisis" ---');
        const res = await sql.query(`
            SELECT t.name AS TableName, c.name AS ColumnName 
            FROM sys.tables t 
            JOIN sys.columns c ON t.object_id = c.object_id 
            WHERE c.name = 'nombre_referenciaanalisis'
        `);
        console.dir(res.recordset, { depth: null });
        
        if (res.recordset.length === 0) {
            console.log('No exact match for "nombre_referenciaanalisis". Searching for partial matches...');
            const res2 = await sql.query("SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME LIKE '%nombre_referencia%' OR COLUMN_NAME LIKE '%analisis%'");
            console.dir(res2.recordset, { depth: null });
        }

    } catch (err) {
        console.error(err);
    } finally {
        await sql.close();
    }
}

run();
