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

async function run() {
    try {
        let pool = await sql.connect(config);
        
        console.log('--- Searching in MAE_EVENTO_NOTIFICACION ---');
        let templates = await pool.request().query("SELECT codigo_evento, cuerpo_template_html, asunto_template FROM MAE_EVENTO_NOTIFICACION");
        
        for (const row of templates.recordset) {
            const html = row.cuerpo_template_html || '';
            const asunto = row.asunto_template || '';
            
            if (html.toLowerCase().includes('cta') || html.toLowerCase().includes('request') || html.toLowerCase().includes('json')) {
                console.log(`[HTML Match] Event: ${row.codigo_evento}`);
                console.log(html);
            }
            if (asunto.toLowerCase().includes('cta') || asunto.toLowerCase().includes('request') || asunto.toLowerCase().includes('json')) {
                console.log(`[Subject Match] Event: ${row.codigo_evento}`);
                console.log(asunto);
            }
        }

        console.log('--- Searching in MAE_SOLICITUD_TIPO ---');
        let types = await pool.request().query("SELECT nombre, descripcion FROM mae_solicitud_tipo");
        for (const row of types.recordset) {
            if (row.nombre.includes('{') || (row.descripcion && row.descripcion.includes('{'))) {
                console.log(`[Type Match] Type: ${row.nombre}`);
                console.log(row.descripcion);
            }
        }

        console.log('--- Searching for any column containing the JSON fragment ---');
        let searchStr = 'Go to Request';
        let cols = await pool.request().query(`
            SELECT t.name AS table_name, c.name AS column_name
            FROM sys.tables t
            JOIN sys.columns c ON t.object_id = c.object_id
            JOIN sys.types ty ON c.user_type_id = ty.user_type_id
            WHERE ty.name IN ('varchar', 'nvarchar', 'text', 'ntext')
        `);
        
        for (const col of cols.recordset) {
            try {
                let res = await pool.request().query(`SELECT TOP 1 [${col.column_name}] FROM [${col.table_name}] WHERE [${col.column_name}] LIKE '%${searchStr}%'`);
                if (res.recordset.length > 0) {
                    console.log(`FOUND '${searchStr}' in Table: ${col.table_name}, Column: ${col.column_name}`);
                    console.log(res.recordset[0][col.column_name]);
                }
            } catch (e) {}
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
