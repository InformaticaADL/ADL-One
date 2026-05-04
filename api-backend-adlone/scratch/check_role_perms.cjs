const sql = require('mssql');
const config = {
    server: '192.168.10.5',
    database: 'PruebasInformatica',
    user: 'sa',
    password: 'MGmerlin.10',
    options: {
        trustServerCertificate: true
    }
};

async function checkRolePerms() {
    try {
        const pool = await sql.connect(config);
        
        console.log('--- Roles having MA_A_GEST_EQUIPO ---');
        const rolesGest = await pool.request().query(`
            SELECT r.id_rol, r.nombre_rol 
            FROM mae_rol r
            JOIN rel_rol_permiso rp ON r.id_rol = rp.id_rol
            JOIN mae_permiso p ON rp.id_permiso = p.id_permiso
            WHERE p.codigo = 'MA_A_GEST_EQUIPO'
        `);
        console.log(JSON.stringify(rolesGest.recordset, null, 2));

        console.log('\n--- Roles having EQ_VER_SOLICITUD ---');
        const rolesVer = await pool.request().query(`
            SELECT r.id_rol, r.nombre_rol 
            FROM mae_rol r
            JOIN rel_rol_permiso rp ON r.id_rol = rp.id_rol
            JOIN mae_permiso p ON rp.id_permiso = p.id_permiso
            WHERE p.codigo = 'EQ_VER_SOLICITUD'
        `);
        console.log(JSON.stringify(rolesVer.recordset, null, 2));

        await sql.close();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkRolePerms();
