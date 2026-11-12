import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

// PDF de los formularios de equipo, réplica de los Word de Gestión de Calidad:
//   OI-FoGe-22  Ficha Técnica de Equipos   (A4 horizontal)
//   OI-FoGe-24  Historial de Equipo        (A4 vertical, una hoja por año)
//   OI-FoGe-36  Ficha Entrega de Equipo    (A4 vertical)
//   OI-FoGe-42  Recepción, Puesta en Marcha y Verificación de Equipo (A4 vertical)
// Mismo encabezado (logo, "FORMULARIO GENERAL DE GESTIÓN", área, versión y
// fechas) y mismas tablas que el formato. Las páginas se manejan a mano (margen
// 0) para que pdfkit no abra hojas solas al escribir cerca del borde.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let logoBuffer = null;
try {
    logoBuffer = fs.readFileSync(path.resolve(__dirname, '../assets/logo-adl-formulario.jpeg'));
} catch (e) {
    logger.warn('No se encontró el logo de los formularios de equipo: ' + e.message);
}

const NEGRO = '#000';
const AZUL_TITULO = '#1f3a93';
const PIE_CONTROLADO = 'Este documento es válido sólo si es observado desde del sistema informático ADL Soft o si es la copia impresa timbrada como “Documento Controlado”. Copias en otros medios u observadas desde otras fuentes no serán documentos controlados.';

export const FORMATOS = {
    tecnica: { codigo: 'OI-FoGe-22', nombre: 'Ficha Técnica de Equipos', version: 'Versión 01', vigencia: '20/06/2016', revision: '12/01/2026', colorTitulo: AZUL_TITULO, pie: true },
    historial: { codigo: 'OI-FoGe-24', nombre: 'Historial de equipo', version: 'Versión 01', vigencia: '20/06/2016', revision: '12/01/2026', colorTitulo: NEGRO, pie: true },
    entrega: { codigo: 'OI-FoGe-36', nombre: 'Ficha Entrega de Equipo', version: 'Versión 01', vigencia: '10/03/2013', revision: '12/01/2026', colorTitulo: NEGRO, pie: false },
    recepcion: { codigo: 'OI-FoGe-42', nombre: 'Recepción, Puesta en Marcha y Verificación de Equipo', version: 'Versión 01', vigencia: '28/12/2020', revision: '12/01/2026', colorTitulo: NEGRO, pie: false, titulo: 'FORMULARIO\nDE\nGENERAL DE GESTIÓN' },
};

// Ítems del OI-FoGe-42 con sus tres opciones, en el orden del formato.
export const ITEMS_RECEPCION = {
    caja: ['Sin problema', 'Con Golpe', 'No Aplica'],
    embalaje: ['Cumple', 'No Cumple', 'No Aplica'],
    manual: ['Con Manual', 'Sin Manual', 'No Aplica'],
    cable: ['Sí', 'No', 'No Aplica'],
    accesorios: ['Sí', 'No', 'No Aplica'],
    interruptor: ['Bueno', 'Malo', 'No Aplica'],
    comandos: ['Buena', 'Mala', 'No Aplica'],
    encendido: ['Enciende', 'No Enciende', 'No Aplica'],
};

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

const ymd = (v) => {
    if (!v) return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};

/** "2024-11-04" → "04-11-2024" (como en el formato). */
export const fechaCorta = (v, sep = '-') => {
    const s = ymd(v);
    if (!s) return '';
    const [a, m, d] = s.split('-');
    return `${d}${sep}${m}${sep}${a}`;
};

/** "2024-07-17" → "17 DE JULIO 2024". */
export const fechaLarga = (v) => {
    const s = ymd(v);
    if (!s) return '';
    const [a, m, d] = s.split('-');
    return `${Number(d)} DE ${MESES[Number(m) - 1]} ${a}`;
};

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());

