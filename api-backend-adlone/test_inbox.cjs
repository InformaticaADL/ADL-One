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
        console.log('--- TEST GET ALL REQUESTS ---');
        await sql.connect(config);
        const request = new sql.Request();
        
        // Let's do a raw query similar to getRequests to see if 118 is excluded
        const query = `
            SELECT DISTINCT s.id_solicitud, s.estado, s.id_tipo, u.usuario as nombre_solicitante 
            FROM mae_solicitud s
            JOIN mae_solicitud_tipo t ON s.id_tipo = t.id_tipo
            JOIN mae_usuario u ON s.id_solicitante = u.id_usuario
            WHERE s.id_solicitud = 118
        `;
        const res = await request.query(query);
        console.log("Raw query for 118:", res.recordset);
        
        // Testing with permissions via user 464 (vremolcoy)
        const queryPerms = `
            SELECT DISTINCT s.id_solicitud
            FROM mae_solicitud s
            JOIN mae_solicitud_tipo t ON s.id_tipo = t.id_tipo
            JOIN mae_usuario u ON s.id_solicitante = u.id_usuario
            LEFT JOIN rel_solicitud_tipo_permiso p ON s.id_tipo = p.id_tipo AND p.tipo_acceso IN ('GESTION', 'VISTA')
            LEFT JOIN rel_usuario_rol ur ON (p.id_rol = ur.id_rol AND ur.id_usuario = 464)
            WHERE s.id_solicitud = 118 AND (
                s.id_solicitante = 464
                OR p.id_usuario = 464
                OR ur.id_rol IS NOT NULL
            )
        `;
        const resPerms = await request.query(queryPerms);
        console.log("Query with Perms for 464:", resPerms.recordset);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        sql.close();
    }
}

run();
