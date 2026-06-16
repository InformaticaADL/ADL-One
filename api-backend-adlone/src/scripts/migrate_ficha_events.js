import dotenv from 'dotenv';
dotenv.config();
import { getConnection, closeConnection } from '../config/database.js';

const TEMPLATE = `
<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px; font-family: Arial, sans-serif;">
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Tipo de Monitoreo:</strong> <span style="color: #475569;">{TIPO_FICHA_INFO}</span></td></tr>
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Base de Operaciones:</strong> <span style="color: #475569;">{BASE_OPERACIONES}</span></td></tr>
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Empresa a Facturar:</strong> <span style="color: #475569;">{EMPRESA_FACTURAR}</span></td></tr>
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Empresa Servicio:</strong> <span style="color: #475569;">{EMPRESA_SERVICIO}</span></td></tr>
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Fuente Emisora:</strong> <span style="color: #475569;">{FUENTE_EMISORA}</span></td></tr>
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Objetivo del Muestreo:</strong> <span style="color: #475569;">{OBJETIVO_MUESTREO}</span></td></tr>
</table>

{BLOQUE_OBSERVACION|Observaciones}
`;

const FICHA_EVENTS = [
    'FICHA_CREADA',
    'FICHA_ASIGNADA',
    'FICHA_RECHAZADA_ASIGNACION',
    'FICHA_APROBADA_TECNICA',
    'FICHA_RECHAZADA_TECNICA',
    'FICHA_EN_REVISION',
    'FICHA_OBSERVADA_COMERCIAL',
    'FICHA_CANCELADA',
    'FICHA_REMUESTREO_CREADA',
    'FICHA_MUESTREO_CANCELADO',
    'FICHA_MUESTREO_REAGENDADO',
    'FICHA_MUESTREO_REASIGNADO',
    'FICHA_MUESTREO_REAGENDADO_REASIGNADO',
    'FICHA_APROBADA_COORDINACION',
    'FICHA_RECHAZADA_COORDINACION'
];

async function migrate() {
    try {
        console.log('Connecting to DB...');
        const pool = await getConnection();
        
        console.log('Updating Ficha events...');
        for (const eventCode of FICHA_EVENTS) {
            let html = TEMPLATE.trim();
            
            // Add services detail block for events that involve services array
            if (eventCode.includes('ASIGNADA') || eventCode.includes('PROGRAMADO') || eventCode.includes('REAGENDADO') || eventCode.includes('REASIGNADO')) {
                html += `\n<div style="margin-bottom: 24px;"><h3 style="margin:0 0 12px 0;color:#0062a8;font-size:15px;font-family:Arial,sans-serif;border-bottom:2px solid #0062a8;padding-bottom:8px;">Detalle de Servicios</h3><div style="background-color:#f8fafc;padding:12px;border-radius:6px;">{servicios_detalle}</div></div>`;
            }
            
            await pool.request()
                .input('code', eventCode)
                .input('html', html)
                .query('UPDATE mae_evento_notificacion SET cuerpo_template_html = @html WHERE codigo_evento = @code');
            console.log(`- Updated ${eventCode}`);
        }
        
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await closeConnection();
    }
}

migrate();
