import { nuevoDoc, rect, textoEnCaja, encabezado, pie, fechaCorta, texto, NEGRO, imagenFirma, dibujarFirma } from './fichasEquipo.pdf.js';

// PDF de los formularios de G. Calidad → Calidad, con el mismo encabezado oficial que las fichas de equipo
// (logo, «FORMULARIO GENERAL DE GESTIÓN», versión y fechas de Revisión documental) y el pie de documento controlado.
//   OI-FoGe-06  Listado de Quejas y Apelaciones (Internas y Externas)
// Los de auditorías internas (07, 08, 09, 10, 11) y la acción correctiva (02) se agregan aquí.

const MARGEN_X = 40;
const MARGEN_INF = 80; // espacio del pie de documento controlado

/**
 * Tabla que continúa en hojas nuevas: repite el encabezado del formulario y la fila de títulos.
 * `nuevaHoja(doc)` dibuja lo de arriba de la hoja y devuelve la y donde empieza la tabla.
 */
const tablaPaginada = (doc, { columnas, filas, nuevaHoja, minFilas = 0, size = 8, altoMin = 18, formato }) => {
    const X = MARGEN_X;
    const W = doc.page.width - MARGEN_X * 2;
    const anchos = columnas.map((c) => c.ancho * W);
    const titulos = (y) => {
        let x = X;
        const h = 20;
        columnas.forEach((c, i) => {
            doc.save().rect(x, y, anchos[i], h).fillColor('#e8e8e8').fill().restore();
            rect(doc, x, y, anchos[i], h);
            textoEnCaja(doc, x, y, anchos[i], h, c.titulo, { size: 8.5, bold: true });
            x += anchos[i];
        });
        return y + h;
    };
    let y = titulos(nuevaHoja(doc));
    const lista = [...filas];
    while (lista.length < minFilas) lista.push(null);
    for (const fila of lista) {
        const valores = fila ? columnas.map((c) => texto(c.valor(fila))) : columnas.map(() => '');
        doc.font('Helvetica').fontSize(size);
        const alto = Math.max(altoMin, ...valores.map((v, i) => (v ? doc.heightOfString(v, { width: anchos[i] - 8, lineGap: 0.5 }) + 8 : 0)));
        if (y + alto > doc.page.height - MARGEN_INF) {
            pie(doc, formato);
            doc.addPage();
            y = titulos(nuevaHoja(doc));
        }
        let x = X;
        valores.forEach((v, i) => {
            rect(doc, x, y, anchos[i], alto);
            textoEnCaja(doc, x, y, anchos[i], alto, v, { size, align: columnas[i].align || 'left', valign: 'top' });
            x += anchos[i];
        });
        y += alto;
    }
    pie(doc, formato);
    return y;
};

// ─── OI-FoGe-06 · Listado de Quejas y Apelaciones ───────────────────────────

/**
 * @param d {
 *   encabezado, anio, filtro (texto opcional bajo el título),
 *   filas: [{ fecha_recepcion, folio, tipo: 'queja'|'apelacion', empresa, nombre, motivo, origen: 'interno'|'externo', estadoLabel }]
 * }
 */
