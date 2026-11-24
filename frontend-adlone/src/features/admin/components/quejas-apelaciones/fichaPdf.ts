import type { Caso } from '../../services/quejasApelaciones.service';
import { ETAPAS, PIE_FORMULARIO, fmtDay, fmtDateTime, yesNo } from './reglas';

/** Ficha PDF del caso con el formato del registro de Calidad (mismo contenido que la de ADLWeb). */
export async function exportarFichaPdf(c: Caso) {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const mark = (on: boolean) => (on ? '[X]' : '[  ]');
    const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    doc.setFillColor(2, 37, 102);
    doc.rect(0, 0, W, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text('ADL Diagnostic Chile — Gestión de Calidad', 40, 22);
    doc.setTextColor(2, 37, 102);
    doc.setFontSize(18);
    doc.text('QUEJAS Y APELACIONES', 40, 66);
    doc.setFontSize(12);
    doc.text(`N°: ${c.folio}`, W - 40, 66, { align: 'right' });
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`NCh-ISO/IEC 17025 cl. 7.9 · Estado: ${c.estadoLabel} · Generada el ${new Date().toLocaleString('es-CL')}`, 40, 82);

    const sectionTable = (title: string, rows: [string, string][], startY: number) => {
        autoTable(doc, {
            startY, theme: 'grid', styles: { fontSize: 9, cellPadding: 5, valign: 'top' },
            headStyles: { fillColor: [2, 37, 102] }, columnStyles: { 0: { cellWidth: 150, fontStyle: 'bold' } },
            head: [[title, '']], body: rows,
        });
        return finalY() + 14;
    };
    let y = sectionTable('Datos', [
        ['Tipo', `${mark(c.tipo === 'queja')} Queja    ${mark(c.tipo === 'apelacion')} Apelación`],
        ['Origen', `${mark(c.origen === 'interno')} Interno    ${mark(c.origen === 'externo')} Externo`],
        ['Empresa*', c.empresa], ['Nombre*', c.nombre], ['Mail de contacto*', c.correo], ['Fono de contacto*', c.telefono],
        ['Fecha recepción', fmtDay(c.fecha_recepcion)], ['Hora recepción', c.hora_recepcion], ['Fecha tratamiento', fmtDay(c.fecha_tratamiento)],
        ['N° de informe', c.numero_informe || '—'],
        ['Presentada por / vía de ingreso', `${c.emisorLabel || '—'} / ${c.via_ingreso || '—'}`],
        ['Ingreso', `${c.canalLabel}${c.creado_por ? ` (${c.creado_por})` : ''}`],
    ], 96);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('(*): Ítems obligatorios', 40, y - 4);
    y = sectionTable('Motivo de la queja o apelación', [['Motivo', c.motivo]], y + 6);
    y = sectionTable('Evaluación', [
        ['¿Relacionada con actividades?', yesNo(c.relacionada_actividades)], ['¿Procede?', yesNo(c.procede)],
        ...(c.tipo === 'apelacion' ? [['Reunión de análisis', `${fmtDay(c.reunion_fecha)} · ${c.reunion_asistentes || '—'}${c.reunion_directrices ? `\nDirectrices: ${c.reunion_directrices}` : ''}`] as [string, string]] : []),
        ['Causa', c.causa || '—'], ['Requisito afectado', c.requisito || '—'], ['Jefe de área que investiga', c.jefe_area || '—'],
        ['Fundamento', c.evaluacion || '—'], ['Responsable', `${c.responsable || '—'}${c.responsable_independiente ? ' (no participó en la actividad)' : ''}`],
        ['Trabajo no conforme / auditoría', `${yesNo(c.requiere_tnc)} / ${yesNo(c.requiere_auditoria)}`],
        ['Fecha de evaluación', fmtDay(c.fecha_evaluacion)],
    ], y);
    y = sectionTable('Tratamiento', [
        ['Análisis de causa', c.analisis_causa || '—'],
        ['Acciones correctivas (OI-FoGe-02)', c.acciones.length ? c.acciones.map((a) => `${a.folio} · ${a.estadoLabel} · ${a.responsable || '—'} · plazo ${fmtDay(a.plazo)}`).join('\n') : '—'],
        ['Otras acciones correctivas', c.acciones_correctivas || '—'],
        ['Acciones preventivas', c.acciones_preventivas || '—'], ['Tratamiento', c.tratamiento || '—'],
    ], y);
    y = sectionTable('Conclusiones', [['Conclusiones', c.conclusiones || '—']], y);
    y = sectionTable('Participantes', [['Participantes', c.participantes || '—']], y);
    y = sectionTable('Resolución', [
        ['Aprobada por', c.aprobado_por || '—'], ['Respuesta formal', c.respuesta_formal || '—'],
        ['Cierre', c.cerrado_en ? `${fmtDateTime(c.cerrado_en)}${c.cerrado_por ? ` · ${c.cerrado_por}` : ''}` : '—'],
        ['Verificación de eficacia', c.eficacia || '—'],
    ], y);
    autoTable(doc, {
        startY: y, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 5, valign: 'top' },
        headStyles: { fillColor: [2, 37, 102] }, columnStyles: { 0: { cellWidth: 95, fontStyle: 'bold' }, 2: { cellWidth: 60 }, 3: { cellWidth: 95 } },
        head: [['Notificaciones', 'Notificado a', 'Fecha', 'Vía de notificación', 'OBS']],
        body: ETAPAS.flatMap((et) => {
            const items = c.notificaciones.filter((n) => n.etapa === et.value);
            return items.length
                ? items.map((n) => [et.label, n.notificado_a, fmtDay(n.fecha), n.via, n.observaciones || ''])
                : [[et.label, '—', '', '', '']];
        }),
    });
    y = finalY() + 60;
    if (y > H - 80) { doc.addPage(); y = 100; }
    doc.setDrawColor(148, 163, 184);
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.line(60, y, 250, y); doc.text('Responsable del caso', 155, y + 12, { align: 'center' });
    doc.line(W - 250, y, W - 60, y); doc.text('Aprobación (Gestión de Calidad)', W - 155, y + 12, { align: 'center' });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i += 1) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(PIE_FORMULARIO, 40, H - 22);
        doc.text(`${c.folio} · Página ${i} de ${pages}`, W - 40, H - 22, { align: 'right' });
    }
    doc.save(`${c.folio}.pdf`);
}
