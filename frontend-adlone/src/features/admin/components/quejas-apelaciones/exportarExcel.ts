import type { CasoRow, Stats } from '../../services/quejasApelaciones.service';
import { MESES, fmtDay, today, yesNo } from './reglas';

// Exportación a Excel (.xlsx) de Quejas y apelaciones. exceljs se carga solo al exportar.
type Celda = string | number | null | undefined;
interface Hoja { nombre: string; titulo?: string; columnas: { header: string; width?: number }[]; filas: Celda[][] }

async function descargarLibro(hojas: Hoja[], archivo: string) {
    const { default: ExcelJS } = await import('exceljs');
    const libro = new ExcelJS.Workbook();
    libro.creator = 'ADL ONE · Gestión de Calidad';
    libro.created = new Date();
    for (const h of hojas) {
        const ws = libro.addWorksheet(h.nombre.slice(0, 31));
        let fila = 1;
        if (h.titulo) {
            ws.getCell(1, 1).value = h.titulo;
            ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: 'FF022566' } };
            fila = 3;
        }
        const enc = ws.getRow(fila);
        h.columnas.forEach((c, i) => {
            const cell = enc.getCell(i + 1);
            cell.value = c.header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF022566' } };
            cell.alignment = { vertical: 'middle', wrapText: true };
            ws.getColumn(i + 1).width = c.width || Math.min(45, Math.max(10, c.header.length + 4));
        });
        enc.height = 22;
        h.filas.forEach((f, r) => {
            const row = ws.getRow(fila + 1 + r);
            f.forEach((v, c) => { row.getCell(c + 1).value = v ?? ''; row.getCell(c + 1).alignment = { vertical: 'top', wrapText: true }; });
        });
        ws.views = [{ state: 'frozen', ySplit: fila }];
        if (h.filas.length) ws.autoFilter = { from: { row: fila, column: 1 }, to: { row: fila + h.filas.length, column: h.columnas.length } };
    }
    const buffer = await libro.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = archivo;
    a.click();
    URL.revokeObjectURL(url);
}

/** Listado de casos (lo que se ve filtrado en pantalla). */
export function exportarCasosExcel(rows: CasoRow[], seccion: string) {
    const cols: [string, number, (r: CasoRow) => Celda][] = [
        ['N°', 16, (r) => r.folio], ['Tipo', 11, (r) => r.tipoLabel], ['Origen', 10, (r) => r.origenLabel], ['Canal', 18, (r) => r.canalLabel],
        ['Empresa', 28, (r) => r.empresa], ['Nombre', 24, (r) => r.nombre], ['Mail de contacto', 28, (r) => r.correo], ['Fono', 15, (r) => r.telefono],
        ['Fecha recepción', 14, (r) => fmtDay(r.fecha_recepcion)], ['Hora', 8, (r) => r.hora_recepcion], ['Fecha tratamiento', 14, (r) => fmtDay(r.fecha_tratamiento)],
        ['N° informe', 14, (r) => r.numero_informe], ['Estado', 18, (r) => r.estadoLabel], ['Presentada por', 18, (r) => r.emisorLabel],
        ['Vía de ingreso', 18, (r) => r.via_ingreso], ['Causa', 24, (r) => r.causa], ['Jefe de área', 24, (r) => r.jefe_area], ['Procede', 9, (r) => yesNo(r.procede)],
        ['Responsable', 26, (r) => r.responsable], ['AC abiertas', 10, (r) => r.acciones_abiertas || 0], ['Plazo', 12, (r) => fmtDay(r.plazo_vence)],
        ['Fuera de plazo', 10, (r) => (r.vencida ? 'Sí' : 'No')], ['Cierre', 12, (r) => fmtDay(r.cerrado_en)],
    ];
    return descargarLibro([{
        nombre: seccion, titulo: `${seccion} · exportado el ${fmtDay(today())}`,
        columnas: cols.map(([header, width]) => ({ header, width })), filas: rows.map((r) => cols.map(([, , f]) => f(r))),
    }], `${seccion.toLowerCase().replace(/\s+/g, '-')}-${today()}.xlsx`);
}

/** Dashboard: indicadores, meses, causas, plazos y carga por responsable (para la revisión por la dirección). */
export function exportarDashboardExcel(s: Stats, seccion: string) {
    const pct = (n: number) => (s.total ? Math.round((n / s.total) * 100) : 0);
    return descargarLibro([
        {
            nombre: 'Indicadores', titulo: `${seccion} — año ${s.anio}`, columnas: [{ header: 'Indicador', width: 36 }, { header: 'Valor', width: 14 }],
            filas: [
                ['Casos recibidos en el año', s.total], ...s.porTipo.map((t) => [`  ${t.label}`, t.total]),
                ['Abiertos hoy (todos los años)', s.abiertosHoy], ['Por vencer (≤ 3 días hábiles)', s.porVencer], ['Vencidos hoy', s.vencidosHoy],
                ['Cerrados en el año', s.cerrados], ['% cerrados en plazo', s.porcentajeEnPlazo ?? '—'],
                ['Días promedio a la evaluación', s.diasPromedioEvaluacion ?? '—'], ['Días promedio al cierre', s.diasPromedioCierre ?? '—'],
                ['Procedentes', s.procedentes], ['No procedentes', s.noProcedentes], ['Sin evaluar', s.sinEvaluar],
                ['No relacionadas con el laboratorio', s.noRelacionadas], ['Trabajo no conforme', s.trabajoNoConforme], ['Auditorías', s.auditorias],
            ],
        },
        {
            nombre: 'Por mes', columnas: [{ header: 'Mes', width: 10 }, { header: 'Quejas' }, { header: 'Apelaciones' }, { header: 'Total' }],
            filas: s.porMes.map((m) => [MESES[m.mes - 1], m.queja, m.apelacion, m.queja + m.apelacion]),
        },
        {
            nombre: 'Causas', columnas: [{ header: 'Causa', width: 34 }, { header: 'Casos' }, { header: '%' }],
            filas: s.porCausa.map((c) => [c.label, c.total, pct(c.total)]),
        },
        {
            nombre: 'Plazos abiertos', columnas: [{ header: 'N°', width: 16 }, { header: 'Tipo' }, { header: 'Empresa', width: 28 }, { header: 'Responsable', width: 26 }, { header: 'Estado', width: 18 }, { header: 'Plazo', width: 12 }, { header: 'Días hábiles', width: 12 }],
            filas: s.plazos.map((p) => [p.folio, p.tipoLabel, p.empresa, p.responsable || 'Sin responsable', p.estadoLabel, fmtDay(p.plazo_vence), p.diasHabiles]),
        },
        {
            nombre: 'Carga por responsable', columnas: [{ header: 'Responsable', width: 34 }, { header: 'Abiertos' }, { header: 'Vencidos' }],
            filas: s.cargaResponsables.map((c) => [c.responsable, c.abiertos, c.vencidos]),
        },
    ], `${seccion.toLowerCase().replace(/\s+/g, '-')}-dashboard-${s.anio}.xlsx`);
}