export const pdfListadoQa = (d = {}) => {
    const { doc, listo } = nuevoDoc(`OI-FoGe-06 Listado de Quejas y Apelaciones ${d.anio || ''}`.trim());
    const W = doc.page.width - MARGEN_X * 2;
    const nuevaHoja = () => {
        let y = encabezado(doc, 'listado_qa', MARGEN_X, 36, W, d.encabezado);
        y += 18;
        doc.font('Helvetica-Bold').fontSize(11).fillColor(NEGRO)
            .text('Listado de Quejas y Apelaciones (Internas y Externas)', MARGEN_X, y, { width: W, align: 'center' });
        y += 16;
        if (d.filtro) {
            doc.font('Helvetica').fontSize(8.5).text(d.filtro, MARGEN_X, y, { width: W, align: 'center' });
            y += 12;
        }
        return y + 8;
    };
    const reclamo = (f) => {
        const quien = [f.empresa, f.nombre].filter(Boolean).join(' – ');
        const cabeza = [f.folio, f.tipo === 'apelacion' ? 'Apelación' : 'Queja', quien].filter(Boolean).join(' · ');
        const motivo = texto(f.motivo).replace(/\s+/g, ' ');
        return `${cabeza}${motivo ? `\n${motivo.length > 600 ? `${motivo.slice(0, 600)}…` : motivo}` : ''}${f.estadoLabel ? `\n[${f.estadoLabel}]` : ''}`;
    };
    tablaPaginada(doc, {
        formato: 'listado_qa',
        nuevaHoja,
        minFilas: 18,
        columnas: [
            { titulo: 'Fecha', ancho: 0.14, align: 'center', valor: (f) => fechaCorta(f.fecha_recepcion) },
            { titulo: 'Reclamo', ancho: 0.70, valor: reclamo },
            { titulo: 'Origen', ancho: 0.16, align: 'center', valor: (f) => (f.origen === 'interno' ? 'Interno' : f.origen === 'externo' ? 'Externo' : texto(f.origen)) },
        ],
        filas: d.filas || [],
    });
    doc.end();
    return listo;
};

// ─── OI-FoGe-07 · Programa Anual de Auditorías Internas ─────────────────────

const MESES_LETRA = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * @param d {
 *   encabezado, anio, fecha_actualizacion, observaciones,
 *   filas: [{ referencia, nombre, meses: { [mes]: { estado, id_auditoria } } }]
 * }
 */
export const pdfPrograma = (d = {}) => {
    const { doc, listo } = nuevoDoc(`OI-FoGe-07 Programa de Auditorías Internas ${d.anio || ''}`.trim(), true);
    const X = 36;
    const W = doc.page.width - 72;
    let y = encabezado(doc, 'programa', X, 30, W, d.encabezado);
    y += 14;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NEGRO)
        .text(`Programa de Auditorías Internas Año ${d.anio || ''}`, X, y, { width: W * 0.7 });
    doc.font('Helvetica').fontSize(8)
        .text(`Fecha actualización: ${d.fecha_actualizacion ? fechaCorta(d.fecha_actualizacion, '/') : ''}`, X + W * 0.7, y + 2, { width: W * 0.3, align: 'right' });
    y += 20;

    const wRef = W * 0.06;
    const wElem = W * 0.38;
    const wMes = (W - wRef - wElem) / 12;
    const hFila = 15;

    // Cabeceras: "Ref. ISO17020" / "Elemento del Sistema de Calidad a ser Auditado" / letras de los meses.
    rect(doc, X, y, wRef, hFila * 2);
    textoEnCaja(doc, X, y, wRef, hFila * 2, 'Ref.\nISO17020', { size: 6.5, bold: true });
    rect(doc, X + wRef, y, wElem, hFila * 2);
    textoEnCaja(doc, X + wRef, y, wElem, hFila * 2, 'Elemento del Sistema de Calidad a ser Auditado', { size: 7, bold: true });
    rect(doc, X + wRef + wElem, y, wMes * 12, hFila);
    textoEnCaja(doc, X + wRef + wElem, y, wMes * 12, hFila, '', { size: 7 });
    MESES_LETRA.forEach((m, i) => {
        rect(doc, X + wRef + wElem + wMes * i, y + hFila, wMes, hFila);
        textoEnCaja(doc, X + wRef + wElem + wMes * i, y + hFila, wMes, hFila, m, { size: 7.5, bold: true });
    });
    y += hFila * 2;

    const COLOR_ESTADO = { REALIZADA: '#2e7d32', REPROGRAMADA: '#b8860b', CANCELADA: '#999' };
    for (const f of d.filas || []) {
        if (y + hFila > doc.page.height - 72) { pie(doc, 'programa'); doc.addPage(); y = encabezado(doc, 'programa', X, 30, W, d.encabezado) + 10; }
        rect(doc, X, y, wRef, hFila);
        textoEnCaja(doc, X, y, wRef, hFila, f.referencia || '', { size: 7 });
        rect(doc, X + wRef, y, wElem, hFila);
        textoEnCaja(doc, X + wRef, y, wElem, hFila, f.nombre || '', { size: 7.5, align: 'left', pad: 4 });
        for (let m = 1; m <= 12; m++) {
            const xx = X + wRef + wElem + wMes * (m - 1);
            rect(doc, xx, y, wMes, hFila);
            const marca = f.meses?.[m];
            if (marca) {
                const color = COLOR_ESTADO[marca.estado] || NEGRO;
                textoEnCaja(doc, xx, y, wMes, hFila, 'X', { size: 8, bold: true, color });
            }
        }
        y += hFila;
    }
    if (d.observaciones) {
        y += 8;
        doc.font('Helvetica').fontSize(7.5).fillColor(NEGRO).text(`Observaciones: ${d.observaciones}`, X, y, { width: W });
    }

    // Sección de firmas
    y += 20;
    const wFirma = W / 3;
    const hEncabezado = 18;
    const hFirma = 50;

    // Encabezados: Elaborado, Revisado, Aprobado
    for (let i = 0; i < 3; i++) {
        rect(doc, X + wFirma * i, y, wFirma, hEncabezado);
        const labels = ['Elaborado por:', 'Revisado por:', 'Aprobado por:'];
        textoEnCaja(doc, X + wFirma * i, y, wFirma, hEncabezado, labels[i], { size: 8.5, bold: true, align: 'center' });
    }
    y += hEncabezado;

    // Área de firmas (vacía para firmar)
    for (let i = 0; i < 3; i++) {
        rect(doc, X + wFirma * i, y, wFirma, hFirma);
        textoEnCaja(doc, X + wFirma * i, y, wFirma, hFirma, 'Firma:', { size: 7, align: 'left', pad: 4 });
    }

    pie(doc, 'programa');
    doc.end();
    return listo;
};

