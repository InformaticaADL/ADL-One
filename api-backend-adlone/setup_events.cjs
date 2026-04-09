const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        
        // Insert events without explicit ID (let identity auto-assign)
        const existingEvents = await sql.query("SELECT codigo_evento FROM mae_evento_notificacion WHERE codigo_evento IN ('AVISO_CONSULTA_EQUIPO_NUEVA', 'AVISO_CONSULTA_FICHA_NUEVA')");
        
        if (existingEvents.recordset.length === 0) {
            await sql.query(`
                INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template)
                VALUES ('AVISO_CONSULTA_EQUIPO_NUEVA', 'Consulta Móvil: Sobre Equipo', 'ADL ONE: Consulta sobre Equipo')
            `);
            console.log('✅ Evento AVISO_CONSULTA_EQUIPO_NUEVA creado');

            await sql.query(`
                INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template)
                VALUES ('AVISO_CONSULTA_FICHA_NUEVA', 'Consulta Móvil: Sobre Ficha/Servicio', 'ADL ONE: Consulta sobre Ficha/Servicio')
            `);
            console.log('✅ Evento AVISO_CONSULTA_FICHA_NUEVA creado');
        } else {
            console.log('Eventos ya existen');
        }

        // Verify all events
        const events = await sql.query("SELECT id_evento, codigo_evento, descripcion FROM mae_evento_notificacion WHERE codigo_evento LIKE '%CONSULTA%' OR codigo_evento LIKE '%PERDIDO%' OR codigo_evento LIKE '%PROBLEMA%'");
        console.log('\n=== EVENTOS UNS ===');
        console.log(JSON.stringify(events.recordset, null, 2));

        // Verify all mobile types
        const types = await sql.query("SELECT id_tipo, nombre, area_destino FROM mae_solicitud_tipo WHERE id_tipo BETWEEN 10 AND 15");
        console.log('\n=== TIPOS ===');
        console.log(JSON.stringify(types.recordset, null, 2));

        // Verify perms
        const perms = await sql.query("SELECT p.id_tipo, p.tipo_acceso, r.nombre_rol FROM rel_solicitud_tipo_permiso p LEFT JOIN mae_rol r ON p.id_rol = r.id_rol WHERE p.id_tipo IN (14, 15)");
        console.log('\n=== PERMISOS 14/15 ===');
        console.log(JSON.stringify(perms.recordset, null, 2));

    } catch(e) { console.error(e); } finally { sql.close(); } 
} 
run();
