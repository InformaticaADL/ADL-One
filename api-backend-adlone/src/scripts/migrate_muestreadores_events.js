import dotenv from 'dotenv';
dotenv.config();
import { getConnection, closeConnection } from '../config/database.js';

const MINIMAL_TEMPLATE = `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px; font-family: Arial, sans-serif;">
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Solicitante:</strong> <span style="color: #475569;">{SOLICITANTE}</span></td></tr>
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Fecha y Hora:</strong> <span style="color: #475569;">{FECHA} a las {HORA}</span></td></tr>
</table>

{EQUIPOS_DETALLE}

{BLOQUE_OBSERVACION|{ETIQUETA_OBSERVACION}}`;

async function migrateMuestreadoresEvents() {
    console.log("🚀 Iniciando migración de plantillas de Muestreadores/Traspaso...");
    
    try {
        const pool = await getConnection();
        
        const eventsToUpdate = [
            'SOL_TRASPASO_SEDE_NUEVA',
            'SOL_TRASPASO_MUESTREADOR_NUEVA',
            'SOL_TRASPASO_AMBOS_NUEVA',
            'SOL_DESHABILITAR_MUESTREADOR_NUEVA'
        ];

        let successCount = 0;

        for (const code of eventsToUpdate) {
            const updateRes = await pool.request()
                .input('code', code)
                .input('body', MINIMAL_TEMPLATE)
                .query(`
                    UPDATE mae_evento_notificacion 
                    SET cuerpo_template_html = @body 
                    WHERE codigo_evento = @code
                `);

            if (updateRes.rowsAffected[0] > 0) {
                console.log(`✅ Migrado: ${code}`);
                successCount++;
            } else {
                console.log(`⚠️ No encontrado o no actualizado: ${code}`);
            }
        }

        console.log(`\n🎉 Migración completada. ${successCount} plantillas actualizadas exitosamente.`);

    } catch (err) {
        console.error("❌ Error durante la migración:", err);
    } finally {
        await closeConnection();
    }
}

migrateMuestreadoresEvents();
