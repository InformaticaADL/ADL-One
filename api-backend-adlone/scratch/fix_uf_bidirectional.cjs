const ExcelJS = require('exceljs');

async function fixBidirectionalUF() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');

    const ws1 = wb.getWorksheet('FICHAS');
    const ws2 = wb.getWorksheet('ANALISIS');
    const ws3 = wb.getWorksheet('INSTRUCCIONES');

    const BORDER = { top:{style:'thin',color:{argb:'BDC9D7'}}, left:{style:'thin',color:{argb:'BDC9D7'}}, bottom:{style:'thin',color:{argb:'BDC9D7'}}, right:{style:'thin',color:{argb:'BDC9D7'}} };
    const formulaFont = { size:10, name:'Calibri', italic:true, color:{argb:'1A7A1A'} };

    // ── Leer layout real de columnas ────────────────────────────
    const colMap1 = {}, colMap2 = {};
    ws1.getRow(3).eachCell({includeEmpty:false}, (cell, col) => {
        colMap1[String(cell.value||'').replace(/[\r\n🔁]/g,' ').replace(/\s+/g,' ').trim().toUpperCase()] = col;
    });
    ws2.getRow(3).eachCell({includeEmpty:false}, (cell, col) => {
        colMap2[String(cell.value||'').replace(/[\r\n🔁]/g,' ').replace(/\s+/g,' ').trim().toUpperCase()] = col;
    });

    const find = (map, ...kws) => {
        for (const [k,v] of Object.entries(map)) if (kws.every(kw=>k.includes(kw))) return v;
        return null;
    };

    const colFreq    = find(colMap1,'FREC','MUESTREO') || find(colMap1,'FREC');
    const colFactor  = find(colMap1,'FACTOR');
    const colTotalS  = find(colMap1,'TOTAL SERVICIOS') || find(colMap1,'TOTAL');
    const colUfDist  = find(colMap1,'UF TOTAL') || find(colMap1,'UF');   // AO: input del usuario
    const colUfReal  = colUfDist + 1;                                     // AP: SUMIF auto
    const colUfI     = find(colMap2,'UF INDIVIDUAL') || find(colMap2,'UF'); // Sheet2 col I
    const helperCol  = colUfI + 1;                                         // Sheet2 col J (oculta)

    const L = n => { if(!n)return'?'; let l=''; while(n>0){const m=(n-1)%26;l=String.fromCharCode(65+m)+l;n=Math.floor((n-1)/26);}return l; };
    const fFreq=L(colFreq), fFactor=L(colFactor), fTotalS=L(colTotalS);
    const fUfDist=L(colUfDist), fUfReal=L(colUfReal), fUfI=L(colUfI), fHelper=L(helperCol);

    console.log('─── LAYOUT ───');
    console.log(`  FREC MUESTREO:   ${fFreq} (${colFreq})`);
    console.log(`  FACTOR:          ${fFactor} (${colFactor})`);
    console.log(`  TOTAL SERVICIOS: ${fTotalS} (${colTotalS})`);
    console.log(`  UF DISTRIBUIR:   ${fUfDist} (${colUfDist})  ← input usuario`);
    console.log(`  UF TOTAL REAL:   ${fUfReal} (${colUfReal})  ← SUMIF auto (NUEVO)`);
    console.log(`  UF INDIVIDUAL:   ${fUfI} (${colUfI})  (Hoja2)`);

    // ── HOJA 1: Encabezados ─────────────────────────────────────
    const styleHdr = (cell, txt, bg) => {
        cell.value = txt;
        cell.font = { bold:true, color:{argb:'FFFFFF'}, size:10, name:'Calibri' };
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
        cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true };
        cell.border = BORDER;
    };

    // AO = UF DISTRIBUIR (input, azul)
    styleHdr(ws1.getCell(`${fUfDist}3`), '✏️ UF DISTRIBUIR\n(ingrese aquí)', '1A6FBF');
    ws1.getColumn(colUfDist).width = 16;

    // AP = UF TOTAL REAL (sumif, verde)
    styleHdr(ws1.getCell(`${fUfReal}3`), '🔁 UF TOTAL REAL\n(auto)', '0A7A3A');
    ws1.getColumn(colUfReal).width = 16;

    // TOTAL SERVICIOS header
    styleHdr(ws1.getCell(`${fTotalS}3`), '🔁 TOTAL SERVICIOS\n(auto)', '0A7A3A');

    // ── HOJA 1: Fórmulas filas 4-104 ───────────────────────────
    for (let r = 4; r <= 104; r++) {
        // TOTAL SERVICIOS = FREC × FACTOR
        const cTS = ws1.getCell(`${fTotalS}${r}`);
        cTS.value = { formula: `IF(AND(${fFreq}${r}<>"",${fFactor}${r}<>""),${fFreq}${r}*${fFactor}${r},"")` };
        cTS.font = formulaFont;
        cTS.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'EAF7EA'} };
        cTS.alignment = { vertical:'middle', horizontal:'center' };
        cTS.border = BORDER;
        cTS.numFmt = '0';

        // UF DISTRIBUIR (AO): fondo azul claro — entrada manual, sin fórmula
        const cUfD = ws1.getCell(`${fUfDist}${r}`);
        if (cUfD.type !== 6) { // solo si no tiene fórmula del usuario
            cUfD.font = { size:10, name:'Calibri' };
            cUfD.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'EBF5FB'} };
            cUfD.alignment = { vertical:'middle', horizontal:'center' };
            cUfD.border = BORDER;
            cUfD.numFmt = '0.00';
        }

        // UF TOTAL REAL (AP): SUMIF de Hoja2 — siempre refleja la suma actual
        const cUfR = ws1.getCell(`${fUfReal}${r}`);
        cUfR.value = {
            formula: `IF(A${r}="","",IFERROR(SUMIF(ANALISIS!$A:$A,A${r},ANALISIS!$${fUfI}:$${fUfI}),0))`
        };
        cUfR.font = formulaFont;
        cUfR.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'EAF7EA'} };
        cUfR.alignment = { vertical:'middle', horizontal:'center' };
        cUfR.border = BORDER;
        cUfR.numFmt = '0.00';
    }

    // ── HOJA 2: Col helper (oculta) ────────────────────────────
    ws2.getColumn(helperCol).hidden = true;
    ws2.getColumn(helperCol).width  = 0;
    ws2.getCell(`${fHelper}3`).value = '_cnt';

    // ── HOJA 2: UF INDIVIDUAL = UF DISTRIBUIR / count ──────────
    // UF INDIVIDUAL fórmula:
    // - Si hay valor en FICHAS.AO (UF DISTRIBUIR) → divide entre cantidad análisis
    // - El usuario puede sobreescribir la celda manualmente (rompe la fórmula de esa celda)
    // - La columna AP (UF TOTAL REAL) siempre SUMA lo que haya en col I, ya sea fórmula o manual
    for (let r = 4; r <= 508; r++) {
        // helper: cuenta análisis con mismo ID
        const cH = ws2.getCell(`${fHelper}${r}`);
        cH.value = { formula: `IF(A${r}<>"",COUNTIF($A$4:$A$508,A${r}),0)` };
        cH.font = { size:8, color:{argb:'CCCCCC'} };

        // UF INDIVIDUAL
        const cI = ws2.getCell(`${fUfI}${r}`);
        cI.value = {
            formula:
                `IF(A${r}="","",` +
                `IFERROR(` +
                    `IF(VLOOKUP(A${r},FICHAS!$A:$${fUfDist},${colUfDist},0)>0,` +
                        `VLOOKUP(A${r},FICHAS!$A:$${fUfDist},${colUfDist},0)` +
                        `/IF(${fHelper}${r}=0,1,${fHelper}${r}),` +
                    `""),` +
                `""))`
        };
        cI.font = formulaFont;
        cI.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'EAF7EA'} };
        cI.alignment = { vertical:'middle', horizontal:'center' };
        cI.border = BORDER;
        cI.numFmt = '0.00';
        cI.protection = { locked: false };
    }

    // ── Agregar nota explicativa en encabezado UF DISTRIBUIR ───
    ws1.getCell(`${fUfDist}3`).note = {
        texts: [{
            text: 'Ingrese aquí el UF total de la ficha.\nLa Hoja 2 lo distribuirá automáticamente entre todos los análisis.\n\nSi luego cambia un UF individual en Hoja 2, vea la columna "UF TOTAL REAL" que siempre suma los valores actuales.'
        }]
    };
    ws1.getCell(`${fUfReal}3`).note = {
        texts: [{
            text: 'Esta celda siempre muestra la SUMA REAL de todos los UF individuales de Hoja 2.\nUse esta columna para verificar el total cuando modifique UF individuales manualmente.'
        }]
    };

    // ── INSTRUCCIONES ──────────────────────────────────────────
    ws3.spliceRows(1, ws3.rowCount);
    ws3.getColumn(1).width = 95;

    const iRows = [
        ['📖 INSTRUCCIONES — Plantilla Carga Masiva ADL ONE (v4)', true, 13, '1A6FBF', 'FFFFFF', 30],
        ['', false, 10, 'FFFFFF', '000000', 6],
        ['LEYENDA DE COLORES:', true, 10, '444444', 'FFFFFF', 20],
        ['  🟦 Fondo AZUL CLARO = campo de entrada manual (usted escribe)', false, 10, 'EBF5FB', '1A5276', 18],
        ['  🟩 Fondo VERDE CLARO = celda calculada automáticamente (no editar, o hágalo si necesita)', false, 10, 'EAF7EA', '1A7A1A', 18],
        ['', false, 10, 'FFFFFF', '000000', 6],
        [`HOJA 1 "FICHAS" — una fila por ficha:`, true, 11, '0D5C2E', 'FFFFFF', 24],
        [`  • Col ${fTotalS}: TOTAL SERVICIOS 🟩 = FREC.MUESTREO (${fFreq}) × FACTOR (${fFactor}). No editar.`, false, 10, 'F0FFF4', '1B4332', 18],
        [`  • Col ${fUfDist}: UF DISTRIBUIR 🟦 → Ingrese el UF total aquí. La Hoja 2 lo divide automáticamente.`, false, 10, 'F0FFF4', '1B4332', 18],
        [`  • Col ${fUfReal}: UF TOTAL REAL 🟩 → Siempre muestra la SUMA de los UF individuales de la Hoja 2.`, false, 10, 'F0FFF4', '1B4332', 18],
        ['    → Si modifica UF individuales en Hoja 2, revise aquí el nuevo total real.', false, 10, 'F0FFF4', '1B4332', 18],
        ['', false, 10, 'FFFFFF', '000000', 6],
        ['HOJA 2 "ANALISIS" — una fila por análisis:', true, 11, '1A6FBF', 'FFFFFF', 24],
        ['  • ID MUESTRA (col A): debe coincidir EXACTAMENTE con Hoja 1. Repítalo por cada análisis.', false, 10, 'EBF5FB', '1A5276', 18],
        [`  • Col ${fUfI}: UF INDIVIDUAL 🟩 → Auto = UF DISTRIBUIR ÷ cantidad de análisis de esa ficha.`, false, 10, 'EAF7EA', '1A7A1A', 18],
        ['    → Puede sobreescribir cualquier celda con un número (rompe la fórmula de esa celda únicamente).', false, 10, 'EAF7EA', '1A7A1A', 18],
        ['    → El UF TOTAL REAL en Hoja 1 siempre reflejará la suma actualizada.', false, 10, 'EAF7EA', '1A7A1A', 18],
        ['', false, 10, 'FFFFFF', '000000', 6],
        ['FLUJO BIDIRECCIONAL:', true, 10, '7D3C98', 'FFFFFF', 22],
        ['  1️⃣  Ingresa UF DISTRIBUIR = 10  →  Hoja 2: cada análisis recibe 10 ÷ 5 = 2.00 (auto)', false, 10, 'F5EEF8', '4A235A', 18],
        ['  2️⃣  Cambia manualmente DBO5 a 3.50  →  UF TOTAL REAL se actualiza: 2+3.5+2+2+2 = 11.5', false, 10, 'F5EEF8', '4A235A', 18],
        ['  3️⃣  UF DISTRIBUIR NO cambia (es tu referencia de distribución original)', false, 10, 'F5EEF8', '4A235A', 18],
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
    console.log(`   UF DISTRIBUIR (${fUfDist}): entrada manual → distribuye a Hoja 2`);
    console.log(`   UF TOTAL REAL (${fUfReal}): SUMIF de Hoja 2 → refleja suma actual siempre`);
    console.log(`   UF INDIVIDUAL (${fUfI} Hoja2): fórmula sobreescribible → actualiza UF TOTAL REAL`);
}

fixBidirectionalUF().catch(console.error);
