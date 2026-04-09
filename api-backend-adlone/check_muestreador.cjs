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
        
        console.log('--- COLUMNAS mae_muestreador ---');
        const res = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_muestreador'");
        console.log(JSON.stringify(res.recordset, null, 2));

        console.log('--- USUARIO GENÉRICO APP MÓVIL ---');
        const genericUser = await sql.query("SELECT TOP 1 id_usuario, correo_electronico FROM mae_usuario WHERE correo_electronico LIKE '%app%' OR correo_electronico LIKE '%movil%'");
        console.log(JSON.stringify(genericUser.recordset, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        sql.close();
    }
}

run();