// ─── OI-FoGe-08 · Plan de Auditoría Interna ─────────────────────────────────

/** @param d { encabezado, auditoria: { folio, fecha, objetivos, alcance, auditor_lider }, agenda: [{horario,area,criterio,auditor,observacion}] } */
export const pdfPlan = (d = {}) => {
    const { doc, listo } = nuevoDoc(`OI-FoGe-08 Plan de Auditoría ${d.auditoria?.folio || ''}`.trim());
    const X = MARGEN_X;
    const W = doc.page.width - MARGEN_X * 2;
    const a = d.auditoria || {};
    let y = encabezado(doc, 'plan', X, 36, W, d.encabezado);
    y += 16;
    doc.font('Helvetica-Bold').fontSize(11).text('PLAN DE AUDITORIA INTERNA', X, y, { width: W, align: 'center' });
    y += 20;

    const campo = (etiqueta, valor, alto = 24) => {
        rect(doc, X, y, W * 0.22, alto);
        textoEnCaja(doc, X, y, W * 0.22, alto, etiqueta, { size: 8.5, bold: true, align: 'left', pad: 6 });
        rect(doc, X + W * 0.22, y, W * 0.78, alto);
        textoEnCaja(doc, X + W * 0.22, y, W * 0.78, alto, texto(valor), { size: 8.5, align: 'left', pad: 6 });
        y += alto;
    };
    campo('Fecha', fechaCorta(a.fecha, '-'));
    campo('Objetivos', a.objetivos, Math.max(24, doc.heightOfString(texto(a.objetivos) || ' ', { width: W * 0.78 - 12 }) + 10));
    campo('Alcance', a.alcance, Math.max(24, doc.heightOfString(texto(a.alcance) || ' ', { width: W * 0.78 - 12 }) + 10));
    campo('Auditor', a.auditor_lider);
    y += 14;

    tablaPaginada(doc, {
        formato: 'plan',
        nuevaHoja: () => y,
        columnas: [
            { titulo: 'Horario', ancho: 0.11, align: 'center', valor: (f) => f.horario },
            { titulo: 'Área', ancho: 0.20, valor: (f) => f.area },
            { titulo: 'Criterio', ancho: 0.33, valor: (f) => f.criterio },
            { titulo: 'Auditor', ancho: 0.18, valor: (f) => f.auditor },
            { titulo: 'Observación', ancho: 0.18, valor: (f) => f.observacion },
        ],
        filas: d.agenda || [],
        minFilas: 4,
    });
    doc.end();
    return listo;
};

