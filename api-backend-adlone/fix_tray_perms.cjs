const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        
        const perms = [
            { id_tipo: 12, id_rol: 3, tipo_acceso: 'GESTION' },
            { id_tipo: 13, id_rol: 3, tipo_acceso: 'GESTION' },
            { id_tipo: 15, id_rol: 3, tipo_acceso: 'GESTION' },
            { id_tipo: 15, id_rol: 4, tipo_acceso: 'GESTION' },
            { id_tipo: 12, id_rol: 4, tipo_acceso: 'GESTION' },
            { id_tipo: 15, id_rol: 5, tipo_acceso: 'GESTION' }
        ];

        for (const p of perms) {
            await sql.query(`
                IF NOT EXISTS (SELECT 1 FROM rel_solicitud_tipo_permiso WHERE id_tipo = ${p.id_tipo} AND id_rol = ${p.id_rol} AND tipo_acceso = '${p.tipo_acceso}')
                BEGIN
                    INSERT INTO rel_solicitud_tipo_permiso (id_tipo, id_rol, tipo_acceso)
                    VALUES (${p.id_tipo}, ${p.id_rol}, '${p.tipo_acceso}');
                END
            `);
        }

        console.log('✅ Permisos GESTION actualizados');

    } catch(e) { console.error(e); } finally { sql.close(); } 
} 
run();
