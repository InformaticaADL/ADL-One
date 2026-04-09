const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        
        // 1. Current type 13 config
        console.log('=== TIPO 13 (Consulta de Gestión) ===');
        const t13 = await sql.query("SELECT * FROM mae_solicitud_tipo WHERE id_tipo = 13");
        console.log(JSON.stringify(t13.recordset, null, 2));

        // 2. All mobile types (10-13)
        console.log('\n=== TIPOS MOVILES (10-13) ===');
        const mobile = await sql.query("SELECT id_tipo, nombre, area_destino, estado FROM mae_solicitud_tipo WHERE id_tipo BETWEEN 10 AND 15");
        console.log(JSON.stringify(mobile.recordset, null, 2));

        // 3. Permissions for type 13
        console.log('\n=== PERMISOS TIPO 13 ===');
        const perms = await sql.query("SELECT p.*, r.nombre_rol, u.usuario FROM rel_solicitud_tipo_permiso p LEFT JOIN mae_rol r ON p.id_rol = r.id_rol LEFT JOIN mae_usuario u ON p.id_usuario = u.id_usuario WHERE p.id_tipo = 13");
        console.log(JSON.stringify(perms.recordset, null, 2));

        // 4. Notification config for type 13
        console.log('\n=== NOTIFICACIONES TIPO 13 ===');
        const notif = await sql.query("SELECT * FROM rel_solicitud_tipo_notificacion WHERE id_tipo = 13");
        console.log(JSON.stringify(notif.recordset, null, 2));

        // 5. Existing requests of type 13
        console.log('\n=== SOLICITUDES TIPO 13 (últimas 5) ===');
        const reqs = await sql.query("SELECT TOP 5 id_solicitud, datos_json, observaciones, fecha_creacion FROM mae_solicitud WHERE id_tipo = 13 ORDER BY id_solicitud DESC");
        console.log(JSON.stringify(reqs.recordset, null, 2));

        // 6. UNS event for consulta
        console.log('\n=== EVENTO AVISO_CONSULTA_NUEVA ===');
        const ev = await sql.query("SELECT id_evento, codigo_evento, descripcion, asunto_template FROM mae_evento_notificacion WHERE codigo_evento LIKE '%CONSULTA%'");
        console.log(JSON.stringify(ev.recordset, null, 2));

        // 7. UNS dispatch rules for consulta
        console.log('\n=== DISPATCH RULES CONSULTA ===');
        const disp = await sql.query("SELECT d.* FROM mae_evento_notificacion e JOIN mae_uns_dispatch d ON e.id_evento = d.id_evento WHERE e.codigo_evento LIKE '%CONSULTA%'");
        console.log(JSON.stringify(disp.recordset, null, 2));

    } catch(e) { console.error(e); } finally { sql.close(); } 
} 
run();