// ─── OI-FoGe-10 · Reunión Inicial y Final Auditoría ─────────────────────────

/** @param d { encabezado, auditoria: {fecha, fecha_reunion_inicial, fecha_reunion_final}, inicial: [{nombre,firma}], final: [{nombre,firma}] } */
export const pdfReunion = (d = {}) => {
    const { doc, listo } = nuevoDoc('OI-FoGe-10 Reunión Inicial y Final');
    const X = MARGEN_X;
    const W = doc.page.width - MARGEN_X * 2;
    const a = d.auditoria || {};
    let y = encabezado(doc, 'reunion', X, 36, W, d.encabezado);
    y += 14;
    const wFecha = W / 2;
    rect(doc, X, y, wFecha, 18);
    textoEnCaja(doc, X, y, wFecha, 18, `Fecha Auditoría: ${fechaCorta(a.fecha, '-')}`, { size: 8.5, bold: true, align: 'left', pad: 6 });
    rect(doc, X + wFecha, y, wFecha, 18);
    textoEnCaja(doc, X + wFecha, y, wFecha, 18, '', { size: 8.5 });
    y += 18;

    const wMitad = W / 2;
    const hCab = 18;
    rect(doc, X, y, wMitad, hCab);
    textoEnCaja(doc, X, y, wMitad, hCab, `Reunión Inicial${a.fecha_reunion_inicial ? ` (${fechaCorta(a.fecha_reunion_inicial, '-')})` : ''}`, { size: 9, bold: true });
    rect(doc, X + wMitad, y, wMitad, hCab);
    textoEnCaja(doc, X + wMitad, y, wMitad, hCab, `Reunión Final${a.fecha_reunion_final ? ` (${fechaCorta(a.fecha_reunion_final, '-')})` : ''}`, { size: 9, bold: true });
    y += hCab;

    const wNombre = wMitad * 0.6;
    const wFirma = wMitad * 0.4;
    const hSub = 16;
    [0, 1].forEach((i) => {
        const xx = X + wMitad * i;
        rect(doc, xx, y, wNombre, hSub);
        textoEnCaja(doc, xx, y, wNombre, hSub, 'Nombre', { size: 8, bold: true });
        rect(doc, xx + wNombre, y, wFirma, hSub);
        textoEnCaja(doc, xx + wNombre, y, wFirma, hSub, 'Firma', { size: 8, bold: true });
    });
    y += hSub;

    const filas = Math.max((d.inicial || []).length, (d.final || []).length, 10);
    const hFila = 26;
    for (let i = 0; i < filas; i++) {
        if (y + hFila > doc.page.height - 80) { pie(doc, 'reunion'); doc.addPage(); y = encabezado(doc, 'reunion', X, 36, W, d.encabezado) + 10; }
        const pi = (d.inicial || [])[i];
        const pf = (d.final || [])[i];
        [[pi, 0], [pf, 1]].forEach(([p, col]) => {
            const xx = X + wMitad * col;
            rect(doc, xx, y, wNombre, hFila);
            textoEnCaja(doc, xx, y, wNombre, hFila, p?.nombre || '', { size: 8, align: 'left', pad: 4 });
            rect(doc, xx + wNombre, y, wFirma, hFila);
            const img = imagenFirma(p?.firma);
            if (img) dibujarFirma(doc, img, xx + wNombre + 3, y + 2, wFirma - 6, hFila - 4);
        });
        y += hFila;
    }
    pie(doc, 'reunion');
    doc.end();
    return listo;
};

// ─── OI-FoGe-09 · Hallazgos de Auditoría ────────────────────────────────────

