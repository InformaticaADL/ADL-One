import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { RANGOS, calcularVerificacion, normalizarLecturas } from '../utils/verificacionTemperatura.calc.js';

// PDF del formulario OI-FoGe-39 "Verificación Intermedia de Temperatura",
// réplica de la hoja de equipo del Excel (ej. 'pHs.30-MA.VI'): mismas columnas
// B..H con sus anchos, mismas celdas combinadas, mismos textos y formato de
// números con 1 decimal (#,##0.0). Cabe en una A4.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let logoBuffer = null;
try {
    logoBuffer = fs.readFileSync(path.resolve(__dirname, '../assets/logo-adl-formulario.jpeg'));
} catch (e) {
    logger.warn('No se encontró el logo del formulario OI-FoGe-39: ' + e.message);
}

const GRIS_PROMEDIO = '#d0d0d0';

// Columnas B..H de la hoja (anchos Excel 35,3 · 24 · 25,7 · 31,9 · 23,6 · 18,7 · 19,4),
// escaladas al ancho útil de la página.
const ANCHOS_EXCEL = [35.29, 24, 25.71, 31.86, 23.57, 18.71, 19.43];

// Formato de la hoja: #,##0.0 → siempre 1 decimal (-0,06 se ve -0,1).
const fmt1 = (n) => (n === null || n === undefined || Number.isNaN(Number(n))
    ? ''
    : (Math.round(Number(n) * 10) / 10 + 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

const fmtFecha = (v) => {
    if (!v) return '';
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
    const [y, m, d] = s.split('-');
    return d && m && y ? `${d}/${m}/${y}` : s;
};

/** Celda con borde y texto centrado verticalmente. */
const celda = (doc, x, y, w, h, texto, opts = {}) => {
    const { fill, bold = false, size = 7.5, align = 'center', pad = 3, borde = true, font } = opts;
    if (fill) doc.save().rect(x, y, w, h).fill(fill).restore();
    if (borde) doc.save().lineWidth(0.7).strokeColor('#000').rect(x, y, w, h).stroke().restore();
    if (texto === null || texto === undefined || texto === '') return;
    doc.font(font || (bold ? 'Helvetica-Bold' : 'Helvetica')).fontSize(size).fillColor('#000');
    const str = String(texto);
    const alto = doc.heightOfString(str, { width: w - pad * 2, align });
    doc.text(str, x + pad, y + Math.max(1.5, (h - alto) / 2 + 0.5), { width: w - pad * 2, align, lineGap: 0 });
};

// Borde doble exterior, como las tablas de la hoja.
const marcoDoble = (doc, x, y, w, h) => {
    doc.save().lineWidth(0.7).strokeColor('#000').rect(x - 2, y - 2, w + 4, h + 4).stroke().restore();
};

const titulo = (doc, x, y, texto, size = 8) => {
    doc.font('Helvetica-Bold').fontSize(size).fillColor('#000').text(texto, x, y, { lineBreak: false });
};

// "≤" no existe en las fuentes estándar del PDF: se dibuja con líneas.
const menorOIgual = (doc, x, y, size) => {
    const w = size * 0.5;
    const h = size * 0.5;
    doc.save().lineWidth(0.7).strokeColor('#000')
        .moveTo(x + w, y).lineTo(x, y + h / 2).lineTo(x + w, y + h).stroke()
        .moveTo(x, y + h + 1.6).lineTo(x + w, y + h + 1.6).stroke()
        .restore();
    return w + 3;
};

/**
 * Genera el PDF y lo devuelve como Buffer.
 * @param v fila de mae_verificacion_temperatura (+ muestreador_nombre)
 */
export const generarPdfVerificacion = (v) => new Promise((resolve, reject) => {
    try {
        const doc = new PDFDocument({ size: 'A4', margin: 26, info: { Title: `OI-FoGe-39 ${v.codigo_equipo || ''}`, Author: 'ADL One' } });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const X = 30;
        const W = doc.page.width - 60;
        const total = ANCHOS_EXCEL.reduce((a, b) => a + b, 0);
        const [B, C, D, E, F, G, H] = ANCHOS_EXCEL.map((a) => (a / total) * W);
        // x de inicio de cada columna
        const xB = X; const xC = xB + B; const xD = xC + C; const xE = xD + D; const xF = xE + E; const xG = xF + F; const xH = xG + G;
        let y = 26;

        const lecturas = normalizarLecturas(v.lecturas);
        const errPatron = { 0: v.patron_error0, 15: v.patron_error15, 30: v.patron_error30 };
        const calc = calcularVerificacion(lecturas, errPatron);

        // ── Encabezado (B2:H6) ─────────────────────────────────────────────────
        {
            const hH = 66;
            celda(doc, xB, y, B, hH, '');
            if (logoBuffer) doc.image(logoBuffer, xB + 6, y + 8, { fit: [B - 12, hH - 16], align: 'center', valign: 'center' });
            celda(doc, xC, y, C + D + E + F, hH, 'FOMULARIO\nGENERAL DE GESTIÓN', { bold: true, size: 10.5 });
            celda(doc, xG, y, G, 26, 'Área\nGestión de\nCalidad', { size: 6, align: 'left' });
            celda(doc, xH, y, H, 26, 'Unidad\nNo Aplica', { size: 6, align: 'left' });
            celda(doc, xG, y + 26, G + H, 18, 'Versión 03', { bold: true, size: 8.5 });
            celda(doc, xG, y + 44, G, hH - 44, 'Fecha Vigencia\n20/06/2016', { size: 6 });
            celda(doc, xH, y + 44, H, hH - 44, 'Fecha Revisión\n26/10/2026', { size: 6 });
            y += hH;
            // B7:H8 — "CODIGO:" a la izquierda y el nombre del formulario a la derecha.
            celda(doc, xB, y, W, 22, '');
            doc.font('Helvetica-Bold').fontSize(9.5).text('CODIGO:', xB, y + 7, { width: B + C, align: 'center', lineBreak: false });
            doc.font('Helvetica').fontSize(9.5).text('OI-FoGe-39 (Verificación Intermedia de Temperatura)', xD, y + 7, { width: W - B - C, align: 'center', lineBreak: false });
            y += 22 + 6;
            doc.save().lineWidth(0.7).moveTo(xB, y).lineTo(xB + W, y).stroke().restore();
            y += 5;
        }

        // ── Antecedentes del Termómetro (B18:H20) ──────────────────────────────
        {
            titulo(doc, xB + 1, y, 'Antecedentes del Térmómetro', 7);
            doc.font('Helvetica-Bold').fontSize(7).text('Fecha', xE, y + 3, { width: E, align: 'center', lineBreak: false });
            doc.text(fmtFecha(v.fecha_verificacion), xF, y + 3, { width: F + G, align: 'center', lineBreak: false });
            y += 15;
            const h = 15;
            marcoDoble(doc, xB, y, W, h * 2);
            celda(doc, xB, y, B, h, 'Equipo', { align: 'left', size: 7 });
            celda(doc, xC, y, C + D, h, v.nombre_equipo || '', { size: 7 });
            celda(doc, xE, y, E, h, 'Código', { align: 'left', size: 7 });
            celda(doc, xF, y, F + G + H, h, v.codigo_equipo || '', { bold: true, size: 7 });
            y += h;
            celda(doc, xB, y, B + C + D, h, '');
            celda(doc, xE, y, E, h, 'Máxima división', { bold: true, align: 'left', size: 7 });
            celda(doc, xF, y, F + G + H, h, v.maxima_division || '', { size: 7 });
            y += h + 11;
        }

        // ── Antecedentes del Termómetro Patrón (B22:H28) ──────────────────────
        {
            titulo(doc, xB + 1, y, 'Antecedentes del Térmómetro Patrón', 7);
            y += 12;
            const h = 14.5;
            const t = (s) => s || '';
            const equipoPatron = [v.patron_nombre, v.patron_codigo ? `(${v.patron_codigo})` : ''].filter(Boolean).join(' ');
            marcoDoble(doc, xB, y, W, h * 6);
            const fila = (a, b, c, d) => {
                celda(doc, xB, y, B, h, a, { bold: true, align: 'left', size: 7 });
                celda(doc, xC, y, C + D, h, b, { size: 7 });
                celda(doc, xE, y, E, h, c, { bold: true, align: 'left', size: 7 });
                celda(doc, xF, y, F + G + H, h, d, { size: 7 });
                y += h;
            };
            fila('Equipo', equipoPatron, 'Marca', t(v.patron_marca));
            fila('Modelo', t(v.patron_modelo), 'N° Serie', t(v.patron_serie));
            fila('Identificación especial', t(v.patron_identificacion), 'Intervalo Indicación', t(v.patron_intervalo));
            fila('Fecha Calibración', fmtFecha(v.patron_fecha_calibracion), 'Empresa', t(v.patron_empresa));
            celda(doc, xB, y, B, h * 2, 'Máxima división', { bold: true, align: 'left', size: 7 });
            celda(doc, xC, y, C + D, h * 2, t(v.patron_maxima_division), { size: 7 });
            celda(doc, xE, y, E, h * 2, 'Error', { bold: true, align: 'left', size: 7 });
            [['0,0 °', xF, F, 0], ['15,0°', xG, G, 15], ['30,0°', xH, H, 30]].forEach(([lbl, xx, ww, r]) => {
                celda(doc, xx, y, ww, h, lbl, { bold: true, size: 7 });
                celda(doc, xx, y + h, ww, h, fmt1(errPatron[r]), { size: 7 });
            });
            y += h * 2 + 11;
        }

        // ── Mediciones (B30:H49) ───────────────────────────────────────────────
        {
            titulo(doc, xB + 1, y, 'Mediciones', 8);
            y += 13;
            const hEnc = 30;
            const hFila = 12.5;
            const hProm = 13;
            const altoTabla = hEnc + RANGOS.length * (hFila * 5 + hProm);
            marcoDoble(doc, xB, y, W, altoTabla);
            const enc = [
                [xB, B, 'Rangos de\nmedición'],
                [xC, C, 'Temperatura\ntermómetro\npatrón (TP)'],
                [xD, D, 'Error\ntermometro\npatrón'],
                [xE, E, 'Temperatura final\ntermómetro\npatrón (TFP)'],
                [xF, F, 'Temperatura\ntermómetro\ncalibrando (TC)'],
                [xG, G, 'Hora'],
                [xH, H, 'Error de medición\nTC-TFP'],
            ];
            enc.forEach(([xx, ww, txt]) => celda(doc, xx, y, ww, hEnc, txt, { bold: true, size: 6.5 }));
            y += hEnc;
            for (const r of RANGOS) {
                const d = calc.rangos[r];
                celda(doc, xB, y, B, hFila * 5, `${r.toFixed(1)}°C`, { bold: true, size: 7 });
                d.filas.forEach((f, i) => {
                    const yy = y + hFila * i;
                    celda(doc, xC, yy, C, hFila, fmt1(f.tp), { bold: true, size: 7 });
                    celda(doc, xD, yy, D, hFila, fmt1(f.errorPatron), { bold: true, size: 7 });
                    celda(doc, xE, yy, E, hFila, fmt1(f.tfp), { bold: true, size: 7 });
                    celda(doc, xF, yy, F, hFila, fmt1(f.tc), { bold: true, size: 7 });
                    celda(doc, xG, yy, G, hFila, f.hora || '', { bold: true, size: 7 });
                    celda(doc, xH, yy, H, hFila, fmt1(f.error), { bold: true, size: 7 });
                });
                y += hFila * 5;
                celda(doc, xB, y, B, hProm, 'Promedio', { bold: true, align: 'left', size: 7 });
                celda(doc, xC, y, C + D + E + F + G, hProm, '');
                celda(doc, xH, y, H, hProm, fmt1(d.promedio), { bold: true, size: 7, fill: GRIS_PROMEDIO });
                y += hProm;
            }
            y += 9;
            // B51: "Rango de aceptación: Error de medición ≤ +/- 0,5°C"
            doc.font('Helvetica').fontSize(6.8).fillColor('#000');
            const pre = 'Rango de aceptación: Error de medición ';
            doc.text(pre, xB + 1, y, { lineBreak: false });
            const xs = xB + 1 + doc.widthOfString(pre);
            const ancho = menorOIgual(doc, xs, y + 1, 6.8);
            doc.text('+/- 0,5°C', xs + ancho, y, { lineBreak: false });
            y += 13;
        }

        // ── Resumen (E53:F57) y Cumple / No Cumple (E60:F61) ───────────────────
        {
            const h = 13.5;
            marcoDoble(doc, xE, y, E + F, h * 5);
            celda(doc, xE, y, E + F, h, 'Resumen', { bold: true, size: 7 });
            celda(doc, xE, y + h, E, h, 'Rango Temperatura', { bold: true, size: 7 });
            celda(doc, xF, y + h, F, h, 'Error', { bold: true, size: 7 });
            RANGOS.forEach((r, i) => {
                const yy = y + h * (i + 2);
                celda(doc, xE, yy, E, h, `${r.toFixed(1).replace('.', ',')}°`, { bold: true, size: 7 });
                celda(doc, xF, yy, F, h, fmt1(calc.rangos[r].promedio), { bold: true, size: 7 });
            });
            y += h * 5 + 10;

            // Se marca con una X según el resultado (en la planilla se marcaba a mano).
            marcoDoble(doc, xE, y, E + F, h * 2);
            const marca = calc.cumple === null ? null : (calc.cumple ? 0 : 1);
            ['Cumple', 'No Cumple'].forEach((lbl, i) => {
                celda(doc, xE, y + h * i, E, h, lbl, { bold: true, size: 7 });
                celda(doc, xF, y + h * i, F, h, marca === i ? 'X' : '', { bold: true, size: 9 });
            });
            y += h * 2 + 12;
        }

        // ── Observación (B64:H65) ─────────────────────────────────────────────
        {
            marcoDoble(doc, xB, y, W, 14 + 30);
            celda(doc, xB, y, W, 14, 'Observación', { bold: true, align: 'left', size: 7.5 });
            celda(doc, xB, y + 14, W, 30, v.observacion || '', { size: 7, align: 'left', pad: 4 });
            y += 14 + 30 + 6;
        }

        // ── Responsable / Firma (B69, F69) ────────────────────────────────────
        // Va al final de la hoja: sin bajar el margen, pdfkit abriría otra página.
        doc.page.margins.bottom = 0;
        {
            doc.font('Helvetica').fontSize(9).fillColor('#000');
            doc.text('Responsable:', xB + 1, y + 16, { lineBreak: false });
            if (v.muestreador_nombre) {
                doc.font('Helvetica-Bold').text(v.muestreador_nombre, xB + 1 + doc.font('Helvetica').widthOfString('Responsable:') + 6, y + 16, { lineBreak: false });
            }
            doc.font('Helvetica').fontSize(9).text('Firma:', xF, y + 16, { lineBreak: false });
            const firma = v.firma_muestreador && String(v.firma_muestreador).startsWith('data:image')
                ? Buffer.from(String(v.firma_muestreador).split(',')[1], 'base64') : null;
            if (firma) {
                const xf = xF + doc.widthOfString('Firma:') + 6;
                try {
                    doc.image(firma, xf, y - 6, { fit: [xB + W - xf, 40], align: 'left', valign: 'center' });
                } catch (e) {
                    logger.warn('Firma inválida en verificación ' + v.id_verificacion + ': ' + e.message);
                }
            }
        }

        doc.end();
    } catch (e) {
        reject(e);
    }
});
