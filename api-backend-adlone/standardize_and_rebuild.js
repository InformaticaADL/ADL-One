import 'dotenv/config';
import { getConnection, closeConnection } from './src/config/database.js';
import sql from 'mssql';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

// 1. Define the premium SaaS-grade themes
const THEMES = {
    success: {
        color: '#0d9488', // Teal
        bg: '#f0fdf4',    // Soft Mint
        text: '#115e59',  // Dark Teal
        badgeText: 'Aprobación / Éxito',
        boxBorder: '#ccfbf1',
        boxTitle: '#0d9488'
    },
    danger: {
        color: '#e11d48', // Crimson Rose
        bg: '#fff1f2',    // Soft Pink
        text: '#9f1239',  // Dark Crimson
        badgeText: 'Rechazo / Cancelación',
        boxBorder: '#fecdd3',
        boxTitle: '#e11d48'
    },
    warning: {
        color: '#d97706', // Amber Orange
        bg: '#fffbeb',    // Soft Cream
        text: '#78350f',  // Dark Amber
        badgeText: 'Alerta / Acción Requerida',
        boxBorder: '#fde68a',
        boxTitle: '#d97706'
    },
    info: {
        color: '#0062a8', // Corporate Blue
        bg: '#f0f9ff',    // Soft Sky Blue
        text: '#0369a1',  // Dark Blue
        badgeText: 'Notificación / Info',
        boxBorder: '#bae6fd',
        boxTitle: '#0062a8'
    }
};

// 2. State-Theme engine matching logic
function getTheme(code, desc, subject) {
    const cleanCode = (code || '').toUpperCase();
    const cleanDesc = (desc || '').toUpperCase();
    const cleanSub = (subject || '').toUpperCase();
    
    // Success / Approval
    if (
        cleanCode.endsWith('_APR') || 
        cleanCode.endsWith('_APROBADA') || 
        cleanCode.includes('APROBADA') || 
        cleanCode.includes('ACEPTADA') || 
        cleanDesc.includes('APROBAD') || 
        cleanDesc.includes('ACEPTAD') ||
        cleanSub.includes('APROBADA') || 
        cleanSub.includes('ACEPTADA') || 
        cleanSub.includes('APROBADO') || 
        cleanSub.includes('ACEPTADO')
    ) {
        return 'success';
    }
    
    // Rejection / Danger / Cancellation
    if (
        cleanCode.endsWith('_RECH') || 
        cleanCode.endsWith('_RECHAZADA') || 
        cleanCode.includes('RECHAZADA') || 
        cleanDesc.includes('RECHAZAD') ||
        cleanSub.includes('RECHAZADA') ||
        cleanSub.includes('RECHAZADO') ||
        cleanCode.includes('CANCELADO') ||
        cleanCode.includes('CANCELACION') ||
        cleanDesc.includes('CANCELAD') ||
        cleanSub.includes('CANCELAD')
    ) {
        return 'danger';
    }
    
    // Warning / Alerts / Problem Alerts
    if (
        cleanCode.includes('PROBLEMA') || 
        cleanCode.includes('PERDIDO') || 
        cleanCode.includes('PERDIDA') || 
        cleanCode.includes('EXTRAVIO') || 
        cleanCode.includes('ROBO') ||
        cleanCode.includes('REVISION') || 
        cleanCode.includes('VIGENCIA') ||
        cleanCode.includes('REPROGRAMADO') ||
        cleanDesc.includes('PROBLEMA') || 
        cleanDesc.includes('PERDIDO') || 
        cleanDesc.includes('EXTRAVIO') || 
        cleanDesc.includes('ROBO') ||
        cleanDesc.includes('REVISION') || 
        cleanDesc.includes('VIGENCIA') ||
        cleanDesc.includes('REPROGRAMAD') ||
        cleanSub.includes('PROBLEMA') || 
        cleanSub.includes('PERDIDO') || 
        cleanSub.includes('REVISION') ||
        cleanSub.includes('REPROGRAMA')
    ) {
        return 'warning';
    }
    
    // Default: Info / General / Creation (Blue)
    return 'info';
}