/** @param d { encabezado, hojas: [{area,auditor,fecha,observaciones_oportunidades,hallazgos:[{requisito,que_verificar,evidencia,resultado,observaciones}]}] } */
export const pdfHallazgos = (d = {}) => {
    const { doc, listo } = nuevoDoc('OI-FoGe-09 Hallazgos de Auditoría');
    const X = MARGEN_X;
    const W = doc.page.width - MARGEN_X * 2;
    const hojas = d.hojas?.length ? d.hojas : [{}];
    hojas.forEach((h, i) => {
        if (i > 0) { pie(doc, 'hallazgos'); doc.addPage(); }
        let y = encabezado(doc, 'hallazgos', X, 36, W, d.encabezado);
        y += 14;
        doc.font('Helvetica-Bold').fontSize(10.5).text('HALLAZGOS DE AUDITORIA', X, y, { width: W, align: 'center' });
        y += 18;
        const campo = (etiqueta, valor, w) => {
            rect(doc, X + (w.x || 0), y, w.et, 18);
            textoEnCaja(doc, X + (w.x || 0), y, w.et, 18, etiqueta, { size: 8, bold: true, align: 'left', pad: 5 });
            rect(doc, X + (w.x || 0) + w.et, y, w.val, 18);
            textoEnCaja(doc, X + (w.x || 0) + w.et, y, w.val, 18, texto(valor), { size: 8.5, align: 'left', pad: 5 });
        };
        campo('Área / Proceso', h.area, { et: W * 0.16, val: W * 0.84 });
        y += 18;
        campo('Nombre Auditor', h.auditor, { et: W * 0.16, val: W * 0.34 });
        campo('Fecha Auditoría', fechaCorta(h.fecha, '-'), { x: W * 0.5, et: W * 0.16, val: W * 0.34 });
        y += 24;

        let primeraPagina = true;
        const nuevaHoja = () => {
            if (primeraPagina) { primeraPagina = false; return y; }
            const y2 = encabezado(doc, 'hallazgos', X, 36, W, d.encabezado) + 10;
            doc.font('Helvetica-Bold').fontSize(9).text(`${h.area || ''} (continuación)`, X, y2, { width: W });
            return y2 + 16;
        };
        y = tablaPaginada(doc, {
            formato: 'hallazgos',
            nuevaHoja,
            columnas: [
                { titulo: 'Requisito a auditar', ancho: 0.22, valor: (f) => f.requisito },
                { titulo: 'Qué verificar', ancho: 0.24, valor: (f) => f.que_verificar },
                { titulo: 'Evidencia Objetiva', ancho: 0.30, valor: (f) => f.evidencia },
                { titulo: 'C', ancho: 0.08, align: 'center', valor: (f) => (f.resultado === 'C' ? 'X' : '') },
                { titulo: 'NC', ancho: 0.08, align: 'center', valor: (f) => (f.resultado === 'NC' ? 'X' : '') },
                { titulo: 'OBS', ancho: 0.08, align: 'center', valor: (f) => (f.resultado === 'OBS' ? 'X' : '') },
            ],
            filas: h.hallazgos || [],
            minFilas: 5,
        });
        y += 10;
        doc.font('Helvetica-Bold').fontSize(8.5).text('Observaciones y Oportunidades:', X, y, { width: W });
        y += 12;
        doc.font('Helvetica').fontSize(8.5).text(texto(h.observaciones_oportunidades) || ' ', X, y, { width: W });
    });
    pie(doc, 'hallazgos');
    doc.end();
    return listo;
};

// ─── OI-FoGe-11 · Informe de Auditoría Interna ──────────────────────────────

/**
 * @param d {
 *   encabezado, auditoria: { folio, fecha, fecha_informe, objetivos, alcance, auditor_lider, representante_auditado,
 *     documentos_referencia, entrevistados, descripcion_hallazgos, juicio_auditor, capacidad_sistema, oportunidades,
 *     distribucion, firma_auditor_lider },
 *   noConformidades: [{ numero, area, descripcion, referencia, auditor }],
 *   observacionesAuditoria: [{ numero, area, descripcion, auditor }],
 * }
 */
