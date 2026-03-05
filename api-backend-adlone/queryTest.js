import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1433,
    database: process.env.DB_DATABASE || 'ADL_ONE_DB',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
    }
};

async function fixFicha93() {
    let pool;
    try {
        pool = await sql.connect(config);
        const res = await pool.request().query("UPDATE App_Ma_FichaIngresoServicio_ENC SET estado_ficha = 'EN PROCESO' WHERE id_fichaingresoservicio=93 AND id_validaciontecnica=5");
        console.log('Fixed Ficha 93');
    } catch (err) {
        console.error(err);
    } finally {
        if (pool) await pool.close();
        process.exit(0);
    }
}

fixFicha93();
