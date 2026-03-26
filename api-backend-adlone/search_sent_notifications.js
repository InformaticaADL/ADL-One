import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT, 10),
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function test() {
    try {
        let pool = await sql.connect(config);
        console.log('Searching in MAE_NOTIFICACION...');
        let result = await pool.request().query("SELECT TOP 10 * FROM MAE_NOTIFICACION WHERE mensaje LIKE '%Go to Request%' OR mensaje LIKE '%cta_text%'");
        console.log('Results:', result.recordset.length);
        for (let row of result.recordset) {
            console.log('ID:', row.id_notificacion);
            console.log('Mensaje:', row.mensaje);
            console.log('---');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
test();