export const pdfInforme = (d = {}) => {
    const { doc, listo } = nuevoDoc(`OI-FoGe-11 Informe de Auditoría ${d.auditoria?.folio || ''}`.trim());
    const X = MARGEN_X;
    const W = doc.page.width - MARGEN_X * 2;
    const a = d.auditoria || {};
    let y = encabezado(doc, 'informe', X, 36, W, d.encabezado);
    y += 16;
    doc.font('Helvetica-Bold').fontSize(11).text('INFORME DE AUDITORIA INTERNA', X, y, { width: W, align: 'center' });
    y += 20;

    const campo = (etiqueta, valor, wEt = 0.3) => {
        doc.font('Helvetica-Bold').fontSize(8.5);
        const altoEt = doc.heightOfString(etiqueta, { width: W * wEt - 12 }) + 12;
        doc.font('Helvetica').fontSize(8.5);
        const altoVal = doc.heightOfString(texto(valor) || ' ', { width: W * (1 - wEt) - 12 }) + 12;
        const alto = Math.max(18, altoEt, altoVal);
        rect(doc, X, y, W * wEt, alto);
        textoEnCaja(doc, X, y, W * wEt, alto, etiqueta, { size: 8.5, bold: true, align: 'left', pad: 6 });
        rect(doc, X + W * wEt, y, W * (1 - wEt), alto);
        textoEnCaja(doc, X + W * wEt, y, W * (1 - wEt), alto, texto(valor), { size: 8.5, align: 'left', pad: 6 });
        y += alto;
    };
    campo('Fecha de la auditoria', fechaCorta(a.fecha, '-'));
    campo('Objetivo de la auditoria', a.objetivos);
    campo('Alcance de la auditoria', a.alcance);
    campo('Identificación Auditor / Equipo Auditor', a.auditor_lider);
    campo('Identificación del representante del auditado', a.representante_auditado);
    campo('Documentos de referencia', a.documentos_referencia);
    campo('Listado de personas entrevistadas', a.entrevistados);
    campo('Descripción de los hallazgos', a.descripcion_hallazgos);
    campo('Juicio del auditor de la extensión del cumplimiento del auditado con la norma y documentación pertinente', a.juicio_auditor);
    campo('Capacidad del sistema para lograr los objetivos de la calidad definidos', a.capacidad_sistema);
    campo('Oportunidades / Fortalezas del Sistema de Gestión', a.oportunidades);
    campo('Distribución del informe', a.distribucion);
    campo('Fecha del informe', fechaCorta(a.fecha_informe, '-'));
    y += 8;
    const img = imagenFirma(a.firma_auditor_lider);
    rect(doc, X, y, W, 50);
    if (img) dibujarFirma(doc, img, X + W / 2 - 60, y + 2, 120, 36);
    textoEnCaja(doc, X, y + 40, W, 10, 'Firma auditor líder', { size: 8 });
    y += 58;

    const tabla = (titulo, filas, columnas) => {
        if (y + 40 > doc.page.height - 44) { pie(doc, 'informe'); doc.addPage(); y = encabezado(doc, 'informe', X, 36, W, d.encabezado) + 14; }
        doc.font('Helvetica-Bold').fontSize(10).text(titulo, X, y, { width: W });
        y += 16;
        let primera = true;
        const nuevaHoja = () => {
            if (primera) { primera = false; return y; }
            const y2 = encabezado(doc, 'informe', X, 36, W, d.encabezado) + 10;
            doc.font('Helvetica-Bold').fontSize(9).text(`${titulo} (continuación)`, X, y2, { width: W });
            return y2 + 16;
        };
        y = tablaPaginada(doc, { formato: 'informe', nuevaHoja, columnas, filas, minFilas: filas.length ? 0 : 2 });
        y += 10;
    };
    tabla('ANEXO 1. CUADRO RESUMEN DE NO CONFORMIDADES', d.noConformidades || [], [
        { titulo: 'N°', ancho: 0.06, align: 'center', valor: (f) => f.numero },
        { titulo: 'Área en que se detecta', ancho: 0.22, valor: (f) => f.area },
        { titulo: 'Descripción de la no conformidad', ancho: 0.42, valor: (f) => f.descripcion },
        { titulo: 'Referencia Normativa', ancho: 0.15, valor: (f) => f.referencia },
        { titulo: 'Auditor que detecta', ancho: 0.15, valor: (f) => f.auditor },
    ]);
    tabla('ANEXO 2. CUADRO RESUMEN DE OBSERVACIONES', d.observacionesAuditoria || [], [
        { titulo: 'N°', ancho: 0.06, align: 'center', valor: (f) => f.numero },
        { titulo: 'Área en que se detecta', ancho: 0.27, valor: (f) => f.area },
        { titulo: 'Descripción de la observación', ancho: 0.49, valor: (f) => f.descripcion },
        { titulo: 'Auditor que detecta', ancho: 0.18, valor: (f) => f.auditor },
    ]);
    pie(doc, 'informe');
    doc.end();
    return listo;
};

