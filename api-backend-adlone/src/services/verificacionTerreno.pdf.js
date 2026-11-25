import { nuevoDoc, rect, textoEnCaja, encabezado, pie, fechaCorta, texto, NEGRO, imagenFirma, dibujarFirma } from './fichasEquipo.pdf.js';
import { ITEMS_VERIF_EQUIPOS, BUFFERS_PH, ITEMS_MAU, ITEMS_MATERIALES, CARACTERISTICAS } from './verificacionTerreno.items.js';

// Los tres formularios de terreno de G.C. Medio Ambiente, en tamaño carta como sus documentos:
//   OI-FoGe-26 (pH/oxígeno/cloro) · OI-FoMa-03 (muestreador automático) · OI-FoMa-19 (materiales y EPP)

const CARTA = 'LETTER';
const MARGEN_X = 60;
const AZUL = '#1f3a93';

const CONTROL = [
    ['Elaborado por:', 'Alejandra Poblete'],
    ['Revisado por:', 'Patricio Bustos'],
    ['Aprobado por:', 'Patricio Bustos'],
];
const NOTA_COPIA = 'La copia original administrada por Gestión de Calidad posee las firmas correspondientes.';

/** Elaborado / Revisado / Aprobado, bajo el encabezado y solo en la primera hoja. */
const firmasControl = (doc, x, y, w) => {
    const wCol = w / 3;
    const hNombre = 24;
    const hFirma = 26;
    CONTROL.forEach(([etiqueta, nombre], i) => {
        const xx = x + wCol * i;
        rect(doc, xx, y, wCol, hNombre);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(AZUL).text(etiqueta, xx + 5, y + 3, { width: wCol - 10, lineBreak: false });
        doc.font('Helvetica-BoldOblique').fontSize(8).text(nombre, xx + 5, y + 12, { width: wCol - 10, lineBreak: false });
        rect(doc, xx, y + hNombre, wCol, hFirma);
        doc.font('Helvetica-Bold').fontSize(7.5).text('Firma:', xx + 5, y + hNombre + 3, { width: wCol - 10, lineBreak: false });
    });
    const yNota = y + hNombre + hFirma + 2;
    doc.font('Helvetica-Oblique').fontSize(6.5).fillColor(NEGRO).text(NOTA_COPIA, x, yNota, { width: w, align: 'center' });
    return yNota + 10;
};

/** Casilla cuadrada; marcada cuando corresponde. */
const casilla = (doc, x, y, marcada, lado = 9) => {
    rect(doc, x, y, lado, lado, 0.6);
    if (marcada) textoEnCaja(doc, x, y, lado, lado, 'X', { size: lado - 1.5, bold: true, pad: 0 });
};

/** Fila «etiqueta | valor» del encabezado de los formularios. */
const campoFila = (doc, x, y, wEt, wVal, etiqueta, valor, alto = 18) => {
    rect(doc, x, y, wEt, alto);
    textoEnCaja(doc, x, y, wEt, alto, etiqueta, { size: 7.5, bold: true, align: 'left', pad: 5 });
    rect(doc, x + wEt, y, wVal, alto);
    textoEnCaja(doc, x + wEt, y, wVal, alto, texto(valor), { size: 8, align: 'left', pad: 5 });
};

/** Lista cumple / no cumple / N/A, como la imprime el formato. */
const tablaItems = (doc, x, y, w, items, marcas, { titulo = 'Parámetros a verificar' } = {}) => {
    const wCol = 42;
    const wNombre = w - wCol * 3;
    const h = 16;
    rect(doc, x, y, wNombre, h);
    textoEnCaja(doc, x, y, wNombre, h, titulo, { size: 8, bold: true, align: 'left', pad: 5 });
    ['Cumple', 'No Cumple', 'N/A'].forEach((t, i) => {
        rect(doc, x + wNombre + wCol * i, y, wCol, h);
        textoEnCaja(doc, x + wNombre + wCol * i, y, wCol, h, t, { size: 7, bold: true });
    });
    let yy = y + h;
    for (const [clave, etiqueta] of items) {
        rect(doc, x, yy, wNombre, h);
        textoEnCaja(doc, x, yy, wNombre, h, etiqueta, { size: 7.5, align: 'left', pad: 5 });
        ['C', 'NC', 'NA'].forEach((v, i) => {
            const xx = x + wNombre + wCol * i;
            rect(doc, xx, yy, wCol, h);
            if (marcas?.[clave] === v) textoEnCaja(doc, xx, yy, wCol, h, 'X', { size: 8, bold: true });
        });
        yy += h;
    }
    return yy;
};

