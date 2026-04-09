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
        
        console.log('\n--- NUEVOS TIPOS DE SOLICITUD (id_tipo) ---');
        const types = await sql.query("SELECT id_tipo, nombre FROM mae_solicitud_tipo WHERE nombre LIKE 'Móvil:%'");
        console.log(JSON.stringify(types.recordset, null, 2));

        console.log('\n--- NUEVOS EVENTOS DE NOTIFICACIÓN (id_evento) ---');
        const events = await sql.query("SELECT id_evento, codigo_evento, descripcion FROM mae_evento_notificacion WHERE codigo_evento LIKE 'AVISO_%'");
        console.log(JSON.stringify(events.recordset, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        sql.close();
    }
}

run();
