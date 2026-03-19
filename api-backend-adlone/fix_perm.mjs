import sql from 'mssql';
import { getConnection } from './src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
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
        await sql.query(q);
        console.log('Success');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