const NOTA_NO_CUMPLE = 'NOTA: Si uno de los puntos de la lista de verificación NO CUMPLE, el equipo NO se encuentra apto para su uso.';

const bloqueFirma = (doc, x, y, w, d, formato, encabezadoDoc) => {
    const h = 44;
    // No puede quedar encima del pie de documento controlado.
    if (y + h > doc.page.height - 80) {
        pie(doc, formato);
        doc.addPage();
        y = encabezado(doc, formato, x, 34, w, encabezadoDoc) + 14;
    }
    rect(doc, x, y, w, h);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NEGRO).text('Nombre y firma:', x + 5, y + 4, { lineBreak: false });
    doc.font('Helvetica').fontSize(8).text(texto(d.nombre_firma), x + 5, y + h - 12, { width: w / 2 - 10, lineBreak: false });
    const img = imagenFirma(d.firma);
    if (img) dibujarFirma(doc, img, x + w / 2, y + 4, w / 2 - 8, h - 10);
    return y + h;
};

// ─── OI-FoGe-26 · pH / oxígeno / cloro ───────────────────────────────────────

/** @param d { encabezado, v: <fila de mae_ma_verif_equipos con los JSON ya parseados> } */
export const pdfVerifEquipos = (d = {}) => {
    const v = d.v || {};
    const { doc, listo } = nuevoDoc(`OI-FoGe-26 Verificación de equipos ${v.folio_foma || ''}`.trim(), false, CARTA);
    const X = MARGEN_X;
    const W = doc.page.width - X * 2;
    let y = firmasControl(doc, X, encabezado(doc, 'verif_equipos', X, 34, W, d.encabezado) + 5, W);
    y += 10;

    const wEt = W * 0.3;
    campoFila(doc, X, y, wEt, W - wEt, 'Fecha y Hora Verificación :', `${fechaCorta(v.fecha_verificacion, '-')}${v.hora_verificacion ? `  ${v.hora_verificacion}` : ''}`); y += 18;
    campoFila(doc, X, y, wEt, W - wEt, 'Folio OI-FoMa-01', v.folio_foma); y += 18;
    campoFila(doc, X, y, wEt, W - wEt, 'Responsable Muestreo:', v.responsable_muestreo); y += 18;
    campoFila(doc, X, y, wEt, W - wEt, 'Lugar de muestreo:', v.lugar_muestreo); y += 22;

    // 1 y 2: equipo de pH con su error de temperatura (viene del muestreo).
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NEGRO)
        .text(`1.- IDENTIFICACIÓN EQUIPO MEDIDOR DE PH/T°:  ${texto(v.codigo_equipo_ph) || '______________'}`, X, y, { width: W });
    y += 16;
    doc.font('Helvetica-Bold').fontSize(9).text('2.- ERROR T°:', X, y, { width: W });
    y += 14;
    const wErr = W / 3;
    [['Error 0,0', v.error_t0], ['Error 15,0', v.error_t15], ['Error 30,0', v.error_t30]].forEach(([et, val], i) => {
        rect(doc, X + wErr * i, y, wErr, 16);
        textoEnCaja(doc, X + wErr * i, y, wErr, 16, et, { size: 7.5, bold: true });
        rect(doc, X + wErr * i, y + 16, wErr, 16);
        textoEnCaja(doc, X + wErr * i, y + 16, wErr, 16, val === null || val === undefined ? '' : String(val), { size: 8.5 });
    });
    y += 34;
    y = tablaItems(doc, X, y, W, ITEMS_VERIF_EQUIPOS.ph, v.items_ph);
    doc.font('Helvetica').fontSize(6.5).text(NOTA_NO_CUMPLE, X, y + 2, { width: W });
    y += 14;

    // Las dos tablas de buffers (ajuste y verificación).
    const tablaBuffer = (titulo, datos) => {
        const cols = ['Buffer pH', 'pH', 'T°', 'T°C', 'N° Lote', 'Marca', 'Vencimiento', 'Desviación Permitida'];
        const anchos = [0.11, 0.08, 0.07, 0.07, 0.12, 0.14, 0.14, 0.27].map((p) => p * W);
        rect(doc, X, y, W, 14);
        textoEnCaja(doc, X, y, W, 14, titulo, { size: 8, bold: true });
        y += 14;
        let x = X;
        cols.forEach((c, i) => { rect(doc, x, y, anchos[i], 15); textoEnCaja(doc, x, y, anchos[i], 15, c, { size: 6.8, bold: true }); x += anchos[i]; });
        y += 15;
        BUFFERS_PH.forEach(([buffer, desviacion], fila) => {
            const f = datos?.[fila] || {};
            const vals = [buffer, f.ph, f.t, f.tc, f.lote, f.marca, f.vencimiento, desviacion];
            x = X;
            vals.forEach((val, i) => {
                rect(doc, x, y, anchos[i], 15);
                textoEnCaja(doc, x, y, anchos[i], 15, texto(val), { size: 7, bold: i === 0 || i === 7 });
                x += anchos[i];
            });
            y += 15;
        });
        y += 6;
    };
    tablaBuffer('Control Medición Ajuste', v.ajuste_ph);
    tablaBuffer('Control Medición Verificación', v.verificacion_ph);

    // 3 y 4: oxígeno y cloro, cada uno en hoja nueva si no cabe.
    const seccion = (titulo, codigo, items, marcas, extra) => {
        if (y + 150 > doc.page.height - 80) { pie(doc, 'verif_equipos'); doc.addPage(); y = encabezado(doc, 'verif_equipos', X, 34, W, d.encabezado) + 14; }
        doc.font('Helvetica-Bold').fontSize(9).fillColor(NEGRO).text(`${titulo}  ${texto(codigo) || '______________'}`, X, y, { width: W });
        y += 16;
        y = tablaItems(doc, X, y, W, items, marcas);
        doc.font('Helvetica').fontSize(6.5).text(NOTA_NO_CUMPLE, X, y + 2, { width: W });
        y += 14;
        if (extra) extra();
    };

    seccion('3.- IDENTIFICACIÓN EQUIPO MEDIDOR DE OXIGENO:', v.codigo_equipo_oxigeno, ITEMS_VERIF_EQUIPOS.oxigeno, v.items_oxigeno, () => {
        const r = v.referencia_oxigeno || {};
        const med = v.mediciones_oxigeno || {};
        const w3 = W / 3;
        ['Lote', 'Fecha caducidad', 'Marca'].forEach((c, i) => { rect(doc, X + w3 * i, y, w3, 14); textoEnCaja(doc, X + w3 * i, y, w3, 14, c, { size: 7, bold: true }); });
        y += 14;
        [r.lote, r.caducidad, r.marca].forEach((val, i) => { rect(doc, X + w3 * i, y, w3, 15); textoEnCaja(doc, X + w3 * i, y, w3, 15, texto(val), { size: 7.5 }); });
        y += 21;
        const w4 = W / 4;
        ['', 'Hora', '0% oxígeno', '100% oxígeno'].forEach((c, i) => { rect(doc, X + w4 * i, y, w4, 14); textoEnCaja(doc, X + w4 * i, y, w4, 14, c, { size: 7, bold: true }); });
        y += 14;
        [['Verificación', med.verificacion], ['Ajuste', med.ajuste]].forEach(([et, fila]) => {
            const f = fila || {};
            [et, f.hora, f.cero, f.cien].forEach((val, i) => {
                rect(doc, X + w4 * i, y, w4, 15);
                textoEnCaja(doc, X + w4 * i, y, w4, 15, texto(val), { size: 7.5, bold: i === 0 });
            });
            y += 15;
        });
        y += 6;
    });

    seccion('4.- IDENTIFICACIÓN EQUIPO MEDIDOR DE CLORO:', v.codigo_equipo_cloro, ITEMS_VERIF_EQUIPOS.cloro, v.items_cloro, () => {
        const r = v.referencia_cloro || {};
        const med = v.mediciones_cloro || {};
        const w4 = W / 4;
        ['Material de referencia', 'Lote', 'Fecha caducidad', 'Rango'].forEach((c, i) => { rect(doc, X + w4 * i, y, w4, 14); textoEnCaja(doc, X + w4 * i, y, w4, 14, c, { size: 7, bold: true }); });
        y += 14;
        [['Estándar 0,00', r.estandar0], ['Estándar 1,00', r.estandar1]].forEach(([et, fila]) => {
            const f = fila || {};
            [et, f.lote, f.caducidad, f.rango].forEach((val, i) => {
                rect(doc, X + w4 * i, y, w4, 15);
                textoEnCaja(doc, X + w4 * i, y, w4, 15, texto(val), { size: 7.5, bold: i === 0 });
            });
            y += 15;
        });
        y += 6;
        const w2 = W / 2;
        ['Verificación Estándar 0,00', 'Verificación Estándar 1,00'].forEach((c, i) => { rect(doc, X + w2 * i, y, w2, 14); textoEnCaja(doc, X + w2 * i, y, w2, 14, c, { size: 7, bold: true }); });
        y += 14;
        [med.estandar0, med.estandar1].forEach((val, i) => { rect(doc, X + w2 * i, y, w2, 15); textoEnCaja(doc, X + w2 * i, y, w2, 15, texto(val), { size: 7.5 }); });
        y += 21;
    });

    if (y + 70 > doc.page.height - 80) { pie(doc, 'verif_equipos'); doc.addPage(); y = encabezado(doc, 'verif_equipos', X, 34, W, d.encabezado) + 14; }
    doc.font('Helvetica-Bold').fontSize(8).fillColor(NEGRO).text('OBSERVACIONES', X, y, { width: W });
    y += 12;
    const hObs = Math.max(30, doc.heightOfString(texto(v.observaciones) || ' ', { width: W - 10 }) + 10);
    rect(doc, X, y, W, hObs);
    textoEnCaja(doc, X, y, W, hObs, texto(v.observaciones), { size: 8, align: 'left', pad: 5, valign: 'top' });
    y += hObs + 8;
    bloqueFirma(doc, X, y, W, v, 'verif_equipos', d.encabezado);

    pie(doc, 'verif_equipos');
    doc.end();
    return listo;
};

