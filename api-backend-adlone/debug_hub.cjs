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
        
        console.log('\n--- EVENTOS AVISO ---');
        const events = await sql.query("SELECT id_evento, codigo_evento, id_funcionalidad, oculto_en_hub FROM mae_evento_notificacion WHERE codigo_evento LIKE 'AVISO_%'");
        console.log(JSON.stringify(events.recordset, null, 2));

        console.log('\n--- MODULOS Y FUNCIONALIDADES ---');
        const structure = await sql.query(`
            SELECT m.id_modulo, m.nombre as modulo, f.id_funcionalidad, f.nombre as funcionalidad
            FROM mae_notificacion_modulo m
            JOIN mae_notificacion_funcionalidad f ON m.id_modulo = f.id_modulo
        `);
        console.log(JSON.stringify(structure.recordset, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        sql.close();
    }
}

run();