// ─── OI-FoGe-02 · Acción Correctiva ──────────────────────────────────────────

const ORIGEN_LABEL = {
    AUDITORIA_INTERNA: 'Auditoría Interna', AUDITORIA_EXTERNA_2: 'Auditoría Externa (2ª Parte)', AUDITORIA_EXTERNA_3: 'Auditoría Externa (3ª Parte)',
    QUEJA: 'Queja', APELACION: 'Apelación', REVISION_GERENCIA: 'Revisiones de Gerencia', AUTODETECTADA: 'Autodetectada',
};
const siNo = (v) => (v === true ? 'SI' : v === false ? 'NO' : '');

/** @param d { encabezado, ac: <fila de mae_gc_accion_correctiva, con seguimientos ya parseado como array> } */
export const pdfAccionCorrectiva = (d = {}) => {
    const a = d.ac || {};
    const { doc, listo } = nuevoDoc(`OI-FoGe-02 Acción Correctiva ${a.folio || ''}`.trim());
    const X = MARGEN_X;
    const W = doc.page.width - MARGEN_X * 2;
    let y = encabezado(doc, 'accion', X, 36, W, d.encabezado);
    y += 14;
    rect(doc, X, y, W * 0.7, 18);
    textoEnCaja(doc, X, y, W * 0.7, 18, 'ACCIÓN CORRECTIVA', { size: 10.5, bold: true, align: 'left', pad: 6 });
    rect(doc, X + W * 0.7, y, W * 0.3, 18);
    textoEnCaja(doc, X + W * 0.7, y, W * 0.3, 18, `N°: ${a.folio || ''}`, { size: 9, bold: true });
    y += 18;

    const fila = (pares, alto = 18) => {
        const w = W / pares.length;
        pares.forEach((p, i) => {
            rect(doc, X + w * i, y, w, alto);
            textoEnCaja(doc, X + w * i, y, w, alto, '', { size: 8 });
            doc.font('Helvetica-Bold').fontSize(7.5).text(p.et, X + w * i + 4, y + 2, { width: w - 8, lineBreak: false });
            doc.font('Helvetica').fontSize(8).text(texto(p.val), X + w * i + 4, y + 11, { width: w - 8, lineGap: 0 });
        });
        y += alto;
    };
    fila([{ et: 'Origen', val: a.origen === 'OTRO' ? (a.origen_otro || 'Otro') : ORIGEN_LABEL[a.origen] || a.origen }, { et: 'Área en que se detecta', val: a.area }]);
    fila([{ et: 'Fecha de Detección', val: fechaCorta(a.fecha_deteccion, '-') }, { et: 'Fecha inicio Tratamiento', val: fechaCorta(a.fecha_inicio, '-') }]);
    fila([{ et: 'Nombre y Cargo persona que detecta', val: a.detectado_por }, { et: 'Requisito afectado', val: a.requisito }]);
    y += 8;

    const bloque = (titulo, pares) => {
        if (y + 30 > doc.page.height - 70) { pie(doc, 'accion'); doc.addPage(); y = encabezado(doc, 'accion', X, 36, W, d.encabezado) + 14; }
        doc.font('Helvetica-Bold').fontSize(9.5).text(titulo, X, y, { width: W });
        y += 14;
        for (const [et, val, esSiNo] of pares) {
            const txt = esSiNo ? siNo(val) : texto(val);
            const alto = Math.max(16, doc.heightOfString(txt || ' ', { width: W * 0.68 - 10 }) + 8);
            if (y + alto > doc.page.height - 70) { pie(doc, 'accion'); doc.addPage(); y = encabezado(doc, 'accion', X, 36, W, d.encabezado) + 14; }
            rect(doc, X, y, W * 0.32, alto);
            textoEnCaja(doc, X, y, W * 0.32, alto, et, { size: 8, bold: true, align: 'left', pad: 5 });
            rect(doc, X + W * 0.32, y, W * 0.68, alto);
            textoEnCaja(doc, X + W * 0.32, y, W * 0.68, alto, txt, { size: 8.5, align: 'left', pad: 5 });
            y += alto;
        }
        y += 10;
    };

    bloque('SECCIÓN I: Descripción de la No Conformidad', [
        ['Descripción del hallazgo encontrado', a.hallazgo], ['Justificación de por qué es una No Conformidad', a.justificacion],
        ['Corrección Inmediata', a.correccion_inmediata], ['¿Procede una acción correctiva?', a.procede_ac, true],
    ]);
    bloque('SECCIÓN II: Análisis de la Causa', [
        ['Participantes', a.participantes], ['Técnica utilizada', a.tecnica], ['Alcance de la No Conformidad (Detalle)', a.alcance],
    ]);
    bloque('SECCIÓN III: Acción Correctiva Propuesta', [
        ['Acción propuesta', a.accion_propuesta], ['Responsable de implementación', a.responsable],
        ['Plazo de Implementación', fechaCorta(a.plazo, '-')], ['Fecha de seguimiento', fechaCorta(a.fecha_seguimiento, '-')],
        ['Cumplimiento plazo implementación', a.cumplimiento_plazo, true], ['Observaciones', a.observaciones],
    ]);

    if (y + 30 > doc.page.height - 70) { pie(doc, 'accion'); doc.addPage(); y = encabezado(doc, 'accion', X, 36, W, d.encabezado) + 14; }
    doc.font('Helvetica-Bold').fontSize(9.5).text('SECCIÓN IV: Seguimiento', X, y, { width: W });
    y += 14;
    const NOMBRES_SEG = ['Primer Seguimiento', 'Segundo Seguimiento', 'Tercer Seguimiento'];
    NOMBRES_SEG.forEach((nombre, i) => {
        const s = (a.seguimientos || [])[i] || {};
        if (y + 56 > doc.page.height - 70) { pie(doc, 'accion'); doc.addPage(); y = encabezado(doc, 'accion', X, 36, W, d.encabezado) + 14; }
        rect(doc, X, y, W, 14);
        textoEnCaja(doc, X, y, W, 14, nombre, { size: 8, bold: true });
        y += 14;
        fila([{ et: 'Fecha', val: fechaCorta(s.fecha, '-') }, { et: 'Cumplimiento', val: s.cumplimiento }, { et: 'Responsable', val: s.responsable }], 16);
        const altoObs = Math.max(16, doc.heightOfString(texto(s.observaciones) || ' ', { width: W - 10 }) + 8);
        rect(doc, X, y, W, altoObs);
        textoEnCaja(doc, X, y, W, altoObs, s.observaciones ? `Observaciones: ${s.observaciones}` : 'Observaciones:', { size: 8, align: 'left', pad: 5 });
        y += altoObs;
    });
    y += 6;
    bloque('Comprobación de la eficacia', [
        ['Describa la evidencia observada con la que comprueba la eficacia', a.eficacia], ['¿La causa fue eliminada?', a.causa_eliminada, true],
        ['Se levanta NC', a.se_levanta_nc, true], ['Observaciones y comentarios', a.observaciones_finales],
    ]);

    if (y + 50 > doc.page.height - 70) { pie(doc, 'accion'); doc.addPage(); y = encabezado(doc, 'accion', X, 36, W, d.encabezado) + 14; }
    fila([{ et: 'Nombre', val: a.cierre_nombre }, { et: 'Fecha', val: fechaCorta(a.cierre_fecha, '-') }, { et: 'Firma', val: '' }], 40);
    const img = imagenFirma(a.cierre_firma);
    if (img) dibujarFirma(doc, img, X + (W / 3) * 2 + 4, y - 38, W / 3 - 8, 34);

    pie(doc, 'accion');
    doc.end();
    return listo;
};

export default { pdfListadoQa, pdfPrograma, pdfPlan, pdfReunion, pdfHallazgos, pdfInforme, pdfAccionCorrectiva };
