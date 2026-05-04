import 'dotenv/config';
import { getConnection } from './src/config/database.js';
import ExcelJS from 'exceljs';

async function run() {
    const pool = await getConnection();
    const freqs = (await pool.request().execute('Consulta_Frecuencia_Periodo')).recordset;

    const wb = new ExcelJS.Workbook();
    const filePath = 'C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL_test_oficial.xlsx';
    await wb.xlsx.readFile(filePath);

    const ws1 = wb.getWorksheet('FICHAS') || wb.worksheets[0];
    
    // Create Mappings sheet
    let wsMap = wb.getWorksheet('_MAPPINGS');
    if (wsMap) wb.removeWorksheet(wsMap.id);
    wsMap = wb.addWorksheet('_MAPPINGS', { state: 'hidden' });
    
    const mappingRows = [];
    freqs.forEach(f => {
        mappingRows.push([f.nombre_frecuencia, f.cantidad, f.multiplicadopor, f.id_frecuencia]);
        mappingRows.push([String(f.id_frecuencia), f.cantidad, f.multiplicadopor, f.id_frecuencia]);
    });
    wsMap.addRows(mappingRows);

    // Find Columns
    const headerRow = ws1.getRow(3);
    let colPeriodo = 13; // Default M
    let colFreq = 14;    // Default N
    let colFactor = 17;  // Default Q (Wait, I added this?)
    let colTotal = 18;   // Default R

    headerRow.eachCell({includeEmpty: true}, (cell, i) => {
        const val = String(cell.value || '').toUpperCase();
        if (val.includes('FRECUENCIA PERÍODO') && !val.includes('AUTO') && !val.includes('SELECCIÓN')) colPeriodo = i;
        if (val.includes('FREC. MUESTREO') && !val.includes('AUTO')) colFreq = i;
        if (val.includes('FACTOR')) colFactor = i;
        if (val.includes('TOTAL SERVICIOS')) colTotal = i;
    });

    console.log(`Using columns: Periodo=${colPeriodo}, Freq=${colFreq}, Factor=${colFactor}, Total=${colTotal}`);

    const formulaFont = { size: 10, name: 'Calibri', italic: true, color: { argb: '1A7A1A' } };
    const formulaBg = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EAF7EA' } };
    const thin = { style: 'thin' };
    const border = { top: thin, left: thin, bottom: thin, right: thin };

    // Update headers to indicate auto-calc
    const setHeader = (col, text) => {
        const cell = ws1.getCell(3, col);
        cell.value = text;
        cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10, name: 'Calibri' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0A7A3A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = border;
    };

    setHeader(colPeriodo, 'FRECUENCIA PERÍODO\n(selección)');
    setHeader(colFreq, 'FREC. CANTIDAD\n(auto)');
    setHeader(colFactor, 'FACTOR\n(auto)');
    setHeader(colTotal, 'TOTAL SERVICIOS\n(auto)');

    // Data Validation for Periodo
    const namesRange = freqs.map(f => f.nombre_frecuencia).join(',');
    ws1.dataValidations.add(`${ws1.getColumn(colPeriodo).letter}4:${ws1.getColumn(colPeriodo).letter}200`, {
        type: 'list',
        allowBlank: true,
        formulae: [`"${namesRange},Puntual,Eventual,No Aplica"`]
    });

    const pL = ws1.getColumn(colPeriodo).letter;
    const fL = ws1.getColumn(colFreq).letter;
    const qL = ws1.getColumn(colFactor).letter;
    const rL = ws1.getColumn(colTotal).letter;

    for (let r = 4; r <= 200; r++) {
        // Skip if row is mostly empty but keep formulas for consistency
        
        // Freq Cantidad (Col 14/N)
        const cellFreq = ws1.getCell(r, colFreq);
        cellFreq.value = { 
            formula: `IF(${pL}${r}="", "", IFERROR(VLOOKUP(IF(ISNUMBER(${pL}${r}),TEXT(${pL}${r},"0"),${pL}${r}), '_MAPPINGS'!$A$1:$C$${mappingRows.length}, 2, FALSE), 1))` 
        };
        cellFreq.font = formulaFont;
        cellFreq.fill = formulaBg;
        cellFreq.border = border;

        // Factor (Col 17/Q)
        const cellFact = ws1.getCell(r, colFactor);
        cellFact.value = { 
            formula: `IF(${pL}${r}="", "", IFERROR(VLOOKUP(IF(ISNUMBER(${pL}${r}),TEXT(${pL}${r},"0"),${pL}${r}), '_MAPPINGS'!$A$1:$C$${mappingRows.length}, 3, FALSE), 1))` 
        };
        cellFact.font = formulaFont;
        cellFact.fill = formulaBg;
        cellFact.border = border;

        // Total (Col 18/R)
        const cellTot = ws1.getCell(r, colTotal);
        cellTot.value = { 
            formula: `IF(AND(${fL}${r}<>"", ${qL}${r}<>""), ${fL}${r}*${qL}${r}, "")` 
        };
        cellTot.font = formulaFont;
        cellTot.fill = formulaBg;
        cellTot.border = border;
    }

    // CLEANUP: If I added extra columns in previous run (15, 16), maybe I should leave them but they might be confusing.
    // Let's just leave them for now to avoid breaking references if any.

    await wb.xlsx.writeFile(filePath);
    console.log('✅ Excel updated successfully using existing columns.');
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
