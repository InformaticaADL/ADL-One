/**
 * rebuild_excel.mjs
 * Rebuilds Formato_Carga_Masiva_ADL_test_oficial.xlsx with:
 * 1. 3 new master sheets: MAESTRO_EMP_FACTURAR, MAESTRO_EMP_SERVICIO, MAESTRO_CENTROS
 * 2. Data validation dropdowns in FICHAS sheet for those 3 fields
 * 3. Removes UF DISTRIBUIR column from FICHAS
 * 4. In ANALISIS: removes UF MANUAL and UF TOTAL REAL (AUTO), keeps only UF INDIVIDUAL (editable by user)
 */

import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_FILE  = join(__dirname, '..', 'Formato_Carga_Masiva_ADL_test_oficial.xlsx');
const OUTPUT_FILE = join(__dirname, '..', 'Formato_Carga_Masiva_ADL_test_oficial.xlsx');

// ─── Colors / styles ────────────────────────────────────────────────────────
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
const REQ_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
const OPT_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF4FB' } };
const AUTO_FILL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFE8019' } }; // orange for auto
const MASTER_HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203864' } };

const THIN_BORDER = {
    top:    { style: 'thin', color: { argb: 'FFBFBFBF' } },
    left:   { style: 'thin', color: { argb: 'FFBFBFBF' } },
    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    right:  { style: 'thin', color: { argb: 'FFBFBFBF' } }
};

const CENTER = { horizontal: 'center', vertical: 'middle', wrapText: true };
const WRAP   = { horizontal: 'left',   vertical: 'middle', wrapText: true };

// ─── Sample master data (shown as example rows; system will validate against DB) ──────
// These are illustrative — real data comes from the DB at parse time.
const SAMPLE_EMP_FACTURAR = [
    ['Nombre Empresa Facturar'],
    ['Invermar S.A.'],
    ['AquaChile S.A.'],
    ['Los Fiordos Ltda.'],
    ['Multiexport Foods S.A.'],
    ['Camanchaca S.A.'],
];

const SAMPLE_EMP_SERVICIO = [
    ['Nombre Empresa Servicio'],
    ['ADL Diagnostic'],
    ['Laboratorio ADL'],
];

const SAMPLE_CENTROS = [
    ['Nombre Centro / Fuente Emisora', 'Empresa Propietaria', 'Comuna', 'Región'],
    ['Piscicultura Lago Verde', 'Invermar S.A.', 'Futaleufú', 'Los Lagos'],
    ['Planta Puerto Montt', 'Invermar S.A.', 'Puerto Montt', 'Los Lagos'],
    ['Centro Chaica', 'AquaChile S.A.', 'Los Muermos', 'Los Lagos'],
];

// ─── Helper: apply common row style ─────────────────────────────────────────
function styleHeaderCell(cell, fill) {
    cell.fill   = fill || HEADER_FILL;
    cell.font   = HEADER_FONT;
    cell.border = THIN_BORDER;
    cell.alignment = CENTER;
}

