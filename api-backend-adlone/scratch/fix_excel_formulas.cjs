const ExcelJS = require('exceljs');

async function fixFormulas() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');

    const ws1 = wb.getWorksheet('FICHAS');
    const ws2 = wb.getWorksheet('ANALISIS');
    const ws3 = wb.getWorksheet('INSTRUCCIONES');

    // ─── Descubrir layout real ───────────────────────────────────
    // Buscar columnas por su header en fila 3
    const headerRow = ws1.getRow(3);
    const colMap = {}; // nombre normalizado → número de columna
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
        const raw = String(cell.value || '').replace(/[\r\n]/g,' ').replace(/\s+/g,' ').trim().toUpperCase();
        colMap[raw] = col;
        console.log(`  [Hoja 1] Col ${col}: "${raw}"`);
    });

    // Lo mismo para Hoja 2
    const h2HeaderRow = ws2.getRow(3);
    const colMap2 = {};
    h2HeaderRow.eachCell({ includeEmpty: false }, (cell, col) => {
        const raw = String(cell.value || '').replace(/[\r\n]/g,' ').replace(/\s+/g,' ').trim().toUpperCase();
        colMap2[raw] = col;
        console.log(`  [Hoja 2] Col ${col}: "${raw}"`);
    });

    // ─── Encontrar columnas clave ────────────────────────────────
    // FREC MUESTREO = col que contiene "FREC" y "MUESTREO"
    const findCol = (map, ...keywords) => {
        for (const [k, v] of Object.entries(map)) {
            if (keywords.every(kw => k.includes(kw))) return v;
        }
        return null;
    };

    const colFreqCant  = findCol(colMap, 'FREC') || findCol(colMap, 'MUESTREO', 'FREC'); // FREC. MUESTREO
    const colFactor    = findCol(colMap, 'FACTOR');
    const colTotalSvc  = findCol(colMap, 'TOTAL SERVICIOS') || findCol(colMap, 'TOTAL');
    const colUfTotal   = findCol(colMap, 'UF TOTAL') || findCol(colMap, 'UF');
    const colUfIndiv   = findCol(colMap2, 'UF INDIVIDUAL') || findCol(colMap2, 'UF');
    const colIdH2      = findCol(colMap2, 'ID');

    console.log('\n─── COLUMNAS DETECTADAS ───');
    console.log(`  FREC CANTIDAD: col ${colFreqCant} (${colLetter(colFreqCant)})`);
    console.log(`  FACTOR:        col ${colFactor} (${colLetter(colFactor)})`);
    console.log(`  TOTAL SVC:     col ${colTotalSvc} (${colLetter(colTotalSvc)})`);
    console.log(`  UF TOTAL:      col ${colUfTotal} (${colLetter(colUfTotal)})`);
    console.log(`  UF INDIVIDUAL: col ${colUfIndiv} (${colLetter(colUfIndiv)})`);

    if (!colFreqCant || !colFactor || !colTotalSvc || !colUfTotal) {
        console.error('❌ No se encontraron todas las columnas necesarias. Revise los headers.');
        return;
    }

    const fFreq   = colLetter(colFreqCant);
    const fFactor = colLetter(colFactor);
    const fTotal  = colLetter(colTotalSvc);
    const fUfT    = colLetter(colUfTotal);
    const fUfI    = colLetter(colUfIndiv);

    // Total columns in Sheet1 for VLOOKUP index
    // UF TOTAL column index from A (column A = 1)
    const ufTotalIdx = colUfTotal; // for VLOOKUP col_index_num

    const COLORS = {
        formulaBg: 'EAF7EA',
        borderColor: 'BDC9D7',
        headerGreen: '0A7A3A',
        headerFont: 'FFFFFF'
    };
    const thin = {
        top:{style:'thin',color:{argb:COLORS.borderColor}},
        left:{style:'thin',color:{argb:COLORS.borderColor}},
        bottom:{style:'thin',color:{argb:COLORS.borderColor}},
        right:{style:'thin',color:{argb:COLORS.borderColor}}
    };
    const formulaFont = { size:10, name:'Calibri', italic:true, color:{argb:'1A7A1A'} };

    // ─── HOJA 1: Actualizar headers fórmula ─────────────────────
    const styleAutoHeader = (cell, label, note) => {
        cell.value = label;
        cell.font = { bold:true, color:{argb:COLORS.headerFont}, size:10, name:'Calibri' };
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.headerGreen} };
        cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true };
        cell.border = thin;
    };
    styleAutoHeader(ws1.getCell(`${fTotal}3`), '🔁 TOTAL SERVICIOS\n(auto)');
    styleAutoHeader(ws1.getCell(`${fUfT}3`),   '🔁 UF TOTAL\n(ingrese aquí)');
    styleAutoHeader(ws2.getCell(`${fUfI}3`),   '🔁 UF INDIVIDUAL\n(auto/editable)');

    // ─── HOJA 1: Fórmulas filas 4-104 ───────────────────────────
    for (let r = 4; r <= 104; r++) {
        // TOTAL SERVICIOS = FREC_CANTIDAD × FACTOR
        const cTotal = ws1.getCell(`${fTotal}${r}`);
        cTotal.value = { formula: `IF(AND(${fFreq}${r}<>"",${fFactor}${r}<>""),${fFreq}${r}*${fFactor}${r},"")` };
        cTotal.font = formulaFont;
        cTotal.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.formulaBg} };
        cTotal.alignment = { vertical:'middle', horizontal:'center' };
        cTotal.border = thin;
        cTotal.numFmt = '0';
        cTotal.protection = { locked: false }; // allow override
    }

    // ─── HOJA 2: Fórmulas UF INDIVIDUAL ────────────────────────
    // Primero aseguramos que la col helper (J en Sheet2, o siguiente a UF INDIVIDUAL) exista
    // La fórmula: = VLOOKUP(ID_MUESTRA, FICHAS!$A:$[last], ufTotalIdx, 0) / COUNTIF($A:$A, ID)
    // VLOOKUP range: columna A hasta la columna de UF TOTAL
    const rangeEnd = colLetter(colUfTotal);

    // Añadir/actualizar columna HELPER en la siguiente col a UF INDIVIDUAL (oculta)
    const helperCol = colUfIndiv + 1;
    const hLetter = colLetter(helperCol);
    ws2.getColumn(helperCol).hidden = true;
    ws2.getColumn(helperCol).width = 0;

    for (let r = 4; r <= 508; r++) {
        // Helper: count de análisis para ese ID
        const cH = ws2.getCell(`${hLetter}${r}`);
        cH.value = { formula: `IF(A${r}<>"",COUNTIF($A:$A,A${r}),0)` };
        cH.font = { size:8, color:{argb:'CCCCCC'} };

        // UF INDIVIDUAL = VLOOKUP(UF_TOTAL en Hoja1) / helper_count
        const cI = ws2.getCell(`${fUfI}${r}`);
        cI.value = {
            formula:
                `IF(A${r}="","",` +
                `IFERROR(` +
                    `VLOOKUP(A${r},FICHAS!$A:$${rangeEnd},${ufTotalIdx},0)/` +
                    `IF(${hLetter}${r}=0,1,${hLetter}${r}),` +
                `""))`
        };
        cI.font = formulaFont;
        cI.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.formulaBg} };
        cI.alignment = { vertical:'middle', horizontal:'center' };
        cI.border = thin;
        cI.numFmt = '0.00';
        cI.protection = { locked: false }; // user can overwrite
    }

    // ─── INSTRUCCIONES: actualizar ───────────────────────────────
    ws3.spliceRows(1, ws3.rowCount);
    ws3.getColumn(1).width = 95;

    const freqLetter = fFreq;
    const factLetter = fFactor;
    const totalLetter = fTotal;
    const ufTLetter = fUfT;
    const ufILetter = fUfI;

    const iRows = [
        ['📖 INSTRUCCIONES — Plantilla Carga Masiva ADL ONE (v3)', true, 13, '1A6FBF', 'FFFFFF', 30],
        ['', false, 10, 'FFFFFF', '000000', 8],
        ['🟢 Celdas en VERDE claro = calculadas automáticamente. Puede sobreescribirse con un valor manual.', true, 10, 'EAFAEA', '1A7A1A', 22],
        ['', false, 10, 'FFFFFF', '000000', 8],
        ['HOJA 1 "FICHAS" — una fila por ficha:', true, 11, '0D5C2E', 'FFFFFF', 24],
        [`  • Col ${totalLetter} TOTAL SERVICIOS 🟢: Auto = col ${freqLetter} (FREC.MUESTREO) × col ${factLetter} (FACTOR). No editar.`, false, 10, 'F0FFF4', '1B4332', 18],
        [`  • Col ${ufTLetter} UF TOTAL: Ingrese el UF total de la ficha. La Hoja 2 lo distribuirá automáticamente entre los análisis.`, false, 10, 'F0FFF4', '1B4332', 18],
        ['  • Resto de campos: los textos (Empresa, Centro, etc.) se buscan por similitud. No necesitan ser exactos.', false, 10, 'F0FFF4', '1B4332', 18],
        ['', false, 10, 'FFFFFF', '000000', 8],
        ['HOJA 2 "ANALISIS" — una fila por análisis:', true, 11, '1A6FBF', 'FFFFFF', 24],
        ['  • ID MUESTRA (col A): Debe coincidir EXACTAMENTE con Hoja 1. Repítalo por cada análisis de la misma ficha.', false, 10, 'EBF5FB', '1A5276', 18],
        [`  • Col ${ufILetter} UF INDIVIDUAL 🟢: Auto = UF TOTAL ÷ cantidad de análisis de esa ficha.`, false, 10, 'EAFAEA', '1A7A1A', 18],
        ['    → Si sobreescribe una celda con un número, ese valor queda fijo (rompiendo la fórmula de esa celda).', false, 10, 'EAFAEA', '1A7A1A', 18],
        ['    → Para restablecer la fórmula, borre el contenido de la celda y el sistema la recalculará.', false, 10, 'EAFAEA', '1A7A1A', 18],
        ['  • TIPO ANÁLISIS: Terreno / Laboratorio  |  TIPO ENTREGA: No Aplica / Transporte / Directa', false, 10, 'EBF5FB', '1A5276', 18],
        ['', false, 10, 'FFFFFF', '000000', 8],
        ['EJEMPLO (ficha con UF TOTAL = 10 y 5 análisis → cada uno recibe UF = 2.00):', true, 10, '7D3C98', 'FFFFFF', 22],
        ['  Hoja 1, M-001: FREC=4 × FACTOR=1 → TOTAL SVC=4. UF TOTAL=10.', false, 9, 'F5EEF8', '4A235A', 18],
        ['  Hoja 2: pH, DBO5, SST, Fósforo, Cloruros → UF INDIVIDUAL=2.00 cada uno (automático).', false, 9, 'F5EEF8', '4A235A', 18],
        ['  Si cambia manualmente SST a UF=3.00 → esa celda queda fija en 3.00. El resto no cambia.', false, 9, 'F5EEF8', '4A235A', 18],
    ];

    iRows.forEach(([text, bold, size, bg, fg, height], i) => {
        const cell = ws3.getCell(`A${i+1}`);
        cell.value = text;
        cell.font = { bold, size, name:'Calibri', color:{argb:fg} };
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
        cell.alignment = { vertical:'middle', horizontal:'left', indent:1, wrapText:true };
        ws3.getRow(i+1).height = height || 18;
    });

    const out = 'C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx';
    await wb.xlsx.writeFile(out);
    console.log('\n✅ Guardado:', out);
    console.log(`   TOTAL SERVICIOS: col ${fTotal} = ${fFreq} × ${fFactor}`);
    console.log(`   UF INDIVIDUAL:   col ${fUfI} = VLOOKUP(${fUfT} de Hoja1) / COUNTIF(mismo ID en Hoja2)`);
}

function colLetter(num) {
    if (!num) return '?';
    let l = '';
    while (num > 0) { const m=(num-1)%26; l=String.fromCharCode(65+m)+l; num=Math.floor((num-1)/26); }
    return l;
}

fixFormulas().catch(console.error);
