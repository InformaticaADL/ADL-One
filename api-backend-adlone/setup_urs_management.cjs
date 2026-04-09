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
        
        console.log('--- ACTUALIZANDO NOMBRES DE TIPOS ---');
        await sql.query(`
            UPDATE mae_solicitud_tipo SET nombre = 'Solicitud de Revisión Técnica (Móvil)' WHERE id_tipo = 10;
            UPDATE mae_solicitud_tipo SET nombre = 'Reporte de Extravío/Robo (Móvil)' WHERE id_tipo = 11;
            UPDATE mae_solicitud_tipo SET nombre = 'Anulación de Servicio/Muestreo' WHERE id_tipo = 12;
            UPDATE mae_solicitud_tipo SET nombre = 'Consulta de Gestión/Otros' WHERE id_tipo = 13;
        `);
        console.log('✅ Nombres de Tipos actualizados.');

        console.log('--- ASIGNANDO PERMISOS DE GESTIÓN ---');
        // Limpiamos permisos previos si existen (para evitar duplicados)
        await sql.query(`DELETE FROM rel_solicitud_tipo_permiso WHERE id_tipo IN (10, 11, 12, 13)`);
        
        // 1. Jefe Técnico (Rol 3): Gestiona Problemas Técnicos
        await sql.query(`INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (10, 3, 'GESTION'), (10, 3, 'DESTINO_DERIVACION')`);
        
        // 2. Coordinador (Rol 4): Gestiona Extravíos, Anulaciones y Consultas
        await sql.query(`INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES 
            (11, 4, 'GESTION'), (11, 4, 'DESTINO_DERIVACION'),
            (12, 4, 'GESTION'), (12, 4, 'DESTINO_DERIVACION'),
            (13, 4, 'GESTION'), (13, 4, 'DESTINO_DERIVACION')
        `);

        // 3. Administrador (Rol 1): Gestiona TODO
        await sql.query(`INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso)
            SELECT id_tipo, 1, 'GESTION' FROM mae_solicitud_tipo WHERE id_tipo IN (10,11,12,13)
        `);

        // 4. ENVIO para todos (Para que los técnicos puedan reportar)
        // Usaremos Rol 4 (Coordinador) y Rol 3 (Jefe Técnico) por ahora como base, 
        // pero idealmente todos los que usen la app necesitan ENVIO.
        await sql.query(`INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso)
            SELECT t.id_tipo, r.id_rol, 'ENVIO' 
            FROM mae_solicitud_tipo t CROSS JOIN mae_rol r 
            WHERE t.id_tipo IN (10,11,12,13) AND r.id_rol IN (1, 3, 4)
        `);

        console.log('✅ Permisos de Gestión URS habilitados correctamente.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        sql.close();
    }
}

run();
