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
        let result = await pool.request().query("SELECT codigo_evento, cuerpo_template_html FROM MAE_EVENTO_NOTIFICACION WHERE cuerpo_template_html LIKE '%Go to Request%'");
        console.log('Rows found:', result.recordset.length);
        for (let r of result.recordset) {
            console.log(r.codigo_evento);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
test();
