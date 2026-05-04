const ExcelJS = require('exceljs');

async function fixUfProper() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');

    const ws1 = wb.getWorksheet('FICHAS');
    const ws2 = wb.getWorksheet('ANALISIS');
    const ws3 = wb.getWorksheet('INSTRUCCIONES');

    const BORDER = {
        top:{style:'thin',color:{argb:'BDC9D7'}}, left:{style:'thin',color:{argb:'BDC9D7'}},
        bottom:{style:'thin',color:{argb:'BDC9D7'}}, right:{style:'thin',color:{argb:'BDC9D7'}}
    };
    const fmtFont   = { size:10, name:'Calibri', italic:true, color:{argb:'1A7A1A'} };
    const normFont  = { size:10, name:'Calibri' };
    const hdrBlue   = { bold:true, color:{argb:'FFFFFF'}, size:10, name:'Calibri' };
    const hdrGreen  = { bold:true, color:{argb:'FFFFFF'}, size:10, name:'Calibri' };

    const L = n => { if(!n)return'?'; let l=''; while(n>0){const m=(n-1)%26;l=String.fromCharCode(65+m)+l;n=Math.floor((n-1)/26);}return l; };

    // ── Detectar columnas reales ─────────────────────────────────
    const cm1={}, cm2={};
    ws1.getRow(3).eachCell({includeEmpty:false},(c,i)=>{ cm1[String(c.value||'').replace(/[\r\n🔁✏️]/g,' ').replace(/\s+/g,' ').trim().toUpperCase()]=i; });
    ws2.getRow(3).eachCell({includeEmpty:false},(c,i)=>{ cm2[String(c.value||'').replace(/[\r\n🔁✏️]/g,' ').replace(/\s+/g,' ').trim().toUpperCase()]=i; });

    const find = (map,...kws) => { for(const[k,v]of Object.entries(map)) if(kws.every(w=>k.includes(w))) return v; return null; };

    const colFreq   = find(cm1,'FREC','MUESTREO') || find(cm1,'FREC');
    const colFactor = find(cm1,'FACTOR');
    const colTotalS = find(cm1,'TOTAL SERVICIOS') || find(cm1,'TOTAL');
    const colUfDist = find(cm1,'UF DISTRIBUIR') || find(cm1,'UF TOTAL') || find(cm1,'UF');
    const colUfReal = colUfDist + 1; // AP
    // Sheet 2 columns
    const colUfI    = find(cm2,'UF INDIVIDUAL') || find(cm2,'UF'); // col 9 (I)
    const colUfM    = colUfI + 1;   // col 10 (J) = UF MANUAL (nueva / reemplaza helper)
    const colHelper = colUfM + 1;   // col 11 (K) = count helper oculto

    const fFreq=L(colFreq), fFactor=L(colFactor), fTotalS=L(colTotalS);
    const fUfDist=L(colUfDist), fUfReal=L(colUfReal);
    const fUfI=L(colUfI), fUfM=L(colUfM), fHelper=L(colHelper);

    console.log('LAYOUT DETECTADO:');
    console.log(`  FREC: ${fFreq}  FACTOR: ${fFactor}  TOTAL SVC: ${fTotalS}`);
    console.log(`  UF DISTRIBUIR: ${fUfDist}  UF TOTAL REAL: ${fUfReal}`);
    console.log(`  Hoja2 — UF INDIVIDUAL: ${fUfI}  UF MANUAL: ${fUfM}  Helper: ${fHelper}`);

    // ════════════════════════════════════════════════════════════
    // HOJA 1 — Headers y fórmulas
    // ════════════════════════════════════════════════════════════
    const setHdr = (cell, txt, bg, note) => {
        cell.value = txt;
        cell.font = { bold:true, color:{argb:'FFFFFF'}, size:10, name:'Calibri' };
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
        cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true };
        cell.border = BORDER;
        if(note) cell.note = { texts:[{text:note}] };
    };

    setHdr(ws1.getCell(`${fTotalS}3`),  '🔁 TOTAL SERVICIOS\n(auto)',         '0A7A3A', 'Auto = FREC.MUESTREO × FACTOR');
    setHdr(ws1.getCell(`${fUfDist}3`),  '✏️ UF DISTRIBUIR\n(escribe aquí)',   '1A5276', 'Ingresa el UF total de la ficha.\nLa Hoja 2 lo distribuirá automáticamente.\nVea col AP para el total real actualizado.');
    setHdr(ws1.getCell(`${fUfReal}3`),  '🔁 UF TOTAL REAL\n(suma auto)',      '0A7A3A', 'Suma automática de todos los UF INDIVIDUAL de la Hoja 2.\nSe actualiza cada vez que cambia un UF individual o manual.');

    ws1.getColumn(colUfDist).width = 16;
    ws1.getColumn(colUfReal).width = 16;

    for (let r = 4; r <= 104; r++) {
        // TOTAL SERVICIOS
        const cTS = ws1.getCell(`${fTotalS}${r}`);
        cTS.value = { formula: `IF(AND(${fFreq}${r}<>"",${fFactor}${r}<>""),${fFreq}${r}*${fFactor}${r},"")` };
        cTS.font = fmtFont;
        cTS.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'EAF7EA'} };
        cTS.alignment = { vertical:'middle', horizontal:'center' };
        cTS.border = BORDER;
        cTS.numFmt = '0';

        // UF DISTRIBUIR — solo formato, sin fórmula (input manual)
        const cD = ws1.getCell(`${fUfDist}${r}`);
        if(cD.type !== 6) { // no tocar si ya tiene fórmula del usuario
            cD.font = normFont;
            cD.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'D6EAF8'} };
            cD.alignment = { vertical:'middle', horizontal:'center' };
            cD.border = BORDER;
            cD.numFmt = '0.00';
        }

        // UF TOTAL REAL — SUMIF de col UF INDIVIDUAL de Hoja2
        const cR = ws1.getCell(`${fUfReal}${r}`);
        cR.value = { formula: `IF(A${r}="","",IFERROR(SUMIF(ANALISIS!$A:$A,A${r},ANALISIS!$${fUfI}:$${fUfI}),0))` };
        cR.font = fmtFont;
        cR.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'EAF7EA'} };
        cR.alignment = { vertical:'middle', horizontal:'center' };
        cR.border = BORDER;
        cR.numFmt = '0.00';
    }

    // ════════════════════════════════════════════════════════════
    // HOJA 2 — Tres columnas: I(auto) J(manual override) K(helper)
    // ════════════════════════════════════════════════════════════

    // Headers
    setHdr(ws2.getCell(`${fUfI}3`), '🔁 UF INDIVIDUAL\n(auto)', '0A7A3A',
        'Calculado automáticamente.\nNO escribir aquí.\nUse la col siguiente (UF MANUAL) para sobreescribir.');
    setHdr(ws2.getCell(`${fUfM}3`), '✏️ UF MANUAL\n(escribe aquí si quieres cambiar)', '1A5276',
        'Escribe aquí el UF individual si quieres sobreescribir el valor automático.\nSi dejas vacío, UF INDIVIDUAL usa el cálculo automático.');
    ws2.getCell(`${fHelper}3`).value = '_cnt'; // helper oculto

    ws2.getColumn(colUfI).width  = 16;
    ws2.getColumn(colUfM).width  = 22;
    ws2.getColumn(colHelper).hidden = true;
    ws2.getColumn(colHelper).width  = 0;

    for (let r = 4; r <= 508; r++) {
        // Helper K: cuenta análisis con mismo ID en rango limitado (más rápido)
        const cK = ws2.getCell(`${fHelper}${r}`);
        cK.value = { formula: `IF(A${r}<>"",COUNTIF($A$4:$A$508,A${r}),0)` };
        cK.font = { size:8, color:{argb:'CCCCCC'} };

        // UF INDIVIDUAL (I) — SIEMPRE FÓRMULA:
        // = SI hay UF MANUAL (J) → usa J
        // = SI NO hay J → usa UF DISTRIBUIR de Hoja1 / count
        const cI = ws2.getCell(`${fUfI}${r}`);
        cI.value = {
            formula:
                `IF(A${r}="","",` +
                `IF(${fUfM}${r}<>"",${fUfM}${r},` +           // ← usuario escribió en J
                `IFERROR(` +
                    `VLOOKUP(A${r},FICHAS!$A:$${fUfDist},${colUfDist},0)` +
                    `/IF(${fHelper}${r}=0,1,${fHelper}${r}),` + // ← distribución auto
                `"")))`
        };
        cI.font = fmtFont;
        cI.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'EAF7EA'} };
        cI.alignment = { vertical:'middle', horizontal:'center' };
        cI.border = BORDER;
        cI.numFmt = '0.00';

        // UF MANUAL (J) — entrada manual, por defecto vacío
        const cJ = ws2.getCell(`${fUfM}${r}`);
        if(cJ.type !== 6 && !cJ.value) { // no tocar si ya tiene algo
            cJ.font = normFont;
            cJ.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'D6EAF8'} };
            cJ.alignment = { vertical:'middle', horizontal:'center' };
            cJ.border = BORDER;
            cJ.numFmt = '0.00';
        }
    }

    // ════════════════════════════════════════════════════════════
    // INSTRUCCIONES
    // ════════════════════════════════════════════════════════════
    ws3.spliceRows(1, ws3.rowCount);
    ws3.getColumn(1).width = 95;

    const rows = [
        ['📖 INSTRUCCIONES — Plantilla Carga Masiva ADL ONE (v5)', true,13,'1A6FBF','FFFFFF',30],
        ['', false,10,'FFFFFF','000000',6],
        ['LEYENDA:', true,10,'444444','FFFFFF',20],
        ['  🟦 Fondo AZUL = campo de ENTRADA MANUAL (escribe tú)', false,10,'D6EAF8','1A5276',18],
        ['  🟩 Fondo VERDE = campo AUTOMÁTICO (no escribir aquí, se calcula solo)', false,10,'EAF7EA','1A7A1A',18],
        ['', false,10,'FFFFFF','000000',6],
        [`HOJA 1 "FICHAS":`, true,11,'0D5C2E','FFFFFF',24],
        [`  • Col ${fTotalS} TOTAL SERVICIOS 🟩: Auto = FREC.MUESTREO × FACTOR. No editar.`, false,10,'F0FFF4','1B4332',18],
        [`  • Col ${fUfDist} UF DISTRIBUIR 🟦: Escribe aquí el UF total → Hoja 2 lo distribuye automáticamente.`, false,10,'F0FFF4','1B4332',18],
        [`  • Col ${fUfReal} UF TOTAL REAL 🟩: Suma automática de los UF individuales reales de Hoja 2.`, false,10,'F0FFF4','1B4332',18],
        ['    → Esta columna se actualiza cada vez que cambias un UF manual en Hoja 2.', false,10,'F0FFF4','1B4332',18],
        ['', false,10,'FFFFFF','000000',6],
        ['HOJA 2 "ANALISIS":', true,11,'1A6FBF','FFFFFF',24],
        ['  • ID MUESTRA (col A): Debe coincidir EXACTAMENTE con Hoja 1.', false,10,'EBF5FB','1A5276',18],
        [`  • Col ${fUfI} UF INDIVIDUAL 🟩: Calculado automáticamente. NO escribir aquí.`, false,10,'EAF7EA','1A7A1A',18],
        [`  • Col ${fUfM} UF MANUAL 🟦: Si quieres cambiar el UF de un análisis, escríbelo AQUÍ.`, false,10,'D6EAF8','1A5276',18],
        ['    → UF INDIVIDUAL leerá automáticamente lo que escribas en UF MANUAL.', false,10,'D6EAF8','1A5276',18],
        ['    → UF TOTAL REAL en Hoja 1 se actualizará con la suma real al instante.', false,10,'D6EAF8','1A5276',18],
        ['    → Para volver al automático: simplemente borra el contenido de la celda UF MANUAL.', false,10,'D6EAF8','1A5276',18],
        ['', false,10,'FFFFFF','000000',6],
        ['EJEMPLO PASO A PASO:', true,10,'7D3C98','FFFFFF',22],
        ['  1. Hoja 1: Escribe UF DISTRIBUIR = 10 para ficha M-001 (5 análisis)', false,9,'F5EEF8','4A235A',18],
        ['  2. Hoja 2: UF INDIVIDUAL = 2.00 en todos los análisis (10/5) ← automático 🟩', false,9,'F5EEF8','4A235A',18],
        ['  3. Hoja 2: Escribe 3.50 en UF MANUAL del análisis DBO5 🟦', false,9,'F5EEF8','4A235A',18],
        ['  4. UF INDIVIDUAL de DBO5 cambia a 3.50 automáticamente 🟩', false,9,'F5EEF8','4A235A',18],
        ['  5. Hoja 1: UF TOTAL REAL pasa de 10.00 a 11.50 automáticamente 🟩', false,9,'F5EEF8','4A235A',18],
        ['  6. Para revertir DBO5: borra la celda UF MANUAL → vuelve a 2.00', false,9,'F5EEF8','4A235A',18],
    ];

    rows.forEach(([text,bold,size,bg,fg,height],i)=>{
        const cell = ws3.getCell(`A${i+1}`);
        cell.value = text;
        cell.font = { bold, size, name:'Calibri', color:{argb:fg} };
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
        cell.alignment = { vertical:'middle', horizontal:'left', indent:1, wrapText:true };
        ws3.getRow(i+1).height = height||18;
    });

    await wb.xlsx.writeFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');
    console.log('✅ Listo. Solución implementada:');
    console.log('   Hoja2 col I (UF INDIVIDUAL) = siempre fórmula, nunca se pierde');
    console.log('   Hoja2 col J (UF MANUAL)     = usuario escribe aquí para sobreescribir');
    console.log('   Hoja1 col AP (UF TOTAL REAL) = SUMIF de col I, siempre actualizado');
}

fixUfProper().catch(console.error);
