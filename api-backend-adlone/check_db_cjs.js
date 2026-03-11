const mssql = require('mssql');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT) || 1433,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: false,
        trustServerCertificate: true,
    }
};

async function checkSolicitudes() {
    try {
        const pool = await mssql.connect(config);
        console.log('Connected to DB');

        const result = await pool.request().query("SELECT TOP 20 id_solicitud, tipo_solicitud, estado, estado_tecnica, seccion FROM mae_solicitud_equipo WHERE estado IN ('PENDIENTE_CALIDAD', 'PENDIENTE_TECNICA', 'EN_REVISION') ORDER BY id_solicitud DESC");
        console.log('Pending/Derived Solicitudes:');
        console.table(result.recordset);

        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

checkSolicitudes();