// ─── OI-FoMa-03 · Muestreador automático ─────────────────────────────────────

/** @param d { encabezado, v: <fila de mae_ma_verif_mau con items ya parseado> } */
export const pdfVerifMau = (d = {}) => {
    const v = d.v || {};
    const { doc, listo } = nuevoDoc(`OI-FoMa-03 Muestreador automático ${v.folio_foma || ''}`.trim(), false, CARTA);
    const X = MARGEN_X;
    const W = doc.page.width - X * 2;
    let y = firmasControl(doc, X, encabezado(doc, 'verif_mau', X, 34, W, d.encabezado) + 5, W);
    y += 10;

    const wEt = W * 0.3;
    campoFila(doc, X, y, wEt, W - wEt, 'Fecha Verificación :', fechaCorta(v.fecha_verificacion, '-')); y += 18;
    campoFila(doc, X, y, wEt, W - wEt, 'Hora Verificación:', v.hora_verificacion); y += 18;
    campoFila(doc, X, y, wEt, W - wEt, 'Folio OI-FoMa-01', v.folio_foma); y += 18;
    campoFila(doc, X, y, wEt, W - wEt, 'Código Equipo :', v.codigo_equipo); y += 18;
    campoFila(doc, X, y, wEt, W - wEt, 'Cód. Sonda Caudal', v.codigo_sonda_caudal); y += 22;

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NEGRO).text('Error T°', X, y, { width: W });
    y += 12;
    const wErr = W / 3;
    [['Error 0,0', v.error_t0], ['Error 15,0', v.error_t15], ['Error 30,0', v.error_t30]].forEach(([et, val], i) => {
        rect(doc, X + wErr * i, y, wErr, 15);
        textoEnCaja(doc, X + wErr * i, y, wErr, 15, et, { size: 7.5, bold: true });
        rect(doc, X + wErr * i, y + 15, wErr, 15);
        textoEnCaja(doc, X + wErr * i, y + 15, wErr, 15, val === null || val === undefined ? '' : String(val), { size: 8.5 });
    });
    y += 36;

    doc.font('Helvetica').fontSize(7).text('Nota: Marcar con una x en el casillero que corresponda', X, y, { width: W });
    y += 12;
    for (const { grupo, items } of ITEMS_MAU) {
        if (y + 20 + items.length * 16 > doc.page.height - 80) { pie(doc, 'verif_mau'); doc.addPage(); y = encabezado(doc, 'verif_mau', X, 34, W, d.encabezado) + 14; }
        y = tablaItems(doc, X, y, W, items, v.items, { titulo: grupo });
        y += 4;
    }
    doc.font('Helvetica').fontSize(6.5).text(NOTA_NO_CUMPLE, X, y, { width: W });
    y += 14;

    if (y + 90 > doc.page.height - 80) { pie(doc, 'verif_mau'); doc.addPage(); y = encabezado(doc, 'verif_mau', X, 34, W, d.encabezado) + 14; }
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NEGRO).text('Verificación', X, y, { width: W });
    y += 12;
    const w3 = W / 3;
    const filaVerif = (etiquetas, valores) => {
        etiquetas.forEach((c, i) => { rect(doc, X + w3 * i, y, w3, 14); textoEnCaja(doc, X + w3 * i, y, w3, 14, c, { size: 7, bold: true }); });
        y += 14;
        valores.forEach((val, i) => { rect(doc, X + w3 * i, y, w3, 15); textoEnCaja(doc, X + w3 * i, y, w3, 15, texto(val), { size: 7.5 }); });
        y += 19;
    };
    const siNo = (b) => (b === true ? 'SI' : b === false ? 'NO' : '');
    filaVerif(['Nivel Real +/-5%', 'Nivel Equipo +/-5%', 'Acepta medición'], [v.nivel_real, v.nivel_equipo, siNo(v.acepta_nivel)]);
    filaVerif(['Volumen Obtenido', 'Volumen Real', 'Acepta medición'], [v.volumen_obtenido, v.volumen_real, siNo(v.acepta_volumen)]);
    const w2 = W / 2;
    ['Inicio', 'Término'].forEach((c, i) => { rect(doc, X + w2 * i, y, w2, 14); textoEnCaja(doc, X + w2 * i, y, w2, 14, c, { size: 7, bold: true }); });
    y += 14;
    [v.hora_inicio, v.hora_termino].forEach((val, i) => { rect(doc, X + w2 * i, y, w2, 15); textoEnCaja(doc, X + w2 * i, y, w2, 15, texto(val), { size: 7.5 }); });
    y += 21;

    doc.font('Helvetica-Bold').fontSize(8).text('Observaciones:', X, y, { width: W });
    y += 12;
    const hObs = Math.max(30, doc.heightOfString(texto(v.observaciones) || ' ', { width: W - 10 }) + 10);
    rect(doc, X, y, W, hObs);
    textoEnCaja(doc, X, y, W, hObs, texto(v.observaciones), { size: 8, align: 'left', pad: 5, valign: 'top' });
    y += hObs + 8;
    bloqueFirma(doc, X, y, W, v, 'verif_mau', d.encabezado);

    pie(doc, 'verif_mau');
    doc.end();
    return listo;
};

