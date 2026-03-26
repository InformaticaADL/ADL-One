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
        let result = await pool.request().query("SELECT * FROM MAE_EVENTO_NOTIFICACION WHERE codigo_evento = 'SOL_EQUIPO_REVISION_NUEVA'");
        const record = result.recordset[0];
        console.log("asunto:", record.asunto_template);
        console.log("descripcion:", record.descripcion);
        console.log("cuerpo:", record.cuerpo_template_html.length > 500 ? "Valid length" : record.cuerpo_template_html);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
test();
