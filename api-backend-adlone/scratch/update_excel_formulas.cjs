const ExcelJS = require('exceljs');

async function run() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');

    const ws1 = wb.getWorksheet('FICHAS');
    const ws2 = wb.getWorksheet('ANALISIS');
    const ws3 = wb.getWorksheet('INSTRUCCIONES');

    const COLORS = {
        headerBg:'1A6FBF', headerFont:'FFFFFF',
        requiredBg:'E8F4FD', optionalBg:'F8F9FA',
        formulaBg:'EAF7EA', warnBg:'FFF3CD', warnFont:'856404',
        linkedCol:'D6EAF8', sheet2Bg:'0D5C2E',
        borderColor:'BDC9D7'
    };
    const thin = { top:{style:'thin',color:{argb:COLORS.borderColor}}, left:{style:'thin',color:{argb:COLORS.borderColor}}, bottom:{style:'thin',color:{argb:COLORS.borderColor}}, right:{style:'thin',color:{argb:COLORS.borderColor}} };
    const formulaFont = { size:10, name:'Calibri', italic:true, color:{argb:'1A7A1A'} };
    const normalFont = { size:10, name:'Calibri' };

    // ──────────────────────────────────────────────
    // SHEET 1: Add formulas for rows 4-104
    // Col R (18) = TOTAL SERVICIOS  => P * Q
    // Col AN (40) = UF TOTAL        => SUMIF in Sheet2
    // ──────────────────────────────────────────────
    // First: style the formula columns headers
    const hrStyle = (cell, text, note) => {
        cell.value = text;
        cell.font = { bold:true, color:{argb:COLORS.headerFont}, size:10, name:'Calibri' };
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'0A7A3A'} }; // green = auto
        cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true };
        cell.border = thin;
        if (note) cell.note = { texts:[{text: note}] };
    };

    // Update header labels to show they are auto-calculated
    hrStyle(ws1.getCell('R3'), '🔁 TOTAL SERVICIOS\n(auto)', 'Calculado automáticamente: FREC.MUESTREO × FACTOR');
    hrStyle(ws1.getCell('AN3'), '🔁 UF TOTAL\n(editable)', 'Ingrese el UF total de la ficha. La Hoja 2 distribuye automáticamente entre los análisis. O bien, si ingresa UF individuales en Hoja 2, este campo muestra la suma.');

    for (let r = 4; r <= 104; r++) {
        // R = TOTAL SERVICIOS = P * Q (FREC_CANTIDAD * FACTOR)
        const cellR = ws1.getCell(`R${r}`);
        cellR.value = { formula: `IF(AND(P${r}<>"",Q${r}<>""),P${r}*Q${r},"")` };
        cellR.font = formulaFont;
        cellR.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.formulaBg} };
        cellR.alignment = { vertical:'middle', horizontal:'center' };
        cellR.border = thin;
        cellR.numFmt = '0';

        // AN = UF TOTAL
        // If user enters UF individually in Sheet2, this SUMS them.
        // If user enters a UF TOTAL here, Sheet2 auto-distributes.
        // We set it as a SUMIF formula by default — user can override by typing a number directly.
        const cellAN = ws1.getCell(`AN${r}`);
        cellAN.value = { formula: `IFERROR(SUMIF(ANALISIS!$A:$A,A${r},ANALISIS!$I:$I),0)` };
        cellAN.font = formulaFont;
        cellAN.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.formulaBg} };
        cellAN.alignment = { vertical:'middle', horizontal:'center' };
        cellAN.border = thin;
        cellAN.numFmt = '0.00';
    }

    // Set column widths for formula cols
    ws1.getColumn(18).width = 16; // R
    ws1.getColumn(40).width = 14; // AN

    // ──────────────────────────────────────────────
    // SHEET 2: UF INDIVIDUAL formula
    // Col I (9) = IF user typed a value, keep it.
    //            ELSE = VLOOKUP UF_TOTAL from Sheet1 / COUNTIF same ID_MUESTRA
    // Since Excel can't do conditional formula vs manual, we use:
    //   "default formula" — user can overwrite any cell with a number
    //   The formula checks: if UF_TOTAL in Sheet1 > 0, divide it.
    // ──────────────────────────────────────────────
    hrStyle(ws2.getCell('I3'), '🔁 UF INDIVIDUAL\n(auto/editable)', 'Si UF TOTAL en Hoja 1 está definido, este campo se calcula automáticamente. Puede sobreescribirse manualmente.');
    ws2.getColumn(9).width = 16;

    // Add header for count helper (hidden column J)
    ws2.getColumn(10).width = 0; // hidden helper
    ws2.getCell('J3').value = '_cnt'; // helper: count of analyses per ID

    for (let r = 4; r <= 508; r++) {
        // Helper col J: count of analyses with same ID_MUESTRA
        const cellJ = ws2.getCell(`J${r}`);
        cellJ.value = { formula: `IF(A${r}<>"",COUNTIF($A:$A,A${r}),0)` };
        cellJ.font = { size:8, color:{argb:'AAAAAA'} };

        // Col I: UF INDIVIDUAL
        // = UF_TOTAL from Sheet1 / count of analyses for this ficha
        // VLOOKUP finds the UF TOTAL from Sheet1 col AN (col 40)
        const cellI = ws2.getCell(`I${r}`);
        cellI.value = {
            formula: `IF(A${r}="","",IF(IFERROR(VLOOKUP(A${r},FICHAS!$A:$AN,40,0),0)>0,IFERROR(VLOOKUP(A${r},FICHAS!$A:$AN,40,0)/J${r},0),""))`
        };
        cellI.font = formulaFont;
        cellI.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.formulaBg} };
        cellI.alignment = { vertical:'middle', horizontal:'center' };
        cellI.border = thin;
        cellI.numFmt = '0.00';
    }

    // Hide helper column J in Sheet2
    ws2.getColumn(10).hidden = true;

    // ──────────────────────────────────────────────
    // SHEET 1: Frequency period dropdown + note
    // ──────────────────────────────────────────────
    // Col O = FRECUENCIA_PERIODO — add validation if not already
    ws1.dataValidations.add('O4:O104', {
        type: 'list', allowBlank: true,
        formulae: ['"Mensual,Bimensual,Trimestral,Semestral,Anual,Quincenal,Semanal,Diario,Puntual"'],
        showInputMessage: true,
        promptTitle: 'Frecuencia Período',
        prompt: 'Seleccione la frecuencia del muestreo'
    });

    // TIPO_MONITOREO (col B = 2)
    ws1.dataValidations.add('B4:B104', {
        type: 'list', allowBlank: true,
        formulae: ['"Puntual,Compuesto,Compuesta,Compuesto 24 h,Compuesto 8 h,Compuesto 12 h"']
    });
    // MEDICION_CAUDAL (col AF = 32)
    ws1.dataValidations.add('AF4:AF104', { type:'list', allowBlank:true, formulae:['"Manual,Automático,No Aplica"'] });
    // ETFA (col X = 24)
    ws1.dataValidations.add('X4:X104', { type:'list', allowBlank:true, formulae:['"Si,No"'] });
    // TIPO ANALISIS Sheet2
    ws2.dataValidations.add('C4:C508', { type:'list', allowBlank:false, formulae:['"Terreno,Laboratorio"'] });
    ws2.dataValidations.add('E4:E508', { type:'list', allowBlank:false, formulae:['"No Aplica,Transporte,Directa"'] });

    // ──────────────────────────────────────────────
    // INSTRUCCIONES: rewrite
    // ──────────────────────────────────────────────
    ws3.spliceRows(1, ws3.rowCount); // clear
    ws3.getColumn(1).width = 95;

    const rows = [
        ['📖 INSTRUCCIONES — Plantilla Carga Masiva ADL ONE (v2)', true, 13, COLORS.headerBg, COLORS.headerFont, 32],
        ['', false, 10, 'FFFFFF', '000000', 10],
        ['HOJA 1 "FICHAS" — Complete una fila por ficha:', true, 11, '0D5C2E', COLORS.headerFont, 24],
        ['  1. ID MUESTRA (col A): Código libre que usted define. Ej: M-001, LAGOVERDE-ENE26. Debe coincidir en Hoja 2.', false, 10, 'F0FFF4', '1B4332', 18],
        ['  2. Campos con * son OBLIGATORIOS.', false, 10, 'F0FFF4', '1B4332', 18],
        ['  3. Los textos (Empresa, Centro, etc.) se buscan automáticamente por similitud. No necesitan ser exactos.', false, 10, 'F0FFF4', '1B4332', 18],
        ['  4. TOTAL SERVICIOS (col R) 🟢: Se calcula AUTOMÁTICAMENTE = FREC.MUESTREO × FACTOR. No editar.', false, 10, 'EAFAEA', '1A7A1A', 18],
        ['  5. UF TOTAL (col AN) 🟢: Ingrese el UF total de la ficha. La Hoja 2 lo distribuirá automáticamente.', false, 10, 'EAFAEA', '1A7A1A', 18],
        ['     → Si prefiere ingresar UF por análisis en Hoja 2, deje UF TOTAL vacío y UF TOTAL sumará los individuales.', false, 10, 'EAFAEA', '1A7A1A', 18],
        ['  6. Listas desplegables activas en: MONITOREO, FRECUENCIA PERÍODO, ETFA, MEDICIÓN CAUDAL.', false, 10, 'F0FFF4', '1B4332', 18],
        ['', false, 10, 'FFFFFF', '000000', 10],
        ['HOJA 2 "ANALISIS" — Complete una fila por análisis:', true, 11, COLORS.headerBg, COLORS.headerFont, 24],
        ['  1. ID MUESTRA (col A): Debe coincidir EXACTAMENTE con la Hoja 1. Repítalo en cada análisis de la misma ficha.', false, 10, 'EBF5FB', '1A5276', 18],
        ['  2. UF INDIVIDUAL (col I) 🟢: Se calcula AUTOMÁTICAMENTE como UF TOTAL ÷ N° de análisis de esa ficha.', false, 10, 'EAFAEA', '1A7A1A', 18],
        ['     → Puede sobreescribir cualquier celda manualmente. El UF TOTAL en Hoja 1 se actualizará con la SUMA.', false, 10, 'EAFAEA', '1A7A1A', 18],
        ['     → Si mezcla fórmulas con valores manuales, UF TOTAL = suma de todos los UF INDIVIDUAL ingresados.', false, 10, 'EAFAEA', '1A7A1A', 18],
        ['  3. TIPO ANÁLISIS: Terreno / Laboratorio  |  TIPO ENTREGA: No Aplica / Transporte / Directa', false, 10, 'EBF5FB', '1A5276', 18],
        ['', false, 10, 'FFFFFF', '000000', 10],
        ['🟢 = Celda con fórmula automática. Puede sobreescribirse con un valor manual si es necesario.', true, 10, 'EAFAEA', '1A7A1A', 22],
        ['', false, 10, 'FFFFFF', '000000', 10],
        ['EJEMPLO (Piscicultura Lago Verde — DS 90, Mensual, 4 muestreos × 1 factor = 4 servicios):', true, 10, '7D3C98', COLORS.headerFont, 22],
        ['  Hoja 1: M-001 | Compuesto 24 h | ADL Diagnostic | | | Invermar S.A. | Puerto Montt | Piscicultura Lago Verde | | | Autocontrol | ADL | | Efluente | Mensual | 4 | 1 | =4 | ...| UF TOTAL=10', false, 9, 'F5EEF8', '4A235A', 18],
        ['  Hoja 2: M-001 | pH | Terreno | ADL Diagnostic | No Aplica | D.S 90 | DS 90 Tabla 1 | | =1.25  (10/8 análisis)', false, 9, 'F5EEF8', '4A235A', 18],
        ['  Hoja 2: M-001 | DBO5 | Laboratorio | Hidrolab | Transporte | D.S 90 | DS 90 Tabla 1 | | =1.25', false, 9, 'F5EEF8', '4A235A', 18],
    ];

    rows.forEach(([text, bold, size, bg, fg, height], i) => {
        const cell = ws3.getCell(`A${i+1}`);
        cell.value = text;
        cell.font = { bold, size, name:'Calibri', color:{argb:fg} };
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
        cell.alignment = { vertical:'middle', horizontal:'left', indent:1, wrapText:true };
        ws3.getRow(i+1).height = height || 18;
    });

    // Save
    const out = 'C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx';
    await wb.xlsx.writeFile(out);
    console.log('✅ Guardado:', out);
    console.log('   Fórmulas añadidas: TOTAL SERVICIOS (R4:R104), UF TOTAL (AN4:AN104), UF INDIVIDUAL (I4:I508)');
}

run().catch(console.error);