// ─── OI-FoMa-19 · Materiales y EPP ───────────────────────────────────────────

/** @param d { encabezado, v: <fila de mae_ma_lista_materiales con items ya parseado> } */
export const pdfListaMateriales = (d = {}) => {
    const v = d.v || {};
    const { doc, listo } = nuevoDoc(`OI-FoMa-19 Materiales y EPP ${v.folio_foma || ''}`.trim(), true, CARTA);
    const X = 50;
    const W = doc.page.width - X * 2;
    let y = firmasControl(doc, X, encabezado(doc, 'lista_materiales', X, 30, W, d.encabezado) + 5, W);
    y += 10;

    doc.font('Helvetica-Bold').fontSize(10).fillColor(NEGRO).text('Lista de chequeo materiales y EEPP', X, y, { width: W, align: 'center' });
    y += 18;

    const w4 = W / 4;
    [['Empresa:', v.empresa], ['Fecha:', fechaCorta(v.fecha, '-')], ['Nombre Muestreador:', v.muestreador], ['Lote de lavado de material:', v.lote_lavado]]
        .forEach(([et, val], i) => {
            rect(doc, X + w4 * i, y, w4, 28);
            doc.font('Helvetica-Bold').fontSize(7).fillColor(NEGRO).text(et, X + w4 * i + 4, y + 3, { width: w4 - 8, lineBreak: false });
            doc.font('Helvetica').fontSize(8).text(texto(val), X + w4 * i + 4, y + 14, { width: w4 - 8, lineBreak: false });
        });
    y += 34;

    doc.font('Helvetica-Bold').fontSize(7.5).text('Características de la muestra (indicar con x, en el casillero respectivo)', X, y, { width: W });
    y += 12;
    const wCar = W / CARACTERISTICAS.length;
    CARACTERISTICAS.forEach(([clave, etiqueta], i) => {
        const xx = X + wCar * i;
        rect(doc, xx, y, wCar, 18);
        casilla(doc, xx + 5, y + 4.5, v.caracteristica === clave);
        doc.font('Helvetica').fontSize(7.5).fillColor(NEGRO)
            .text(clave === 'OTROS' && v.caracteristica_otro ? `Otros: ${v.caracteristica_otro}` : etiqueta, xx + 18, y + 5.5, { width: wCar - 22, lineBreak: false });
    });
    y += 26;

    // Las tres columnas del formato, una al lado de la otra.
    const wCol = W / 3;
    const hItem = 15;
    const yTop = y;
    let yMax = y;
    ITEMS_MATERIALES.forEach(({ grupo, items }, col) => {
        const xx = X + wCol * col;
        let yy = yTop;
        rect(doc, xx, yy, wCol, 16);
        textoEnCaja(doc, xx, yy, wCol, 16, grupo, { size: 7.5, bold: true });
        yy += 16;
        for (const [clave, etiqueta] of items) {
            rect(doc, xx, yy, wCol, hItem);
            casilla(doc, xx + 4, yy + 3, !!v.items?.[clave], 8);
            doc.font('Helvetica').fontSize(7).fillColor(NEGRO).text(etiqueta, xx + 16, yy + 4, { width: wCol - 20, lineBreak: false });
            yy += hItem;
        }
        yMax = Math.max(yMax, yy);
    });
    y = yMax + 10;

    doc.font('Helvetica-Bold').fontSize(8).text('Observaciones:', X, y, { width: W });
    y += 12;
    const hObs = Math.max(26, doc.heightOfString(texto(v.observaciones) || ' ', { width: W - 10 }) + 10);
    rect(doc, X, y, W, hObs);
    textoEnCaja(doc, X, y, W, hObs, texto(v.observaciones), { size: 8, align: 'left', pad: 5, valign: 'top' });
    y += hObs + 8;
    bloqueFirma(doc, X, y, W, v, 'lista_materiales', d.encabezado);

    pie(doc, 'lista_materiales');
    doc.end();
    return listo;
};

export default { pdfVerifEquipos, pdfVerifMau, pdfListaMateriales };
