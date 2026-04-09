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
        
        // 1. Fix Hub Visibility
        await sql.query("UPDATE mae_evento_notificacion SET es_transaccional = 0 WHERE codigo_evento LIKE 'AVISO_%'");
        console.log('✅ Visibilidad del Hub corregida (URS > General)');

        // 2. Add Notification Flag (Independence)
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('mae_solicitud') AND name = 'notificado_uns')
            ALTER TABLE mae_solicitud ADD notificado_uns BIT DEFAULT 0 WITH VALUES
        `);
        console.log('✅ Columna notificado_uns habilitada');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        sql.close();
    }
}

run();
