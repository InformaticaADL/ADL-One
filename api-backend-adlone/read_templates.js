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
        let result = await pool.request().query("SELECT codigo_evento, cuerpo_template_html, asunto_template FROM MAE_EVENTO_NOTIFICACION");
        for (let row of result.recordset) {
            if (row.cuerpo_template_html && (row.cuerpo_template_html.includes('Go to Request') || row.cuerpo_template_html.includes('cta_text') || row.cuerpo_template_html.includes('ld+json'))) {
                console.log('MATCH FOUND IN:', row.codigo_evento);
                console.log('HTML:', row.cuerpo_template_html);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
test();
