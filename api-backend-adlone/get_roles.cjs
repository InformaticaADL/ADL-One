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
        const roles = await sql.query("SELECT id_rol, nombre_rol FROM mae_rol");
        console.log('ROLES:');
        console.log(JSON.stringify(roles.recordset, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        sql.close();
    }
}

run();