const nuevoDoc = (titulo, horizontal = false) => {
    const doc = new PDFDocument({
        size: 'A4',
        layout: horizontal ? 'landscape' : 'portrait',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: { Title: titulo, Author: 'ADL One' },
    });
    const chunks = [];
    const listo = new Promise((resolve, reject) => {
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
    return { doc, listo };
};

const rect = (doc, x, y, w, h, grosor = 0.7) => {
    doc.save().lineWidth(grosor).strokeColor(NEGRO).rect(x, y, w, h).stroke().restore();
};

/** Texto dentro de una caja, centrado vertical (y horizontal según `align`). */
const textoEnCaja = (doc, x, y, w, h, str, { size = 8, bold = false, align = 'center', color = NEGRO, pad = 4, valign = 'center', oblique = false } = {}) => {
    if (!str) return;
    const fuente = bold ? (oblique ? 'Helvetica-BoldOblique' : 'Helvetica-Bold') : (oblique ? 'Helvetica-Oblique' : 'Helvetica');
    doc.font(fuente).fontSize(size).fillColor(color);
    const alto = doc.heightOfString(String(str), { width: w - pad * 2, align });
    const yy = valign === 'top' ? y + pad : y + Math.max(1.5, (h - alto) / 2 + 0.5);
    doc.text(String(str), x + pad, yy, { width: w - pad * 2, align, lineGap: 0.5 });
};

/** Encabezado del formulario; devuelve la y donde termina. */
const encabezado = (doc, formato, x, y, w) => {
    const f = FORMATOS[formato];
    const wLogo = w * 0.245;
    const wTit = w * 0.34;
    const wCol = (w - wLogo - wTit) / 2;
    const h = 72;
    const xTit = x + wLogo;
    const xA = xTit + wTit;
    const xB = xA + wCol;
    // Doble línea exterior, como las tablas del Word.
    rect(doc, x - 2, y - 2, w + 4, h + 26 + 4, 0.6);
    rect(doc, x, y, wLogo, h);
    if (logoBuffer) doc.image(logoBuffer, x + 8, y + 10, { fit: [wLogo - 16, h - 20], align: 'center', valign: 'center' });
    rect(doc, xTit, y, wTit, h);
    textoEnCaja(doc, xTit, y, wTit, h, f.titulo || 'FORMULARIO\nGENERAL DE GESTIÓN', { size: 12, color: f.colorTitulo });
    const h1 = 28;
    const h2 = 18;
    const h3 = h - h1 - h2;
    rect(doc, xA, y, wCol, h1);
    rect(doc, xB, y, wCol, h1);
    const encCampo = (xx, yy, ww, hh, titulo, valor, negritaTitulo = true) => {
        doc.font(negritaTitulo ? 'Helvetica-Bold' : 'Helvetica').fontSize(7).fillColor(NEGRO).text(titulo, xx + 3, yy + 3, { width: ww - 6, lineBreak: false });
        doc.font('Helvetica').fontSize(7).text(valor, xx + 3, yy + 11, { width: ww - 6, lineGap: 0 });
    };
    encCampo(xA, y, wCol, h1, 'Área', 'Gestión de Calidad');
    encCampo(xB, y, wCol, h1, 'Unidad', 'No Aplica');
    rect(doc, xA, y + h1, wCol * 2, h2);
    textoEnCaja(doc, xA, y + h1, wCol * 2, h2, f.version, { size: 10 });
    rect(doc, xA, y + h1 + h2, wCol, h3);
    rect(doc, xB, y + h1 + h2, wCol, h3);
    encCampo(xA, y + h1 + h2, wCol, h3, 'Fecha Vigencia', f.vigencia, formato === 'tecnica');
    encCampo(xB, y + h1 + h2, wCol, h3, 'Fecha Revisión', f.revision, formato === 'tecnica');
    // Fila del código.
    const yc = y + h + 4;
    rect(doc, x, yc, w, 20);
    doc.font('Helvetica').fontSize(9).fillColor(NEGRO);
    if (formato === 'entrega') {
        doc.text('CÓDIGO:', x, yc + 6, { width: w * 0.3, align: 'center', lineBreak: false });
        doc.text(`${f.codigo} (${f.nombre})`, x + w * 0.3, yc + 6, { width: w * 0.7, align: 'center', lineBreak: false });
    } else if (formato === 'recepcion') {
        doc.text('CÓDIGO:', x + 3, yc + 6, { lineBreak: false });
        doc.text(`${f.codigo}(${f.nombre})`, x + 52, yc + 6, { width: w - 56, height: 10, lineBreak: false, ellipsis: true });
    } else {
        doc.text(formato === 'historial' ? 'CODIGO' : 'CÓDIGO       :', x + 8, yc + 6, { lineBreak: false });
        doc.text(`${f.codigo} (${f.nombre})`, x + (formato === 'historial' ? w * 0.29 : 95), yc + 6, { lineBreak: false });
    }
    return yc + 20;
};

const pie = (doc, formato) => {
    if (!FORMATOS[formato].pie) return;
    const w = doc.page.width * 0.78;
    const x = (doc.page.width - w) / 2;
    doc.font('Helvetica').fontSize(7).fillColor(NEGRO)
        .text(PIE_CONTROLADO, x, doc.page.height - 58, { width: w, align: 'center', lineGap: 0.5 });
};

/**
 * Caja con pares "ETIQUETA: valor" uno debajo del otro (todo en negrita, como
 * el formato). Devuelve la altura que necesita si `medir` es true.
 */
const caja = (doc, x, y, w, h, pares, { size = 8.5, medir = false, gap = 7, grande = null } = {}) => {
    const pad = 5;
    let alto = pad;
    const lineas = [];
    for (const [et, val] of pares) {
        if (et === null) continue;
        const str = val ? `${et} ${val}` : et;
        doc.font('Helvetica-Bold').fontSize(size);
        const hh = doc.heightOfString(str, { width: w - pad * 2, lineGap: 1 });
        lineas.push({ str, y: alto, hh });
        alto += hh + gap;
    }
    if (grande) {
        doc.font('Helvetica-Bold').fontSize(grande.size);
        alto += doc.heightOfString(grande.texto, { width: w - pad * 2 }) + gap;
    }
    alto = alto - gap + pad;
    if (medir) return alto;
    rect(doc, x, y, w, h);
    for (const l of lineas) {
        doc.font('Helvetica-Bold').fontSize(size).fillColor(NEGRO).text(l.str, x + pad, y + l.y, { width: w - pad * 2, lineGap: 1 });
    }
    if (grande) {
        const yy = lineas.length ? y + lineas[lineas.length - 1].y + lineas[lineas.length - 1].hh + 6 : y + pad;
        doc.font('Helvetica-Bold').fontSize(grande.size).text(grande.texto, x + pad, yy, { width: w - pad * 2, align: 'center' });
    }
    return h;
};

/** Fila de cajas con la misma altura (la mayor que pidan, mínimo `min`). */
const filaCajas = (doc, x, y, columnas, { min = 30, size } = {}) => {
    let xx = x;
    const alto = Math.max(min, ...columnas.map((c) => caja(doc, 0, 0, c.w, 0, c.pares, { size, medir: true, grande: c.grande })));
    for (const c of columnas) {
        caja(doc, xx, y, c.w, alto, c.pares, { size, grande: c.grande });
        xx += c.w;
    }
    return y + alto;
};

/** Dibuja una firma (Buffer) ajustada a la caja; si es inválida, no dibuja nada. */
const dibujarFirma = (doc, firma, x, y, w, h) => {
    if (!firma || w <= 0 || h <= 0) return;
    try {
        doc.image(firma, x, y, { fit: [w, h], align: 'center', valign: 'center' });
    } catch (e) {
        logger.warn('Firma inválida en el formulario: ' + e.message);
    }
};

const imagenFirma = (dataUrl) => (dataUrl && String(dataUrl).startsWith('data:image')
    ? Buffer.from(String(dataUrl).split(',')[1], 'base64') : null);

// ─── OI-FoGe-22 · Ficha Técnica de Equipos ─────────────────────────────────

/**
 * @param d {
 *   nombre, marca, modelo, serie, codigo, frecuencia_calibracion, frecuencia_mantencion,
 *   fecha_adquisicion, fecha_baja, observaciones, autorizacion_uso: string[],
 *   registros: [{ fecha_calibracion, fecha_mantencion, institucion, certificado,
 *                 proxima_calibracion, proxima_mantencion, firma, observaciones }]
 * }
 */
export const pdfFichaTecnica = (d) => {
    const { doc, listo } = nuevoDoc(`OI-FoGe-22 ${d.codigo || ''}`, true);
    const X = 34;
    const W = doc.page.width - 68;
    const xEnc = X + W * 0.08;
    const wEnc = W * 0.84;
    const limite = doc.page.height - 72;

    // Tabla de registros: anchos del Word (141 · 137 · 139 · 138 · 140 · 138 · 89 · 179).
    const anchos = [141, 137, 139, 138, 140, 138, 89, 179];
    const total = anchos.reduce((a, b) => a + b, 0);
    const cols = anchos.map((a) => (a / total) * W);
    const titulos = ['FECHA\nCALIBRACIÓN', 'FECHA\nMANTENCIÓN', 'INSTITUCIÓN', 'CERTIFICADO\n/INFORME', 'PRÓXIMA\nCALIBRACIÓN', 'PRÓXIMA\nMANTENCIÓN', 'FIRMA', 'OBSERVACIONES'];

    const cabeceraTabla = (y) => {
        let xx = X;
        titulos.forEach((t, i) => {
            rect(doc, xx, y, cols[i], 28);
            textoEnCaja(doc, xx, y, cols[i], 28, t, { size: 8, bold: true, pad: 2 });
            xx += cols[i];
        });
        return y + 28;
    };

    let y = encabezado(doc, 'tecnica', xEnc, 36, wEnc) + 26;

    // Datos del equipo.
    const w1 = W * 0.305;
    const w2 = W * 0.305;
    const w3 = W - w1 - w2;
    y = filaCajas(doc, X, y, [
        { w: w1, pares: [['NOMBRE EQUIPO:', texto(d.nombre)], ['MARCA:', texto(d.marca)]] },
        { w: w2, pares: [['MODELO:', texto(d.modelo)], ['SERIE:', texto(d.serie)]] },
        { w: w3, pares: [['CÓDIGO INTERNO:', texto(d.codigo)]] },
    ], { min: 36 });
    const wIzq = W * 0.465;
    y = filaCajas(doc, X, y, [
        { w: wIzq, pares: [['FRECUENCIA DE CALIBRACIÓN:', texto(d.frecuencia_calibracion)], ['FRECUENCIA DE MANTENCIÓN:', texto(d.frecuencia_mantencion)]] },
        { w: W - wIzq, pares: [['FECHA DE ADQUISICIÓN:', fechaCorta(d.fecha_adquisicion) || texto(d.fecha_adquisicion)], ['FECHA DE BAJA:', fechaCorta(d.fecha_baja) || '-------']] },
    ], { min: 32 });
    const autorizados = (d.autorizacion_uso || []).map(texto).filter(Boolean);
    y = filaCajas(doc, X, y, [
        { w: wIzq, pares: [['OBSERVACIONES:', ''], [texto(d.observaciones) || null, '']] },
        { w: W - wIzq, pares: [['AUTORIZACIÓN DE USO:', ''], ...autorizados.map((a) => [`•  ${a}`, ''])] },
    ], { min: 40 });

    y += 22;
    y = cabeceraTabla(y);

    const registros = d.registros || [];
    // El formato trae 3 filas en blanco; si hay menos registros se completan.
    const filas = [...registros];
    while (filas.length < 3) filas.push({});

    for (const r of filas) {
        const celdas = [
            fechaCorta(r.fecha_calibracion, '/'), fechaCorta(r.fecha_mantencion, '/'), texto(r.institucion), texto(r.certificado),
            fechaCorta(r.proxima_calibracion, '/'), fechaCorta(r.proxima_mantencion, '/'), '', texto(r.observaciones),
        ];
        // Celda FIRMA: las firmas elegidas, una sobre otra (imagen o, si no hay, el nombre).
        const firmas = (Array.isArray(r.firmas_celda)
            ? r.firmas_celda.map((f) => ({ img: imagenFirma(f.img), nombre: texto(f.nombre) }))
            : [
                { img: imagenFirma(r.firma_registra || r.firma), nombre: texto(r.nombre_registra || r.firmante) },
                { img: imagenFirma(r.firma_valida), nombre: texto(r.nombre_valida) },
            ]).filter((f) => f.img || f.nombre);
        doc.font('Helvetica').fontSize(7.5);
        // Cada firma lleva debajo el nombre de su dueño: necesita su propio alto.
        const ALTO_FIRMA = 30;
        const alto = Math.max(firmas.length ? ALTO_FIRMA * firmas.length : 24, ...celdas.map((c, i) => (c ? doc.heightOfString(c, { width: cols[i] - 6, lineGap: 0.5 }) + 8 : 0)));
        if (y + alto > limite) {
            pie(doc, 'tecnica');
            doc.addPage();
            y = encabezado(doc, 'tecnica', xEnc, 36, wEnc) + 20;
            y = cabeceraTabla(y);
        }
        let xx = X;
        celdas.forEach((c, i) => {
            rect(doc, xx, y, cols[i], alto);
            textoEnCaja(doc, xx, y, cols[i], alto, c, { size: 7.5, pad: 3, align: i === 7 ? 'left' : 'center' });
            if (i === 6 && firmas.length) {
                const hF = alto / firmas.length;
                firmas.forEach((f, k) => {
                    const yF = y + hF * k;
                    const hNombre = f.img && f.nombre ? 7 : 0;
                    let dibujada = false;
                    if (f.img) {
                        try {
                            doc.image(f.img, xx + 3, yF + 1.5, { fit: [cols[i] - 6, hF - 3 - hNombre], align: 'center', valign: 'center' });
                            dibujada = true;
                        } catch (e) {
                            logger.warn('Firma inválida en la ficha técnica: ' + e.message);
                        }
                    }
                    if (dibujada && f.nombre) {
                        // De quién es la firma, debajo de ella.
                        doc.font('Helvetica').fontSize(5).fillColor(NEGRO)
                            .text(f.nombre, xx + 1, yF + hF - hNombre - 0.5, { width: cols[i] - 2, height: hNombre, align: 'center', lineBreak: false, ellipsis: true });
                    } else if (!dibujada) {
                        textoEnCaja(doc, xx, yF, cols[i], hF, f.nombre, { size: 6.5, pad: 2 });
                    }
                    // Línea suave entre firmas.
                    if (k > 0) doc.save().lineWidth(0.3).strokeColor('#bbbbbb').moveTo(xx + 4, yF).lineTo(xx + cols[i] - 4, yF).stroke().restore();
                });
            }
            xx += cols[i];
        });
        y += alto;
    }

    pie(doc, 'tecnica');
    doc.end();
    return listo;
};

// ─── OI-FoGe-24 · Historial de Equipo ──────────────────────────────────────

/**
 * @param d { codigo, nombre, anio, lineas: [{ fecha: 'dd/mm/aaaa', texto }] }
 */
export const pdfHistorial = (d) => {
    const { doc, listo } = nuevoDoc(`OI-FoGe-24 ${d.codigo || ''} ${d.anio || ''}`);
    const xEnc = 50;
    const wEnc = doc.page.width - 100;
    const X = 75;
    const W = doc.page.width - 150;
    const wFecha = W * 0.206;
    const wObs = W - wFecha;
    const FILAS_HOJA = 15;
    const hFila = 37;
    const limite = doc.page.height - 80;

    const lineas = d.lineas || [];
    let i = 0;
    let hoja = 0;
    do {
        if (hoja > 0) {
            pie(doc, 'historial');
            doc.addPage();
        }
        let y = encabezado(doc, 'historial', xEnc, 34, wEnc) + 16;
        // El Word no identifica al equipo: sin esta línea la hoja impresa no
        // dice de qué equipo ni de qué año es.
        doc.font('Helvetica-Bold').fontSize(8).fillColor(NEGRO)
            .text(`EQUIPO: ${texto(d.nombre)}`, X, y, { width: W * 0.47, height: 10, lineBreak: false, ellipsis: true });
        doc.text(`CÓDIGO INTERNO: ${texto(d.codigo)}`, X + W * 0.47, y, { width: W * 0.41, height: 10, lineBreak: false, ellipsis: true });
        doc.text(`AÑO: ${d.anio}`, X + W * 0.88, y, { width: W * 0.12, align: 'right', lineBreak: false });
        y += 18;
        rect(doc, X, y, wFecha, 30);
        rect(doc, X + wFecha, y, wObs, 30);
        textoEnCaja(doc, X, y, wFecha, 30, 'FECHA', { size: 9, bold: true, valign: 'top' });
        textoEnCaja(doc, X + wFecha, y, wObs, 30, 'OBSERVACIÓN', { size: 9, bold: true, valign: 'top' });
        y += 30;
        let enHoja = 0;
        // Las líneas del año; la hoja se completa con filas en blanco como el formato.
        while ((i < lineas.length || enHoja < FILAS_HOJA) && enHoja < 60) {
            const l = lineas[i];
            doc.font('Helvetica').fontSize(8.5);
            const alto = l ? Math.max(hFila, doc.heightOfString(texto(l.texto), { width: wObs - 10, lineGap: 0.5 }) + 10) : hFila;
            if (y + alto > limite) break;
            rect(doc, X, y, wFecha, alto);
            rect(doc, X + wFecha, y, wObs, alto);
            if (l) {
                textoEnCaja(doc, X, y, wFecha, alto, l.fecha, { size: 8.5 });
                textoEnCaja(doc, X + wFecha, y, wObs, alto, texto(l.texto), { size: 8.5, align: 'left', pad: 5 });
                i += 1;
            }
            y += alto;
            enHoja += 1;
        }
        hoja += 1;
    } while (i < lineas.length);

    pie(doc, 'historial');
    doc.end();
    return listo;
};

// ─── OI-FoGe-36 · Ficha Entrega de Equipo ──────────────────────────────────

/**
 * @param d { nombre, marca, modelo, serie, codigo, proveedor, n_factura, fecha_factura,
 *   valor, frecuencia_mantencion, fecha_adquisicion, area, seccion, responsable_equipo,
 *   fecha_recepcion, observaciones, responsable_entrega, responsable_area, fecha_entrega, fecha_area }
 */
export const pdfEntrega = (d) => {
    const { doc, listo } = nuevoDoc(`OI-FoGe-36 ${d.codigo || ''}`);
    const X = 50;
    const W = doc.page.width - 100;
    const NI = 'N/I';
    const may = (v, def = NI) => (texto(v) ? texto(v).toUpperCase() : def);

    let y = encabezado(doc, 'entrega', X + W * 0.06, 42, W * 0.88) + 22;

    // Aviso de responsabilidad.
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NEGRO);
    doc.text('IMPORTANTE', X, y, { continued: true, underline: true })
        .font('Helvetica-BoldOblique').text(':” El equipo que a continuación se detalla, es de exclusiva responsabilidad de quién lo recibe. En caso de pérdida, robo o cualquier daño que sufra el equipo, la Empresa está facultada para realizar el descuento correspondiente en su remuneración y/o finiquito, según lo estipulado en Anexo de Contrato.', { underline: false, width: W, lineGap: 0.5 });
    y = doc.y + 14;

    const c1 = W * 0.341;
    const c2 = W * 0.346;
    const c3 = W - c1 - c2;
    const mitad = W * 0.49;
    y = filaCajas(doc, X, y, [
        { w: c1, pares: [['NOMBRE EQUIPO:', may(d.nombre)], ['MARCA:', may(d.marca)]] },
        { w: c2, pares: [['MODELO:', may(d.modelo)], ['SERIE:', may(d.serie)]] },
        { w: c3, pares: [['CÓDIGO INTERNO:', '']], grande: { texto: texto(d.codigo) || NI, size: 13 } },
    ], { min: 58, size: 9 });
    y = filaCajas(doc, X, y, [
        { w: mitad, pares: [['PROVEEDOR:', may(d.proveedor)]] },
        { w: W - mitad, pares: [['N° DE FACTURA:', may(d.n_factura)], ['FECHA FACTURA:', fechaCorta(d.fecha_factura) || may(d.fecha_factura)], ['VALOR:', may(d.valor)]] },
    ], { min: 56, size: 9 });
    y = filaCajas(doc, X, y, [
        { w: mitad, pares: [['FRECUENCIA DE MANTENCIÓN:', may(d.frecuencia_mantencion, 'NO APLICA')]] },
        { w: W - mitad, pares: [['FECHA DE ADQUISICIÓN:', fechaCorta(d.fecha_adquisicion) || may(d.fecha_adquisicion)]] },
    ], { min: 38, size: 9 });
    y = filaCajas(doc, X, y, [
        { w: mitad, pares: [['ÁREA:', may(d.area, 'MEDIO AMBIENTE')]] },
        { w: W - mitad, pares: [['SECCIÓN/UNIDAD:', may(d.seccion, 'NO APLICA')]] },
    ], { min: 24, size: 9 });
    const yResponsable = y;
    y = filaCajas(doc, X, y, [
        { w: c1, pares: [['RESPONSABLE DEL EQUIPO:', ''], [may(d.responsable_equipo, ' '), '']] },
        { w: c2, pares: [['FIRMA:', '']] },
        { w: c3, pares: [['FECHA RECEPCIÓN:', ''], [fechaCorta(d.fecha_recepcion) || ' ', '']] },
    ], { min: 50, size: 9 });
    // Firma de quien recibe, dentro de la casilla FIRMA.
    dibujarFirma(doc, imagenFirma(d.firma_equipo), X + c1 + 4, yResponsable + 16, c2 - 8, y - yResponsable - 19);

    // Observaciones.
    y += 12;
    doc.font('Helvetica-Bold').fontSize(9);
    const obs = texto(d.observaciones);
    const hObs = Math.max(62, 26 + (obs ? doc.heightOfString(obs, { width: W - 10, lineGap: 1 }) : 0) + 8);
    rect(doc, X, y, W, hObs);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NEGRO).text('OBSERVACIONES:', X + 5, y + 6);
    if (obs) doc.text(obs, X + 5, y + 24, { width: W - 10, lineGap: 1 });
    y += hObs;

    // Firmas. Van abajo; si las observaciones son largas, se corren.
    const yFirmas = Math.max(y + 90, doc.page.height - 250);
    const wLinea = W * 0.38;
    const firmaBloque = (xx, nombre, rol, etiquetaFecha, fecha, firma) => {
        // La firma va sobre el nombre, apoyada en la línea.
        dibujarFirma(doc, imagenFirma(firma), xx + wLinea * 0.15, yFirmas - 60, wLinea * 0.7, 42);
        if (texto(nombre)) {
            doc.font('Helvetica').fontSize(8.5).text(texto(nombre).toUpperCase(), xx, yFirmas - 13, { width: wLinea, align: 'center', lineBreak: false });
        }
        doc.save().lineWidth(0.7).moveTo(xx, yFirmas).lineTo(xx + wLinea, yFirmas).stroke().restore();
        doc.font('Helvetica-Bold').fontSize(7.5).text(`Nombre y Firma\n${rol}`, xx, yFirmas + 3, { width: wLinea, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(7.5).text(`${etiquetaFecha}: ${fechaLarga(fecha)}`, xx, yFirmas + 34, { width: wLinea, align: 'center', lineBreak: false });
    };
    firmaBloque(X + 4, d.responsable_entrega, 'Responsable de Entrega', 'Fecha de entrega', d.fecha_entrega, d.firma_entrega);
    firmaBloque(X + W - wLinea - 4, d.responsable_area, 'Responsable de Área', 'Fecha', d.fecha_area || d.fecha_entrega, d.firma_area);

    doc.end();
    return listo;
};

// ─── OI-FoGe-42 · Recepción, Puesta en Marcha y Verificación de Equipo ─────

/**
 * @param d { nombre, codigo, marca, modelo, serie, fecha,
 *   recepcion, puesta_marcha, verificacion (bool: qué se está registrando),
 *   caja, embalaje, manual, cable, accesorios, interruptor, comandos, encendido
 *     (la opción elegida, ver ITEMS_RECEPCION),
 *   otros, estado_recepcion, funcionamiento, patron_referencia, observaciones,
 *   firma_recepcion, firma_calidad (nombres, opcionales) }
 */
export const pdfRecepcion = (d) => {
    const { doc, listo } = nuevoDoc(`OI-FoGe-42 ${d.codigo || ''}`);
    let y = encabezado(doc, 'recepcion', 84, 30, 430) + 18;
    const X = 88;
    const W = 422;

    doc.font('Helvetica-Bold').fontSize(10).fillColor(NEGRO)
        .text('RECEPCIÓN, PUESTA EN MARCHA Y VERIFICACIÓN DE EQUIPO', X, y, { width: W, align: 'center' });
    y += 34;

    // Datos del equipo: "Etiqueta  :  ______" en dos columnas.
    const campo = (xx, yy, etiqueta, valor, wLinea) => {
        doc.font('Helvetica').fontSize(9).fillColor(NEGRO).text(etiqueta, xx, yy, { lineBreak: false });
        doc.text(':', xx + 50, yy, { lineBreak: false });
        doc.save().lineWidth(0.6).moveTo(xx + 60, yy + 11).lineTo(xx + 60 + wLinea, yy + 11).stroke().restore();
        if (valor) doc.font('Helvetica').fontSize(8.5).text(valor, xx + 63, yy + 1, { width: wLinea - 4, height: 10, lineBreak: false, ellipsis: true });
    };
    const filasDatos = [
        ['Equipo', texto(d.nombre), 'Cód. Interno', texto(d.codigo)],
        ['Marca', texto(d.marca), 'Modelo', texto(d.modelo)],
        ['Serie', texto(d.serie), 'Fecha', fechaCorta(d.fecha, '/')],
    ];
    for (const [e1, v1, e2, v2] of filasDatos) {
        campo(X, y, e1, v1, 150);
        doc.font('Helvetica').fontSize(9).text(e2, X + 225, y, { lineBreak: false });
        doc.text(':', X + 295, y, { lineBreak: false });
        doc.save().lineWidth(0.6).moveTo(X + 302, y + 11).lineTo(X + W, y + 11).stroke().restore();
        if (v2) doc.font('Helvetica').fontSize(8.5).text(v2, X + 305, y + 1, { width: W - 306, height: 10, lineBreak: false, ellipsis: true });
        y += 17;
    }
    y += 6;

    // Qué se registra: Recepción [ ]  Puesta en Marcha [ ]  Verificación [ ]
    const marca = (xx, yy, w, h, on) => {
        if (on) textoEnCaja(doc, xx, yy, w, h, 'X', { size: 9, bold: true, pad: 0 });
    };
    const tipos = [['Recepción', d.recepcion, X + 50], ['Puesta en Marcha', d.puesta_marcha, X + 168], ['Verificación', d.verificacion, X + 305]];
    for (const [et, on, xx] of tipos) {
        doc.font('Helvetica').fontSize(9).fillColor(NEGRO);
        const wt = doc.widthOfString(et);
        doc.text(et, xx, y + 5, { lineBreak: false });
        rect(doc, xx + wt + 8, y, 18, 18);
        marca(xx + wt + 8, y, 18, 18, !!on);
    }
    y += 32;

    // Tablas de opciones: etiqueta · (opción, casilla) × 3.
    const H = 13;
    const fr = [0.355, 0.17, 0.045, 0.17, 0.045, 0.17, 0.045];
    const cols = fr.map((f) => f * W);
    const titulo = (yy, t) => {
        rect(doc, X, yy, W, H + 1);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NEGRO).text(t, X + 4, yy + 3.5, { lineBreak: false });
        return yy + H + 1;
    };
    const filaOpciones = (yy, etiqueta, clave) => {
        const opciones = ITEMS_RECEPCION[clave];
        const elegida = texto(d[clave]);
        let xx = X;
        const celdas = [etiqueta, opciones[0], '', opciones[1], '', opciones[2], ''];
        celdas.forEach((c, i) => {
            rect(doc, xx, yy, cols[i], H);
            if (c) doc.font('Helvetica').fontSize(8).fillColor(NEGRO).text(c, xx + 4, yy + 3, { width: cols[i] - 6, lineBreak: false });
            if (i % 2 === 0 && i > 0) marca(xx, yy, cols[i], H, elegida === opciones[i / 2 - 1]);
            xx += cols[i];
        });
        return yy + H;
    };
    const filaTexto = (yy, etiqueta, valor, wEt = cols[0]) => {
        doc.font('Helvetica').fontSize(8);
        const v = texto(valor);
        const alto = Math.max(H, v ? doc.heightOfString(v, { width: W - wEt - 8 }) + 5 : 0);
        rect(doc, X, yy, wEt, alto);
        rect(doc, X + wEt, yy, W - wEt, alto);
        doc.fillColor(NEGRO).text(etiqueta, X + 4, yy + 3, { width: wEt - 6, lineBreak: false });
        if (v) doc.text(v, X + wEt + 4, yy + 3, { width: W - wEt - 8 });
        return yy + alto;
    };
    // Bloque de texto libre debajo de su título (Estado Recepción, Observaciones).
    const bloqueTexto = (yy, valor, min) => {
        doc.font('Helvetica').fontSize(8);
        const v = texto(valor);
        const alto = Math.max(min, v ? doc.heightOfString(v, { width: W - 8, lineGap: 0.5 }) + 7 : 0);
        rect(doc, X, yy, W, alto);
        if (v) doc.fillColor(NEGRO).text(v, X + 4, yy + 3.5, { width: W - 8, lineGap: 0.5 });
        return yy + alto;
    };

    y = titulo(y, 'Recepción de Equipo');
    y = filaOpciones(y, 'Condición de caja', 'caja');
    y = filaOpciones(y, 'Condición de embalaje', 'embalaje');
    y += 13;

    y = titulo(y, 'Contenido Caja');
    y = filaOpciones(y, 'Contiene Manual', 'manual');
    y = filaOpciones(y, 'Contiene Cable Alimentación', 'cable');
    y = filaOpciones(y, 'Contiene Accesorios', 'accesorios');
    y = filaTexto(y, 'Otros', d.otros);
    y += 13;

    y = titulo(y, 'Puesta en Marcha');
    y = filaOpciones(y, 'Condición interruptor', 'interruptor');
    y = filaOpciones(y, 'Condición de comandos', 'comandos');
    y = filaOpciones(y, 'Encendido', 'encendido');
    rect(doc, X, y, W, H);
    doc.font('Helvetica').fontSize(8).fillColor(NEGRO).text('Estado Recepción', X + 4, y + 3, { lineBreak: false });
    y = bloqueTexto(y + H, d.estado_recepcion, 16);
    y += 13;

    y = titulo(y, 'Verificación');
    y = filaTexto(y, 'Funcionamiento', d.funcionamiento, W * 0.33);
    y = filaTexto(y, 'Con Patrón de Referencia', d.patron_referencia, W * 0.33);
    y += 13;

    y = titulo(y, 'Observaciones');
    y = bloqueTexto(y, d.observaciones, 22);

    // Firmas.
    // Firma (imagen) sobre el nombre, y el nombre sobre la línea.
    const yFirmas = Math.min(y + 80, doc.page.height - 90);
    const wLinea = W * 0.39;
    const firma = (xx, nombre, rol, imagen) => {
        dibujarFirma(doc, imagenFirma(imagen), xx + wLinea * 0.15, yFirmas - 56, wLinea * 0.7, 42);
        if (texto(nombre)) {
            doc.font('Helvetica').fontSize(8.5).fillColor(NEGRO).text(texto(nombre), xx, yFirmas - 12, { width: wLinea, align: 'center', lineBreak: false });
        }
        doc.save().lineWidth(0.7).moveTo(xx, yFirmas).lineTo(xx + wLinea, yFirmas).stroke().restore();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(NEGRO).text(rol, xx, yFirmas + 4, { width: wLinea, align: 'center' });
    };
    firma(X + 4, d.firma_recepcion, 'Firma Recepción Área\nTécnica Medio Ambiente', d.imagen_firma_recepcion);
    firma(X + W - wLinea, d.firma_calidad, 'Firma Área Gestión de\nCalidad', d.imagen_firma_calidad);

    doc.font('Helvetica').fontSize(8).text('Página 1 de 1', X, doc.page.height - 60, { width: W, align: 'right', lineBreak: false });

    doc.end();
    return listo;
};
