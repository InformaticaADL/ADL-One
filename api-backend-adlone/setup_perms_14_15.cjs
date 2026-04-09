const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        
        // Clear existing to avoid PK errors if any exist
        await sql.query("DELETE FROM rel_solicitud_tipo_permiso WHERE id_tipo IN (14, 15)");

        // Type 14 - Consulta Equipo (TECNICA)
        // Admin (1), Jefe Técnico (3)
        const roles14 = [1, 3];
        for (const roleId of roles14) {
            await sql.query(`INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (14, ${roleId}, 'GESTION')`);
            await sql.query(`INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (14, ${roleId}, 'ENVIO')`);
        }

        // Type 15 - Consulta Ficha (COORD)
        // Admin (1), Coordinador (5 - verify if this is the correct ID, usually it is)
        // From audit: Admin is 1, Jefe Técnico is 3. Let's add Admin and Coordinador.
        const roles15 = [1, 5]; 
        for (const roleId of roles15) {
            await sql.query(`INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (15, ${roleId}, 'GESTION')`);
            await sql.query(`INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso) VALUES (15, ${roleId}, 'ENVIO')`);
        }

        console.log('✅ Permisos para tipos 14 y 15 creados correctamente');

        const verify = await sql.query("SELECT p.id_tipo, r.nombre_rol, p.tipo_acceso FROM rel_solicitud_tipo_permiso p JOIN mae_rol r ON p.id_rol = r.id_rol WHERE p.id_tipo IN (14, 15)");
        console.log(JSON.stringify(verify.recordset, null, 2));

    } catch(e) { console.error(e); } finally { sql.close(); } 
} 
run();
