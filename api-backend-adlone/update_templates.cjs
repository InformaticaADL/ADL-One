const sql = require('mssql');
const fs = require('fs');

const config = {
    server: '192.168.10.5',
    port: 1433,
    database: 'PruebasInformatica',
    user: 'sa',
    password: 'MGmerlin.10',
    options: { trustServerCertificate: true }
};

const baseHtml = fs.readFileSync('template.html', 'utf8');

const events = [
    { code: 'AVISO_PROBLEMA_NUEVO', desc: 'Aviso: Problema Técnico (App)', asunto: 'ADL ONE: Reporte de Problema Técnico {CORRELATIVO}' },
    { code: 'AVISO_PERDIDO_NUEVO', desc: 'Aviso: Extravío de Equipo (App)', asunto: 'ADL ONE: Informe de Extravío/Robo {CORRELATIVO}' },
    { code: 'AVISO_CANCELACION_NUEVA', desc: 'Aviso: Cancelación de Muestreo (App)', asunto: 'ADL ONE: Reporte Cancelación de Servicio {CORRELATIVO}' },
    { code: 'AVISO_CONSULTA_NUEVA', desc: 'Aviso: Consulta Terreno (App)', asunto: 'ADL ONE: Consulta desde App Móvil {CORRELATIVO}' }
];

async function run() {
    try {
        await sql.connect(config);
        const req = new sql.Request();
        
        for(let e of events) {
            const check = await req.query("SELECT id_evento FROM mae_evento_notificacion WHERE codigo_evento = '" + e.code + "'");
            if(check.recordset.length > 0) {
                console.log('Update', e.code);
                await req.query("UPDATE mae_evento_notificacion SET asunto_template='" + e.asunto + "', cuerpo_template_html='" + baseHtml.replace(/'/g, "''") + "' WHERE codigo_evento='" + e.code + "'");
            } else {
                console.log('Insert', e.code);
                await req.query("INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, cuerpo_template_html, modulo, id_funcionalidad, es_transaccional, oculto_en_hub) VALUES ('" + e.code + "', '" + e.desc + "', '" + e.asunto + "', '" + baseHtml.replace(/'/g, "''") + "', 'URS', NULL, 1, 0)");
            }
        }
        console.log("Templates listos!");
    } catch(err) {
        console.error(err);
    } finally {
        sql.close();
    }
}
run();
