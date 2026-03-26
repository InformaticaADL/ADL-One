
import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function updateTemplates() {
    const pool = await getConnection();
    
    const baseHtmlBodyPrefix = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style type="text/css">body{margin:0;padding:0;background-color:#f0f8ff!important;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif}table{border-spacing:0;border-collapse:collapse}td{padding:0}</style></head><body style="margin:0;padding:0;background-color:#f0f8ff;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f0f8ff;width:100%;"><tr><td align="center" style="padding:40px 0;"><table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,98,168,0.15);border:1px solid #dbeafe;"><thead><tr><td style="background-color:#ffffff;padding:20px 40px;border-bottom:6px solid #0062a8;"><img src="{LOGO_BASE64}" alt="ADL ONE" width="240" style="display:block;width:240px;max-width:240px;height:auto;border:0;"></td></tr></thead><tbody><tr><td style="padding:40px;"><h2 style="margin:0 0 5px 0;color:#0062a8;font-family:Arial,sans-serif;font-size:22px;font-weight:700;">{TITULO_CORREO}</h2><p style="margin:0 0 25px 0;color:#5c8ab9;font-family:Arial,sans-serif;font-size:18px;">Notificación Nº: <strong style="color:#ff8c00;font-size:24px;">{CORRELATIVO}</strong></p><table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top:1px solid #e6f2ff;padding-top:20px;margin-bottom:20px;"><tr><td width="140" style="padding:2px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">{LABEL_SOLICITANTE}:</td><td style="padding:2px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{USUARIO}</td></tr><tr><td style="padding:2px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Fecha:</td><td style="padding:2px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{FECHA}</td></tr><tr><td style="padding:2px 0;color:#0062a8;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;">Hora:</td><td style="padding:2px 0;color:#333333;font-size:14px;font-family:Arial,sans-serif;">{HORA}</td></tr></table>`;
    
    const baseHtmlBodySuffix = `<div style="margin-top:30px;padding:15px;background-color:#fffbf5;border-left:4px solid #ff8c00;color:#666666;font-size:14px;font-family:Arial,sans-serif;"><strong>{ETIQUETA_OBSERVACION}:</strong><br>{OBSERVACION}</div></td></tr><tr><td style="padding:25px 40px;background-color:#f8fafc;border-top:1px solid #dbeafe;"><table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="left" valign="top" style="padding-right:20px;"><strong style="color:#0062a8;font-size:13px;font-family:Arial,sans-serif;display:block;margin-bottom:4px;">ADL Diagnostic Chile SpA</strong><div style="color:#64748b;font-size:11px;line-height:1.4;font-family:Arial,sans-serif;">Laboratorio de Diagnóstico y Biotecnología<br>Sector La Vara s/n, Camino a Alerce, Puerto Montt<br><a href="http://www.adldiagnostic.cl" style="color:#0062a8;text-decoration:none;">www.adldiagnostic.cl</a></div></td><td align="right" valign="top" style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;white-space:nowrap;">Sistema de Gestión<br><strong style="color:#0062a8;">Empresarial</strong></td></tr></table></td></tr></tbody></table></td></tr></table></body></html>`;

    const details = {
        BAJA: `
<div style="padding:15px;background-color:#fff5f5;border:1px solid #feb2b2;border-radius:8px;">
    <h4 style="margin:0 0 10px 0;color:#dc3545;font-size:15px;">Plan de Desvinculación de Equipo:</h4>
    <div style="font-size:14px;color:#1e293b;">
        <strong>Equipo:</strong> <span style="color:#dc3545;font-weight:bold;">{nombre_equipo_full}</span><br>
        <strong>Motivo:</strong> {motivo}<br>
        <strong>Fecha Efectiva:</strong> {fecha_baja}
    </div>
</div>`,
        ALTA: `
<div style="padding:15px;background-color:#f0fff4;border:1px solid #9ae6b4;border-radius:8px;">
    <h4 style="margin:0 0 10px 0;color:#2f855a;font-size:15px;">Plan de Activación de Equipo:</h4>
    <div style="font-size:14px;color:#1e293b;">
        <strong>Nombre Equipo:</strong> <span style="color:#2f855a;font-weight:bold;">{nombre_equipo}</span><br>
        <strong>Tipo de Dispositivo:</strong> {tipo_equipo}<br>
        <strong>Sede / Centro:</strong> {nombre_centro}
    </div>
</div>`,
        TRASPASO: `
<div style="padding:15px;background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;">
    <h4 style="margin:0 0 10px 0;color:#0369a1;font-size:15px;">Plan de Traspaso de Activos:</h4>
    <div style="font-size:14px;color:#1v293b;">
        <strong>Equipo:</strong> <span style="color:#0369a1;font-weight:bold;">{nombre_equipo_full}</span><br>
        <strong>Nueva Ubicación:</strong> {nombre_centro_destino}<br>
        <strong>Destino Responsable:</strong> {nombre_muestreador_destino}
    </div>
</div>`,
        PROBLEMA: `
<div style="padding:15px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
    <h4 style="margin:0 0 10px 0;color:#b45309;font-size:15px;">Detalle del Reporte de Incidencia:</h4>
    <div style="font-size:14px;color:#1e293b;">
        <strong>Asunto:</strong> <span style="color:#b45309;font-weight:bold;">{asunto}</span><br>
        <strong>Categoría:</strong> {categoria_problema}<br>
        <strong>Gravedad:</strong> {gravedad}<br>
        <strong>Equipo Afectado:</strong> {nombre_equipo_afectado}
    </div>
</div>`,
        EXTENSION: `
<div style="padding:15px;background-color:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;">
    <h4 style="margin:0 0 10px 0;color:#6d28d9;font-size:15px;">Detalle de Extensión de Vigencia:</h4>
    <div style="font-size:14px;color:#1e293b;">
        <strong>Equipo:</strong> <span style="color:#6d28d9;font-weight:bold;">{nombre_equipo_full}</span><br>
        <strong>Nueva Fecha:</strong> {nueva_vigencia}<br>
        <strong>Justificación:</strong> {justificacion}
    </div>
</div>`,
        DESHABILITAR: `
<div style="padding:15px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
    <h4 style="margin:0 0 10px 0;color:#dc3545;font-size:15px;">Plan de Desactivación:</h4>
    <div style="font-size:14px;color:#1e293b;">
        <strong>Muestreador Origen:</strong> <span style="color:#0062a8;font-weight:bold;">{muestreador_origen_nombre}</span><br>
        <strong>Esquema de Traspaso:</strong> {tipo_traspaso}<br>
        <strong>Asignación Destino:</strong> {muestreador_destino_nombre}{base_destino}
    </div>
</div>`
    };

    const events = [
        { code: 'SOL_EQUIPO_BAJA_NUEVA', title: 'Nueva Solicitud: Baja de Equipo', type: 'BAJA' },
        { code: 'SOL_EQUIPO_ALTA_NUEVA', title: 'Nueva Solicitud: Activación de Equipo', type: 'ALTA' },
        { code: 'SOL_TRASPASO_SEDE_NUEVA', title: 'Nueva Solicitud: Traspaso de Sede', type: 'TRASPASO' },
        { code: 'SOL_TRASPASO_MUESTREADOR_NUEVA', title: 'Nueva Solicitud: Traspaso de Responsable', type: 'TRASPASO' },
        { code: 'SOL_TRASPASO_AMBOS_NUEVA', title: 'Nueva Solicitud: Traspaso Completo', type: 'TRASPASO' },
        { code: 'SOL_EQUIPO_REPORTE_PROBLEMA_NUEVA', title: 'Incidente Reportado', type: 'PROBLEMA' },
        { code: 'SOL_DESHABILITAR_MUESTREADOR_NUEVA', title: 'Nueva Solicitud: Deshabilitar Muestreador', type: 'DESHABILITAR' },
        { code: 'SOL_EXTENSION_VIGENCIA_NUEVA', title: 'Solicitud Extensión de Vigencia', type: 'EXTENSION' },
        // Action versions
        { code: 'SOL_EQUIPO_BAJA_APR', title: 'Solicitud ACEPTADA: Baja de Equipo', type: 'BAJA', label: 'Acción por' },
        { code: 'SOL_EQUIPO_BAJA_RECH', title: 'Solicitud RECHAZADA: Baja de Equipo', type: 'BAJA', label: 'Acción por' },
        { code: 'SOL_EQUIPO_ALTA_APR', title: 'Solicitud ACEPTADA: Activación de Equipo', type: 'ALTA', label: 'Acción por' },
        { code: 'SOL_EQUIPO_ALTA_RECH', title: 'Solicitud RECHAZADA: Activación de Equipo', type: 'ALTA', label: 'Acción por' }
    ];

    for (const ev of events) {
        let html = baseHtmlBodyPrefix + details[ev.type] + baseHtmlBodySuffix;
        
        // Final adjustments for APR/RECH
        if (ev.code.endsWith('_APR')) {
            html = html.replace('color:#0062a8;font-family:Arial,sans-serif;font-size:22px;font-weight:700;', 'color:#15803d;font-family:Arial,sans-serif;font-size:22px;font-weight:700;');
        } else if (ev.code.endsWith('_RECH')) {
            html = html.replace('color:#0062a8;font-family:Arial,sans-serif;font-size:22px;font-weight:700;', 'color:#b91c1c;font-family:Arial,sans-serif;font-size:22px;font-weight:700;');
        }
        
        if (ev.label) {
            html = html.replace('{LABEL_SOLICITANTE}', ev.label);
        } else {
            html = html.replace('{LABEL_SOLICITANTE}', 'Solicitante');
        }

        console.log(`Actualizando evento: ${ev.code}...`);
        
        const exists = await pool.request().input('code', sql.VarChar(100), ev.code).query('SELECT 1 as ex FROM mae_evento_notificacion WHERE codigo_evento = @code');
        
        if (exists.recordset.length > 0) {
            await pool.request()
                .input('code', sql.VarChar(100), ev.code)
                .input('nombre', sql.VarChar(100), ev.title)
                .input('asunto', sql.VarChar(200), 'ADL ONE: {TITULO_CORREO} {CORRELATIVO}')
                .input('html', sql.NVarChar(sql.MAX), html)
                .query(`UPDATE mae_evento_notificacion SET descripcion = @nombre, asunto_template = @asunto, cuerpo_template_html = @html WHERE codigo_evento = @code`);
        } else {
            // Check if it's a known system template to clone if missing (optional, here we insert)
            await pool.request()
                .input('code', sql.VarChar(100), ev.code)
                .input('nombre', sql.VarChar(100), ev.title)
                .input('asunto', sql.VarChar(200), 'ADL ONE: {TITULO_CORREO} {CORRELATIVO}')
                .input('html', sql.NVarChar(sql.MAX), html)
                .query(`INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, cuerpo_template_html, modulo) 
                        VALUES (@code, @nombre, @asunto, @html, 'URS')`);
        }
    }

    console.log("¡Plantillas actualizadas con éxito!");
    process.exit(0);
}

updateTemplates().catch(err => {
    console.error(err);
    process.exit(1);
});
