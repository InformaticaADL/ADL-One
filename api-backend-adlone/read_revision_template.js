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
        let result = await pool.request().query("SELECT cuerpo_template_html FROM MAE_EVENTO_NOTIFICACION WHERE codigo_evento = 'SOL_EQUIPO_REVISION_NUEVA'");
        if (result.recordset.length > 0) {
            console.log('--- CONTENT START ---');
            console.log(result.recordset[0].cuerpo_template_html);
            console.log('--- CONTENT END ---');
        } else {
            console.log('Template not found');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
test();
