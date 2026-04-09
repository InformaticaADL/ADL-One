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
        
        console.log('--- REVISANDO NOTIFICACIONES EXISTENTES ---');
        const notifs = await sql.query("SELECT * FROM mae_notificacion WHERE id_referencia = 117");
        console.log("Notificaciones 117:", JSON.stringify(notifs.recordset, null, 2));

        console.log('--- REVISANDO ROL DEL USUARIO APP Y WEB ---');
        const userAndRoles = await sql.query("SELECT u.id_usuario, u.nombre_usuario, r.nombre_rol FROM mae_usuario u JOIN rel_usuario_rol ur ON u.id_usuario = ur.id_usuario JOIN mae_rol r ON ur.id_rol = r.id_rol WHERE u.id_usuario = 229 OR u.correo_electronico LIKE '%vremolcoy%' OR u.usuario = 'vremolcoy.v'");
        console.log("Roles del usuario:", JSON.stringify(userAndRoles.recordset, null, 2));

        console.log('--- RESETEANDO VIGILANTE PARA PRUEBA ---');
        await sql.query("UPDATE mae_solicitud SET notificado_uns = 0 WHERE id_solicitud = 117");
        console.log('Registro 117 seteado a notificado_uns=0. Esperando 20 segundos para que el Vigilante lo recoja...');
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        sql.close();
    }
}

run();
