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
        
        console.log('--- ESTRUCTURA DE PLANTILLAS ---');
        const res = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_notificacion_plantilla'");
        console.log(res.recordset.map(r => r.COLUMN_NAME));

        console.log('--- BUSCANDO PLANTILLAS URS ---');
        const res2 = await sql.query("SELECT * FROM mae_notificacion_plantilla WHERE codigo_evento LIKE 'AVISO_%'");
        console.log(JSON.stringify(res2.recordset, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        sql.close();
    }
}

run();
