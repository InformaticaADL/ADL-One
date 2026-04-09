const sql = require('mssql'); 
async function run() { 
    try { 
        await sql.connect({ server: '192.168.10.5', port: 1433, database: 'PruebasInformatica', user: 'sa', password: 'MGmerlin.10', options: { trustServerCertificate: true } }); 
        
        const updateTemplate = async (codigo, asuntoText) => {
            const res = await sql.query(`SELECT cuerpo_template_html FROM mae_evento_notificacion WHERE codigo_evento = '${codigo}'`);
            if (res.recordset.length === 0) return;
            
            let html = res.recordset[0].cuerpo_template_html;
            
            // 1. Add "Asunto" line
            const matchBox = /<h4 style="margin:0 0 10px 0;color:#dc3545;font-size:15px;">Detalles del Aviso Móvil:<\/h4>\s*<div style="font-size:14px;color:#1e293b;">/;
            html = html.replace(matchBox, `$&<strong>Asunto:</strong> <span style="color:#333333;">${asuntoText}</span><br>`);
            
            // 2. Remove "Estado Inicial" line
            html = html.replace(/<strong>Estado Inicial:<\/strong>\s*{estado_legible}\s*<br>?/g, '');
            html = html.replace(/<strong>Estado Inicial:<\/strong>\s*{estado_legible}/g, '');
            
            // 3. Ensure {equipo_nombre} placeholder is treated as the full name (we already pass it as equipo_nombre in trigger)
            
            await sql.query(`UPDATE mae_evento_notificacion SET cuerpo_template_html = N'${html.replace(/'/g, "''")}' WHERE codigo_evento = '${codigo}'`);
            console.log(`✅ Plantilla ${codigo} actualizada`);
        };

        await updateTemplate('AVISO_PERDIDO_NUEVO', 'Extravío de equipo');
        await updateTemplate('AVISO_PROBLEMA_NUEVO', 'Solicitud de revisión técnica');
        
    } catch(e) { 
        console.error(e); 
    } finally { 
        sql.close(); 
    } 
} 
run();
