const sql = require('mssql');
const { config } = require('./src/config/database.js');

async function run() {
    try {
        await sql.connect(config);
        const q = `
            IF NOT EXISTS (SELECT 1 FROM mae_permiso WHERE codigo = 'INF_SOLICITUDES')
            BEGIN
                INSERT INTO mae_permiso (codigo, nombre, modulo, submodulo, tipo)
                VALUES ('INF_SOLICITUDES', 'Administración de Solicitudes', 'Informática', 'General', 'VISTA')
                
                PRINT 'Permission INF_SOLICITUDES created'
            END
            ELSE
            BEGIN
                PRINT 'Permission INF_SOLICITUDES already exists'
            END
        `;
        const result = await sql.query(q);
        console.log('Success');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