// 3. Extract core content from old HTML template
function extractCoreContent(html) {
    if (!html) return '';
    let s = html.trim();
    
    // First, if it's already wrapped in our premium card, extract the inner block of the premium card
    if (s.includes('class="main-card"') || s.includes('class="body-content"') || s.includes('class="footer"')) {
        const marker = 'color: #334155';
        const startMarkerIdx = s.indexOf(marker);
        if (startMarkerIdx !== -1) {
            const divOpenEnd = s.indexOf('>', startMarkerIdx);
            if (divOpenEnd !== -1) {
                const footerIdx = s.indexOf('class="footer"');
                let endDivIdx = -1;
                if (footerIdx !== -1) {
                    endDivIdx = s.lastIndexOf('</div>', footerIdx);
                } else {
                    endDivIdx = s.lastIndexOf('</div>');
                }
                if (endDivIdx !== -1 && endDivIdx > divOpenEnd) {
                    return s.substring(divOpenEnd + 1, endDivIdx).trim();
                }
            }
        }
    }
    
    // Now, check if the content contains a nested old card wrapper (box-shadow, width=600)
    const oldCardMatch = s.match(/<table[^>]*width="600"[^>]*>([\s\S]*?)<tbody><tr><td[^>]*style="[^"]*padding:\s*40px[^"]*"[^>]*>/i);
    if (oldCardMatch) {
        s = s.replace(oldCardMatch[0], '');
        // Clean trailing tags of the nested old card
        s = s.replace(/<\/td>\s*<\/tr>\s*<\/tbody>\s*<\/table>\s*$/i, '').trim();
    }
    
    let startIdx = -1;
    // Look for <td style="padding:40px;"> or similar wrappers
    const tdMatch = s.match(/<td[^>]*style="[^"]*padding:\s*40px[^"]*"[^>]*>/i);
    if (tdMatch) {
        startIdx = s.indexOf(tdMatch[0]) + tdMatch[0].length;
    } else {
        const bodyMatch = s.match(/<body[^>]*>/i);
        if (bodyMatch) {
            startIdx = s.indexOf(bodyMatch[0]) + bodyMatch[0].length;
        } else {
            startIdx = 0;
        }
    }
    
    let endIdx = -1;
    // Look for the start of the footer cell
    const footerMatch = s.match(/<td[^>]*background-color:\s*#f8fafc[^>]*>/i);
    if (footerMatch) {
        endIdx = s.indexOf(footerMatch[0]);
    } else {
        const bodyCloseIdx = s.lastIndexOf('</body>');
        if (bodyCloseIdx !== -1) {
            endIdx = bodyCloseIdx;
        } else {
            endIdx = s.length;
        }
    }
    
    if (endIdx <= startIdx) return s;
    
    let core = s.substring(startIdx, endIdx).trim();
    
    // Clean up specific trailing structural tags without eating real content
    core = core.trim();
    if (core.endsWith('</td></tr><tr>')) {
        core = core.slice(0, -14).trim();
    } else if (core.endsWith('</td></tr>')) {
        core = core.slice(0, -10).trim();
    }
    
    return core;
}

// 4. Generate the complete premium HTML layout wrapper
function wrapInPremiumLayout(theme, badgeHtml, title, coreContent) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style type="text/css">
        body { margin: 0; padding: 0; background-color: #f1f5f9 !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
        table { border-spacing: 0; border-collapse: collapse; }
        td { padding: 0; }
        @media only screen and (max-width: 620px) {
            .main-card { border-radius: 0 !important; border: none !important; width: 100% !important; max-width: 100% !important; }
            .body-content { padding: 30px 20px !important; }
            .header { padding: 20px 20px !important; }
            .footer { padding: 25px 20px !important; }
            .footer-col-left, .footer-col-right { width: 100% !important; max-width: 100% !important; text-align: left !important; float: none !important; display: block !important; }
            .footer-col-right { padding-top: 16px !important; }
            .footer-col-right td { text-align: left !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; width: 100%;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <!--[if mso]>
                <table role="presentation" width="96%" align="center" style="width:96%;">
                <tr>
                <td>
                <![endif]-->
                <table class="main-card" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; max-width: 96%; width: 100%; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
                    <thead>
                        <tr>
                            <td class="header" style="background-color: #ffffff; padding: 24px 40px; border-bottom: 5px solid ${theme.color};">
                                <img src="{LOGO_BASE64}" alt="ADL ONE" width="180" style="display: block; width: 180px; max-width: 180px; height: auto; border: 0;">
                            </td>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="body-content" style="padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                <h2 style="margin: 0 0 8px 0; color: #0062a8; font-size: 22px; font-weight: 700; line-height: 1.3; font-family: Arial, sans-serif;">${title}</h2>
                                ${badgeHtml}
                                
                                <div style="color: #334155; font-size: 14px; line-height: 1.6; font-family: Arial, sans-serif;">
                                     ${coreContent}
                                     ${coreContent.includes('{BLOQUE_OBSERVACION') || coreContent.includes('{OBSERVACION}') ? '' : '{BLOQUE_OBSERVACION|{ETIQUETA_OBSERVACION}}'}
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td class="footer" style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-family: Arial, sans-serif;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="table-layout:fixed;width:100%;">
                                    <tr>
                                        <td align="left" valign="top" style="width:70%;font-family: Arial, sans-serif;word-wrap:break-word;">
                                            <strong style="color: #0062a8; font-size: 13px; display: block; margin-bottom: 4px; letter-spacing: 0.5px; text-transform: uppercase;">ADL Diagnostic Chile SpA</strong>
                                            <div style="color: #64748b; font-size: 11px; line-height: 1.5; margin-top: 4px;">
                                                Laboratorio de Diagnóstico y Biotecnología<br>
                                                Sector La Vara s/n, Camino a Alerce, Puerto Montt<br>
                                                <a href="http://www.adldiagnostic.cl" style="color: #0062a8; text-decoration: none; font-weight: 600;">www.adldiagnostic.cl</a>
                                            </div>
                                        </td>
                                        <td align="right" valign="bottom" style="width:30%;font-family: Arial, sans-serif; color: #64748b; font-size: 11px; line-height: 1.5; text-align: right;word-wrap:break-word;">
                                            Sistema de Gestión<br>
                                            <strong style="color: #0062a8;">Empresarial</strong>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <!--[if mso]>
                </td>
                </tr>
                </table>
                <![endif]-->
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// 5. Main execution function
async function main() {
    const pool = await getConnection();
    
    try {
        console.log('Fetching all templates from mae_evento_notificacion...');
        const res = await pool.request().query(`
            SELECT id_evento, codigo_evento, descripcion, asunto_template, cuerpo_template_html, modulo, id_funcionalidad, es_transaccional, oculto_en_hub
            FROM mae_evento_notificacion
            ORDER BY id_evento
        `);
        
        const dbEvents = res.recordset;
        console.log(`Retrieved ${dbEvents.length} events from database.`);
        
        // Setup ExcelJS workbook
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Notificaciones');
        
        // Configure headers for Libro1.xlsx
        sheet.columns = [
            { header: 'id_evento', key: 'id_evento', width: 10 },
            { header: 'codigo_evento', key: 'codigo_evento', width: 35 },
            { header: 'descripcion', key: 'descripcion', width: 40 },
            { header: 'asunto_template', key: 'asunto_template', width: 45 },
            { header: 'cuerpo_template_html', key: 'cuerpo_template_html', width: 60 },
            { header: 'modulo', key: 'modulo', width: 15 },
            { header: 'id_funcionalidad', key: 'id_funcionalidad', width: 15 },
            { header: 'es_transaccional', key: 'es_transaccional', width: 15 },
            { header: 'oculto_en_hub', key: 'oculto_en_hub', width: 15 }
        ];
        
        // Header styling for the Excel file
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF0062A8' } // Corporate Blue
            };
            cell.font = {
                name: 'Segoe UI',
                bold: true,
                color: { argb: 'FFFFFFFF' },
                size: 11
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        headerRow.height = 26;
        
        let sqlMigrationLines = [
            '-- =========================================================================',
            '-- MASTER SQL MIGRATION SCRIPT: STANDARDIZE ALL EMAIL NOTIFICATION TEMPLATES',
            '-- SYSTEM: ADL ONE',
            '-- DATE: ' + new Date().toISOString(),
            '-- =========================================================================\n',
            'USE [PruebasInformatica];',
            'GO\n'
        ];
        
        let updatedCount = 0;
        
        for (const ev of dbEvents) {
            const id = ev.id_evento;
            const code = ev.codigo_evento;
            const desc = ev.descripcion;
            const subject = ev.asunto_template;
            const rawHtml = ev.cuerpo_template_html;
            const modulo = ev.modulo;
            const idFuncionalidad = ev.id_funcionalidad;
            const esTransaccional = ev.es_transaccional === true || ev.es_transaccional === 1 ? 'True' : 'False';
            const ocultoEnHub = ev.oculto_en_hub === true || ev.oculto_en_hub === 1 ? 'True' : 'False';
            
            let finalHtml = rawHtml;
            
            // Skip GCHAT/Chat and null/empty templates
            if (rawHtml && rawHtml !== 'null' && !code.startsWith('GCHAT_')) {
                // Determine theme color
                const themeKey = getTheme(code, desc, subject);
                const theme = THEMES[themeKey];
                
                // Extract core content
                let core = extractCoreContent(rawHtml);
                
                // 1. Extract dynamic title from old <h2>
                let dynamicTitle = desc || 'Notificación del Sistema';
                const titleMatch = core.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
                if (titleMatch) {
                    dynamicTitle = titleMatch[1].replace(/<[^>]*>/g, '').trim();
                    core = core.replace(titleMatch[0], ''); // remove h2
                }
                
                // 2. Extract transaction text for the pill badge
                let transactionText = '';
                const pMatch = core.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
                if (pMatch && (pMatch[1].includes('Nº') || pMatch[1].includes('N°') || pMatch[1].includes('Nro') || pMatch[1].includes('CORRELATIVO') || pMatch[1].includes('correlativo') || pMatch[1].includes('Ficha'))) {
                    transactionText = pMatch[1].replace(/<[^>]*>/g, '').trim();
                    core = core.replace(pMatch[0], ''); // remove p
                }
                
                // Build Subtitle HTML (Clean underline strictly matching text width, no pill badge)
                let labelText = 'Notificación Nº';
                let numberText = '{CORRELATIVO}';
                if (transactionText) {
                    const parts = transactionText.split(/:\s*/);
                    if (parts.length > 1) {
                        labelText = parts[0].trim();
                        numberText = parts[1].trim();
                    } else {
                        labelText = transactionText.trim();
                        numberText = '';
                    }
                } else {
                    if (code.includes('FICHA')) {
                        labelText = 'Ficha Nº';
                    } else if (code.includes('SOLICITUD') || code.includes('SOL_')) {
                        labelText = 'Solicitud Nº';
                    } else if (code.includes('AVISO')) {
                        labelText = 'Aviso Móvil Nº';
                    }
                }
                if (labelText.endsWith(':')) {
                    labelText = labelText.slice(0, -1).trim();
                }
                
                let badgeHtml = `
                <table border="0" cellspacing="0" cellpadding="0" align="left" style="margin-bottom: 25px; border-bottom: 2px solid ${theme.color};">
                    <tr>
                        <td style="padding-bottom: 6px; font-family: Arial, sans-serif; font-size: 14px; font-weight: 500; color: #64748b; white-space: nowrap;">
                            ${labelText}${numberText ? `<strong style="color: #ff8c00; font-size: 16px; font-family: Arial, sans-serif; font-weight: bold;">: ${numberText}</strong>` : ''}
                        </td>
                    </tr>
                </table>
                <div style="clear: both; height: 1px; font-size: 1px; line-height: 1px;"></div>`;
                
                // 3. Beautify detail tables inside core content with border-collapse: separate and single-cell wrapper for rounded corners in Outlook
                core = core.replace(/<table[^>]*style="[^"]*border-top:[^"]*"[^>]*>([\s\S]*?)<\/table>/gi, 
                    `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px; font-family: Arial, sans-serif;"><tr><td style="padding: 16px 20px; background-color: ${theme.bg}; border: 1px solid ${theme.boxBorder}; border-radius: 12px;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">$1</table></td></tr></table>`
                );
                // Beautify standard table tags without style
                core = core.replace(/<table[^>]*width="100%"[^>]*border="0"[^>]*cellspacing="0"[^>]*cellpadding="0"\s*>([\s\S]*?)<\/table>/gi, 
                    `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px; font-family: Arial, sans-serif;"><tr><td style="padding: 16px 20px; background-color: ${theme.bg}; border: 1px solid ${theme.boxBorder}; border-radius: 12px;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">$1</table></td></tr></table>`
                );
                
                // Beautify tables that already have a gray background-color #f8fafc or border #f1f5f9
                core = core.replace(/<table[^>]*background-color:\s*#f8fafc[^>]*>([\s\S]*?)<\/table>/gi,
                    `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px; font-family: Arial, sans-serif;"><tr><td style="padding: 16px 20px; background-color: ${theme.bg}; border: 1px solid ${theme.boxBorder}; border-radius: 12px;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">$1</table></td></tr></table>`
                );

                // Beautify tables with thin light blue bottom border (mobile templates)
                core = core.replace(/<table[^>]*border-bottom:\s*1px\s*solid\s*#e6f2ff[^>]*>([\s\S]*?)<\/table>/gi,
                    `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px; font-family: Arial, sans-serif;"><tr><td style="padding: 16px 20px; background-color: ${theme.bg}; border: 1px solid ${theme.boxBorder}; border-radius: 12px;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">$1</table></td></tr></table>`
                );

                // Beautify custom detail boxes inside core content (matching theme color with table wrapper)
                core = core.replace(/<div[^>]*style="[^"]*padding:\s*(15|16)px;background-color:\s*#[a-f0-9]{6}[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
                    `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px; font-family: Arial, sans-serif;"><tr><td style="padding: 16px 20px; background-color: ${theme.bg}; border: 1px solid ${theme.boxBorder}; border-radius: 12px;">$2</td></tr></table>`
                );
                core = core.replace(/<div[^>]*style="[^"]*padding:\s*(15|16)px;background-color:\s*#f8fafc[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
                    `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px; font-family: Arial, sans-serif;"><tr><td style="padding: 16px 20px; background-color: ${theme.bg}; border: 1px solid ${theme.boxBorder}; border-radius: 12px;">$2</td></tr></table>`
                );
                // Beautify divs with light gray background and 8px border-radius
                core = core.replace(/<div[^>]*background:\s*#f8fafc;border-radius:\s*8px[^>]*>([\s\S]*?)<\/div>/gi,
                    `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px; font-family: Arial, sans-serif;"><tr><td style="padding: 16px 20px; background-color: ${theme.bg}; border: 1px solid ${theme.boxBorder}; border-radius: 12px;">$1</td></tr></table>`
                );
                // Beautify divs with thin light blue top border
                core = core.replace(/border-top:\s*1px\s*solid\s*#e6f2ff/gi,
                    `border-top: 1px solid ${theme.boxBorder}`
                );

                // Handle the <h4> titles inside the custom detail boxes
                core = core.replace(/<h4[^>]*style="[^"]*margin:\s*0[^"]*"[^>]*>/gi,
                    `<h4 style="margin: 0 0 12px 0; color: ${theme.boxTitle}; font-size: 15px; font-weight: 700; font-family: Arial, sans-serif;">`
                );
                
                // Style label columns to be tight with auto-width and padding-right
                core = core.replace(/<td[^>]*color:\s*#0062a8[^>]*>/gi, 
                    `<td width="1%" style="width: 1%; white-space: nowrap; padding: 6px 16px 6px 0; color: #64748b; font-weight: 600; font-size: 13px; font-family: Arial, sans-serif;">`
                );
                core = core.replace(/<td[^>]*style="[^"]*color:\s*#0062a8[^"]*"[^>]*>/gi, 
                    `<td width="1%" style="width: 1%; white-space: nowrap; padding: 6px 16px 6px 0; color: #64748b; font-weight: 600; font-size: 13px; font-family: Arial, sans-serif;">`
                );
                // Also support updating label columns that were already modified in a previous run
                core = core.replace(/<td width="130" style="width: 130px; padding: 6px 0; color: #64748b;/gi,
                    `<td width="1%" style="width: 1%; white-space: nowrap; padding: 6px 16px 6px 0; color: #64748b;`
                );
                core = core.replace(/<td style="padding: 6px 0; color: #64748b;/gi,
                    `<td width="1%" style="width: 1%; white-space: nowrap; padding: 6px 16px 6px 0; color: #64748b;`
                );
                
                // Style value columns
                core = core.replace(/<td[^>]*color:\s*#333333[^>]*>/gi, 
                    `<td style="padding: 6px 0; color: #1e293b; font-weight: 500; font-size: 14px; font-family: Arial, sans-serif; vertical-align: middle;">`
                );
                core = core.replace(/<td[^>]*style="[^"]*color:\s*#333333[^"]*"[^>]*>/gi, 
                    `<td style="padding: 6px 0; color: #1e293b; font-weight: 500; font-size: 14px; font-family: Arial, sans-serif; vertical-align: middle;">`
                );
                
                // Standardize metadata table (Solicitado por, Creado por, Modificado por, Acción por, Fecha, Hora) to tight premium two-column layout
                // 1. Convert single-cell layout (label + span) to two separate cells
                const singleCellRegex = /<td[^>]*>\s*({LABEL_SOLICITANTE}|Solicitado por|Creado por|Modificado por|Acción por|Accion por|Cancelado por|Asignado por|Aprobado por|Rechazado por|Revisado por|Accionado por|Fecha de solicitud|Fecha de re-agendamiento|Fecha de reasignación|Fecha de reasignacion|Fecha de creación|Fecha de creacion|Fecha|Hora de solicitud|Hora de re-agendamiento|Hora de reasignación|Hora de reasignacion|Hora de creación|Hora de creacion|Hora):?\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/td>/gi;
                core = core.replace(singleCellRegex, (match, label, value) => {
                    return `<td>${label.trim()}</td><td>${value.trim()}</td>`;
                });

                // 2. Format all two-cell metadata rows with premium styling
                const twoCellRegex = /<td[^>]*>\s*({LABEL_SOLICITANTE}|Solicitado por|Creado por|Modificado por|Acción por|Accion por|Cancelado por|Asignado por|Aprobado por|Rechazado por|Revisado por|Accionado por|Fecha de solicitud|Fecha de re-agendamiento|Fecha de reasignación|Fecha de reasignacion|Fecha de creación|Fecha de creacion|Fecha|Hora de solicitud|Hora de re-agendamiento|Hora de reasignación|Hora de reasignacion|Hora de creación|Hora de creacion|Hora):?\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
                core = core.replace(twoCellRegex, (match, label, value) => {
                    let cleanLabel = label.trim();
                    if (cleanLabel.toLowerCase().includes('fecha')) {
                        cleanLabel = 'Fecha';
                    } else if (cleanLabel.toLowerCase().includes('hora')) {
                        cleanLabel = 'Hora';
                    }
                    if (!cleanLabel.endsWith(':')) {
                        cleanLabel += ':';
                    }
                    let cleanValue = value.replace(/<[^>]*>/g, '').trim();
                    return `<td style="width:1%; white-space:nowrap; padding:4px 16px 4px 0; color:#0062a8; font-weight:bold; font-size:14px; font-family:Arial,sans-serif;">${cleanLabel}</td>` +
                           `<td style="padding:4px 0; color:#333333; font-size:14px; font-family:Arial,sans-serif;">${cleanValue}</td>`;
                });

                // 4. Style observations box

                const oldObsMatch = core.match(/<div[^>]*border-left:[^>]*>[^]*?<\/div>/gi);
                if (oldObsMatch) {
                    for (const box of oldObsMatch) {
                        if (box.includes('{OBSERVACION}')) {
                            const premiumObs = `
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-top: 30px; font-family: Arial, sans-serif;">
                                <tr>
                                    <td style="padding: 16px 20px; background-color: ${theme.bg}; border-left: 4px solid ${theme.color}; border-radius: 0 12px 12px 0; color: ${theme.text}; font-size: 14px; line-height: 1.6;">
                                        <strong>Observaciones:</strong><br>{OBSERVACION}
                                    </td>
                                </tr>
                            </table>`;
                            core = core.replace(box, premiumObs);
                        }
                    }
                }
                
                // Wrap in new premium template layout
                finalHtml = wrapInPremiumLayout(theme, badgeHtml, dynamicTitle, core);
                
                // 5. Perform the database update!
                await pool.request()
                    .input('id', id)
                    .input('html', sql.NVarChar(sql.MAX), finalHtml)
                    .query('UPDATE mae_evento_notificacion SET cuerpo_template_html = @html WHERE id_evento = @id');
                
                updatedCount++;
                console.log(`[${updatedCount}/${dbEvents.length}] Standardized & updated event: ${code} (ID: ${id})`);
            } else {
                console.log(`Skipping template standardization for: ${code} (ID: ${id})`);
            }
            
            // Write clean row to Libro1.xlsx
            sheet.addRow({
                id_evento: id,
                codigo_evento: code,
                descripcion: desc,
                asunto_template: subject,
                cuerpo_template_html: finalHtml,
                modulo: modulo,
                id_funcionalidad: idFuncionalidad,
                es_transaccional: esTransaccional,
                oculto_en_hub: ocultoEnHub
            });
            
            // Escape single quotes for SQL migration script
            const escapedHtml = finalHtml ? finalHtml.replace(/'/g, "''") : 'NULL';
            sqlMigrationLines.push(`PRINT 'Updating event: ${code} (ID: ${id})';`);
            sqlMigrationLines.push(`UPDATE mae_evento_notificacion SET cuerpo_template_html = ${escapedHtml !== 'NULL' ? `'${escapedHtml}'` : 'NULL'} WHERE id_evento = ${id};`);
            sqlMigrationLines.push('');
        }
        
        // Save the consolidated Excel file directly to the desktop
        const desktopExcelPath = 'C:\\Users\\rdiaz\\Desktop\\ADL ONE\\Libro1.xlsx';
        console.log(`Writing consolidated Excel sheet to ${desktopExcelPath}...`);
        await workbook.xlsx.writeFile(desktopExcelPath);
        console.log('✅ Successfully wrote consolidated Libro1.xlsx!');
        
        // Save the master SQL migration script
        const sqlScriptDir = 'C:\\Users\\rdiaz\\Desktop\\ADL ONE\\ADL-One\\db_scripts';
        if (!fs.existsSync(sqlScriptDir)) {
            fs.mkdirSync(sqlScriptDir, { recursive: true });
        }
        const sqlScriptPath = path.join(sqlScriptDir, 'standardize_all_email_templates.sql');
        console.log(`Writing SQL Migration script to ${sqlScriptPath}...`);
        fs.writeFileSync(sqlScriptPath, sqlMigrationLines.join('\n'), 'utf8');
        console.log('✅ Successfully wrote master SQL script!');
        
        console.log(`\n🎉 Process complete! Standardized ${updatedCount} email templates in DB, rebuilt Excel, and generated SQL migration script.`);
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during execution:', err);
        process.exit(1);
    } finally {
        await closeConnection();
    }
}

main();
