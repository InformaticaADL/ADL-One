const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        
        // === 1. Check if types 14/15 already exist ===
        const existing = await sql.query("SELECT id_tipo, nombre FROM mae_solicitud_tipo WHERE id_tipo IN (14, 15)");
        console.log('Existing:', existing.recordset);

        if (existing.recordset.length === 0) {
            // Create Type 14: Consulta sobre Equipo
            await sql.query(`
                SET IDENTITY_INSERT mae_solicitud_tipo ON;
                INSERT INTO mae_solicitud_tipo (id_tipo, nombre, area_destino, cod_permiso_crear, cod_permiso_resolver, estado)
                VALUES (14, 'Consulta sobre Equipo', 'TECNICA', 'MUESTREADOR', 'JEFE_TECNICO', 1);
                SET IDENTITY_INSERT mae_solicitud_tipo OFF;
            `);
            console.log('✅ Tipo 14 (Consulta sobre Equipo) creado');

            // Create Type 15: Consulta sobre Ficha/Servicio
            await sql.query(`
                SET IDENTITY_INSERT mae_solicitud_tipo ON;
                INSERT INTO mae_solicitud_tipo (id_tipo, nombre, area_destino, cod_permiso_crear, cod_permiso_resolver, estado)
                VALUES (15, 'Consulta sobre Ficha/Servicio', 'COORD', 'MUESTREADOR', 'COORDINADOR', 1);
                SET IDENTITY_INSERT mae_solicitud_tipo OFF;
            `);
            console.log('✅ Tipo 15 (Consulta sobre Ficha/Servicio) creado');
        } else {
            console.log('Tipos 14/15 ya existen, saltando creación');
        }

        // Update Type 13 name to be "Consulta General/Otro"
        await sql.query("UPDATE mae_solicitud_tipo SET nombre = 'Consulta General/Otro' WHERE id_tipo = 13");
        console.log('✅ Tipo 13 renombrado a "Consulta General/Otro"');

        // === 2. Create UNS Events ===
        const existingEvents = await sql.query("SELECT codigo_evento FROM mae_evento_notificacion WHERE codigo_evento IN ('AVISO_CONSULTA_EQUIPO_NUEVA', 'AVISO_CONSULTA_FICHA_NUEVA')");
        console.log('Existing events:', existingEvents.recordset);

        if (existingEvents.recordset.length === 0) {
            // Get next ID
            const maxId = await sql.query("SELECT MAX(id_evento) as maxId FROM mae_evento_notificacion");
            let nextId = (maxId.recordset[0].maxId || 80) + 1;

            await sql.query(`
                INSERT INTO mae_evento_notificacion (id_evento, codigo_evento, descripcion, asunto_template)
                VALUES (${nextId}, 'AVISO_CONSULTA_EQUIPO_NUEVA', 'Consulta Móvil: Sobre Equipo', 'ADL ONE: Consulta sobre Equipo {CORRELATIVO}')
            `);
            console.log(`✅ Evento AVISO_CONSULTA_EQUIPO_NUEVA creado (id: ${nextId})`);

            nextId++;
            await sql.query(`
                INSERT INTO mae_evento_notificacion (id_evento, codigo_evento, descripcion, asunto_template)
                VALUES (${nextId}, 'AVISO_CONSULTA_FICHA_NUEVA', 'Consulta Móvil: Sobre Ficha/Servicio', 'ADL ONE: Consulta sobre Ficha {CORRELATIVO}')
            `);
            console.log(`✅ Evento AVISO_CONSULTA_FICHA_NUEVA creado (id: ${nextId})`);
        } else {
            console.log('Eventos ya existen, saltando');
        }

        // === 3. Base permissions for types 14 and 15 (Admin gets GESTION + ENVIO) ===
        const existingPerms = await sql.query("SELECT id_tipo FROM rel_solicitud_tipo_permiso WHERE id_tipo IN (14, 15)");
        if (existingPerms.recordset.length === 0) {
            // Type 14 - Admin GESTION
            await sql.query("INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (14, 1, 'GESTION')");
            await sql.query("INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (14, 1, 'ENVIO')");
            // Type 14 - Jefe Técnico GESTION
            await sql.query("INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (14, 3, 'GESTION')");
            await sql.query("INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (14, 3, 'ENVIO')");
            console.log('✅ Permisos tipo 14 creados (Admin + Jefe Técnico)');

            // Type 15 - Admin GESTION
            await sql.query("INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (15, 1, 'GESTION')");
            await sql.query("INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (15, 1, 'ENVIO')");
            console.log('✅ Permisos tipo 15 creados (Admin)');
        } else {
            console.log('Permisos ya existen');
        }

        // === 4. Verify ===
        const allTypes = await sql.query("SELECT id_tipo, nombre, area_destino FROM mae_solicitud_tipo WHERE id_tipo BETWEEN 10 AND 15");
        console.log('\n=== TIPOS CONFIGURADOS ===');
        console.log(JSON.stringify(allTypes.recordset, null, 2));

        const allEvents = await sql.query("SELECT id_evento, codigo_evento, descripcion FROM mae_evento_notificacion WHERE codigo_evento LIKE '%CONSULTA%' OR codigo_evento LIKE '%PERDIDO%' OR codigo_evento LIKE '%PROBLEMA%'");
        console.log('\n=== EVENTOS UNS ===');
        console.log(JSON.stringify(allEvents.recordset, null, 2));

    } catch(e) { 
        console.error(e); 
    } finally { 
        sql.close(); 
    } 
} 
run();
