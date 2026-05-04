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
        
        console.log('--- Finding tables with id_referenciaanalisis ---');
        const res = await sql.query(`
            SELECT t.name AS TableName, c.name AS ColumnName 
            FROM sys.tables t 
            JOIN sys.columns c ON t.object_id = c.object_id 
            WHERE c.name = 'id_referenciaanalisis'
        `);
        console.dir(res.recordset, { depth: null });

    } catch (err) {
        console.error(err);
    } finally {
        await sql.close();
    }
}

run();