function styleDataCell(cell, fill) {
    cell.fill   = fill || { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    cell.font   = { name: 'Calibri', size: 10 };
    cell.border = THIN_BORDER;
    cell.alignment = WRAP;
}

// ─── Build a master sheet ────────────────────────────────────────────────────
function buildMasterSheet(wb, sheetName, rows, colWidths) {
    const ws = wb.addWorksheet(sheetName, { state: 'visible' });
    
    // Row 1: Title
    ws.getCell('A1').value = `MAESTRO: ${sheetName.replace('MAESTRO_', '').replace(/_/g, ' ')}`;
    ws.getCell('A1').font  = { bold: true, size: 12, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    ws.getCell('A1').fill  = MASTER_HEAD;
    ws.getCell('A1').alignment = CENTER;
    if (rows[0].length > 1) {
        ws.mergeCells(1, 1, 1, rows[0].length);
    }
    
    // Row 2: Note
    ws.getCell('A2').value = '⚠️ Esta hoja es un maestro de referencia. Las validaciones de la hoja FICHAS apuntan a esta columna A.';
    ws.getCell('A2').font  = { italic: true, size: 9, color: { argb: 'FF555555' } };
    ws.getCell('A2').alignment = WRAP;
    if (rows[0].length > 1) {
        ws.mergeCells(2, 1, 2, rows[0].length);
    }
    ws.getRow(2).height = 30;
    
    // Row 3: Column headers
    const headerRow = ws.getRow(3);
    rows[0].forEach((h, ci) => {
        const cell = headerRow.getCell(ci + 1);
        cell.value = h;
        styleHeaderCell(cell, MASTER_HEAD);
    });
    headerRow.height = 28;
    
    // Data rows starting at row 4
    for (let ri = 1; ri < rows.length; ri++) {
        const dataRow = ws.getRow(ri + 3);
        rows[ri].forEach((val, ci) => {
            const cell = dataRow.getCell(ci + 1);
            cell.value = val;
            styleDataCell(cell);
        });
        dataRow.height = 20;
    }
    
    // Column widths
    (colWidths || [20]).forEach((w, ci) => {
        ws.getColumn(ci + 1).width = w;
    });
    
    return ws;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
    console.log('Loading existing workbook...');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(INPUT_FILE);

    // ── Remove old helper sheets we'll recreate ──────────────────────────
    ['MAESTRO_EMP_FACTURAR', 'MAESTRO_EMP_SERVICIO', 'MAESTRO_CENTROS'].forEach(name => {
        const existing = wb.getWorksheet(name);
        if (existing) wb.removeWorksheet(existing.id);
    });

    // ── Build Master sheets ───────────────────────────────────────────────
    const wsEmpFact  = buildMasterSheet(wb, 'MAESTRO_EMP_FACTURAR', SAMPLE_EMP_FACTURAR,  [40]);
    const wsEmpServ  = buildMasterSheet(wb, 'MAESTRO_EMP_SERVICIO',  SAMPLE_EMP_SERVICIO,   [40]);
    const wsCentros  = buildMasterSheet(wb, 'MAESTRO_CENTROS',       SAMPLE_CENTROS,        [45, 35, 25, 20]);

    // Protect master sheets from editing (optional - just style as read-only looking)
    // We won't use .protect() since that adds password complexity.

    // ── Update FICHAS sheet ───────────────────────────────────────────────
    const wsFichas = wb.getWorksheet('FICHAS');
    if (!wsFichas) { console.error('No FICHAS sheet found!'); process.exit(1); }

    // Find columns to remove: "UF DISTRIBUIR" and "UF TOTAL REAL"
    // We'll rebuild the header row without those columns.
    // Strategy: read all data, filter columns, rewrite.

    // First, read existing column map from row 3
    const colMap = {}; // header text -> colIndex (1-based)
    wsFichas.getRow(3).eachCell({ includeEmpty: false }, (c, i) => {
        const h = String(c.value || '').replace(/[\r\n🔁✏️\*]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
        if (h) colMap[h] = i;
    });

    console.log('FICHAS columns:', Object.keys(colMap));

    // Find the UF DISTRIBUIR column
    const ufDistrCol = Object.keys(colMap).find(k => k.includes('UF DISTRIBUIR'));
    const ufTotalCol = Object.keys(colMap).find(k => k.includes('UF TOTAL REAL'));
    
    console.log('UF DISTRIBUIR col:', ufDistrCol, '->', colMap[ufDistrCol]);
    console.log('UF TOTAL REAL col:', ufTotalCol, '->', colMap[ufTotalCol]);

    // Read all data rows from FICHAS (rows 4+)
    const fichasData = []; // array of objects {colIdx: value}
    const lastFichaRow = wsFichas.rowCount;
    for (let r = 4; r <= lastFichaRow; r++) {
        const row = wsFichas.getRow(r);
        const rowData = {};
        let hasData = false;
        row.eachCell({ includeEmpty: false }, (c, i) => {
            const val = c.value?.result !== undefined ? c.value.result : c.value;
            if (val !== null && val !== undefined && String(val).trim() !== '') {
                rowData[i] = val;
                hasData = true;
            }
        });
        if (hasData) fichasData.push({ rowNum: r, data: rowData });
    }

    // Remove the old UF DISTRIBUIR and UF TOTAL REAL cells from those columns
    const colsToRemove = [colMap[ufDistrCol], colMap[ufTotalCol]].filter(Boolean);
    console.log('Removing cols:', colsToRemove);

    // Update header row 3 for those columns to be blank or remove
    colsToRemove.forEach(colIdx => {
        if (!colIdx) return;
        // Clear all cells in this column (rows 3+)
        for (let r = 3; r <= lastFichaRow + 1; r++) {
            const cell = wsFichas.getRow(r).getCell(colIdx);
            cell.value = null;
            cell.fill  = { type: 'pattern', pattern: 'none' };
            cell.font  = {};
            cell.border = {};
        }
        // Set column width to 0 effectively
        wsFichas.getColumn(colIdx).width = 0.1;
        wsFichas.getColumn(colIdx).hidden = true;
    });

    // Now update the header cell for those hidden cols (make blank)
    // And add dropdowns to FICHAS col 3 (EMPRESA DE SERVICIO), col 4 (EMPRESA A FACTURAR), col 6 (CENTRO)
    const empresaServIdx  = colMap['EMPRESA DE SERVICIO'];
    const empresaFactIdx  = colMap['EMPRESA A FACTURAR'];
    const centroIdx       = colMap['CENTRO / FUENTE EMISORA'];

    console.log('EmpServ col:', empresaServIdx, 'EmpFact col:', empresaFactIdx, 'Centro col:', centroIdx);

    // Add data validation dropdowns for data rows (rows 4 to 1003 = 1000 possible fichas)
    const DATA_START = 4;
    const DATA_END   = 1003;

    // Helper to get column letter from index
    const colLetter = (n) => {
        let s = '';
        while (n > 0) {
            const rem = (n - 1) % 26;
            s = String.fromCharCode(65 + rem) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    };

    // Master sheet names for formula references
    // ExcelJS uses formula strings for list validation
    const EF_DATA_COUNT  = SAMPLE_EMP_FACTURAR.length - 1;  // excluding header
    const ES_DATA_COUNT  = SAMPLE_EMP_SERVICIO.length  - 1;
    const CT_DATA_COUNT  = SAMPLE_CENTROS.length        - 1;

    const addDropdown = (ws, colIdx, formula, prompt, title) => {
        if (!colIdx) return;
        const col = colLetter(colIdx);
        for (let r = DATA_START; r <= DATA_END; r++) {
            const cell = ws.getCell(`${col}${r}`);
            cell.dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [formula],
                showErrorMessage: true,
                errorStyle: 'warning',
                errorTitle: `Valor no encontrado`,
                error: `El valor ingresado no está en el maestro "${title}". Puede ingresarlo igual pero el sistema intentará buscarlo por coincidencia.`,
                showInputMessage: true,
                promptTitle: title,
                prompt: prompt
            };
        }
    };

    // Data validation references to master sheets
    if (empresaFactIdx) {
        addDropdown(
            wsFichas, empresaFactIdx,
            `MAESTRO_EMP_FACTURAR!$A$4:$A$${3 + EF_DATA_COUNT}`,
            'Seleccione la empresa a facturar del maestro o escriba el nombre exacto.',
            'Empresa a Facturar'
        );
    }
    if (empresaServIdx) {
        addDropdown(
            wsFichas, empresaServIdx,
            `MAESTRO_EMP_SERVICIO!$A$4:$A$${3 + ES_DATA_COUNT}`,
            'Seleccione la empresa de servicio del maestro.',
            'Empresa de Servicio'
        );
    }
    if (centroIdx) {
        addDropdown(
            wsFichas, centroIdx,
            `MAESTRO_CENTROS!$A$4:$A$${3 + CT_DATA_COUNT}`,
            'Seleccione el centro/fuente emisora del maestro.',
            'Centro / Fuente Emisora'
        );
    }

    // ── Update ANALISIS sheet ─────────────────────────────────────────────
    const wsAnalisis = wb.getWorksheet('ANALISIS');
    if (!wsAnalisis) { console.error('No ANALISIS sheet found!'); process.exit(1); }

    const colMapA = {};
    wsAnalisis.getRow(3).eachCell({ includeEmpty: false }, (c, i) => {
        const h = String(c.value || '').replace(/[\r\n🔁✏️\*]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
        if (h) colMapA[h] = i;
    });
    console.log('ANALISIS columns:', JSON.stringify(colMapA));

    // Find columns to remove: "UF INDIVIDUAL (AUTO)" (col 9 - was auto), "UF MANUAL" (col 10)
    // We want to KEEP a single "UF INDIVIDUAL" column that the user fills manually.
    // Find them:
    const ufIndividualAutoCol = Object.keys(colMapA).find(k => k.includes('UF INDIVIDUAL'));
    const ufManualCol         = Object.keys(colMapA).find(k => k.includes('UF MANUAL'));
    const cntCol              = Object.keys(colMapA).find(k => k.includes('_CNT'));

    console.log('UF INDIVIDUAL col:', ufIndividualAutoCol, '->', colMapA[ufIndividualAutoCol]);
    console.log('UF MANUAL col:', ufManualCol, '->', colMapA[ufManualCol]);
    console.log('_CNT col:', cntCol, '->', colMapA[cntCol]);

    const ufIndAutoIdx = colMapA[ufIndividualAutoCol];
    const ufManualIdx  = colMapA[ufManualCol];
    const cntIdx       = colMapA[cntCol];

    // Strategy: 
    // - Rename UF INDIVIDUAL (AUTO) to "✏️ UF INDIVIDUAL (Escriba Aquí)" so user fills it manually
    // - Remove UF MANUAL column (hide it)
    // - Remove _CNT column (hide it)

    const lastAnalRow = wsAnalisis.rowCount;

    // Update the header cell for UF INDIVIDUAL - rename it to be user-editable
    if (ufIndAutoIdx) {
        const headerCell = wsAnalisis.getRow(3).getCell(ufIndAutoIdx);
        headerCell.value = '✏️ UF INDIVIDUAL\n(Escriba Aquí)';
        headerCell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } }; // yellow = editable
        headerCell.font   = { bold: true, color: { argb: 'FF000000' }, name: 'Calibri', size: 10 };
        headerCell.alignment = CENTER;
        headerCell.border = THIN_BORDER;
        
        // Clear any formulas in data rows and leave as plain number
        for (let r = 4; r <= lastAnalRow; r++) {
            const cell = wsAnalisis.getRow(r).getCell(ufIndAutoIdx);
            // If cell has a formula result, replace with raw number
            let val = cell.value;
            if (val && typeof val === 'object' && val.result !== undefined) {
                val = val.result;
            }
            cell.value = typeof val === 'number' ? val : (parseFloat(val) || null);
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; // light yellow = input
            cell.border = THIN_BORDER;
        }
        wsAnalisis.getColumn(ufIndAutoIdx).width = 18;
    }

    // Hide UF MANUAL and _CNT columns
    [ufManualIdx, cntIdx].forEach(colIdx => {
        if (!colIdx) return;
        for (let r = 3; r <= lastAnalRow + 1; r++) {
            const cell = wsAnalisis.getRow(r).getCell(colIdx);
            cell.value = null;
            cell.fill  = { type: 'pattern', pattern: 'none' };
            cell.font  = {};
            cell.border = {};
        }
        wsAnalisis.getColumn(colIdx).hidden = true;
        wsAnalisis.getColumn(colIdx).width  = 0.1;
    });

    // Update INSTRUCCIONES sheet to reflect new UF logic
    const wsInstr = wb.getWorksheet('INSTRUCCIONES');
    if (wsInstr) {
        // Find and update the instructions text for UF
        // We'll just append a note at end
        const lastRow = wsInstr.rowCount;
        const noteRow = wsInstr.getRow(lastRow + 2);
        noteRow.getCell(1).value = '✅ CAMBIO: Ingrese el costo UF individualmente por cada análisis en la columna "UF INDIVIDUAL" de la hoja ANALISIS. El sistema sumará automáticamente el total al crear las fichas.';
        noteRow.getCell(1).font  = { italic: true, size: 10, color: { argb: 'FF1F4E79' } };
        noteRow.getCell(1).alignment = { wrapText: true };
        wsInstr.getColumn(1).width = 100;
        noteRow.height = 40;

        const noteRow2 = wsInstr.getRow(lastRow + 3);
        noteRow2.getCell(1).value = '✅ MAESTROS: Las hojas MAESTRO_EMP_FACTURAR, MAESTRO_EMP_SERVICIO y MAESTRO_CENTROS contienen los valores válidos para las columnas de empresa y centro en la hoja FICHAS.';
        noteRow2.getCell(1).font  = { italic: true, size: 10, color: { argb: 'FF1F4E79' } };
        noteRow2.getCell(1).alignment = { wrapText: true };
        noteRow2.height = 40;
    }

    // ── Save ──────────────────────────────────────────────────────────────
    console.log('Saving workbook to:', OUTPUT_FILE);
    await wb.xlsx.writeFile(OUTPUT_FILE);
    console.log('✅ Done! Excel saved.');
}

main().catch(err => { console.error('ERROR:', err); process.exit(1); });
