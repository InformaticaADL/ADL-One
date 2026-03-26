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
        console.log('Fetching all templates...');
        let result = await pool.request().query("SELECT codigo_evento, asunto_template, cuerpo_template_html FROM MAE_EVENTO_NOTIFICACION");
        
        for (let row of result.recordset) {
            const html = row.cuerpo_template_html || '';
            if (html.includes('{"') || html.includes('Go to Request')) {
                console.log('MATCH FOUND in event:', row.codigo_evento);
                console.log('HTML:', html);
                console.log('---');
            }
        }
        console.log('Done.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
test();
