const ExcelJS = require('exceljs');

async function lockFormulas() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');

    const ws1 = wb.getWorksheet('FICHAS');
    const ws2 = wb.getWorksheet('ANALISIS');

    // ── Detectar columnas ─────────────────────────────────────
    const cm1={}, cm2={};
    ws1.getRow(3).eachCell({includeEmpty:false},(c,i)=>{ cm1[String(c.value||'').replace(/[\r\n🔁✏️]/g,' ').replace(/\s+/g,' ').trim().toUpperCase()]=i; });
    ws2.getRow(3).eachCell({includeEmpty:false},(c,i)=>{ cm2[String(c.value||'').replace(/[\r\n🔁✏️]/g,' ').replace(/\s+/g,' ').trim().toUpperCase()]=i; });

    const find = (map,...kws) => { for(const[k,v]of Object.entries(map)) if(kws.every(w=>k.includes(w))) return v; return null; };

    const colFreq   = find(cm1,'FREC','MUESTREO') || find(cm1,'FREC');
    const colFactor = find(cm1,'FACTOR');
    const colTotalS = find(cm1,'TOTAL SERVICIOS') || find(cm1,'TOTAL');
    const colUfDist = find(cm1,'UF DISTRIBUIR') || find(cm1,'UF TOTAL') || find(cm1,'UF');
    const colUfReal = colUfDist + 1; // AP
    
    const colUfI    = find(cm2,'UF INDIVIDUAL') || find(cm2,'UF'); // I
    const colUfM    = colUfI + 1;   // J (UF MANUAL)
    const colHelper = colUfM + 1;   // K (Helper)

    const L = n => { if(!n)return'?'; let l=''; while(n>0){const m=(n-1)%26;l=String.fromCharCode(65+m)+l;n=Math.floor((n-1)/26);}return l; };

    // ── Proteger Hoja 1 ───────────────────────────────────────
    // Desbloquear todas las columnas (1 a 100)
    for(let i=1; i<=100; i++) {
        ws1.getColumn(i).protection = { locked: false };
    }

    // Bloquear columnas específicas (Fórmulas)
    ws1.getColumn(colTotalS).protection = { locked: true };
    ws1.getColumn(colUfReal).protection = { locked: true };

    // Bloquear filas 1-3 (headers y titulos)
    for(let r=1; r<=3; r++) {
        ws1.getRow(r).protection = { locked: true };
    }

    // Re-aplicar formulas filas 4-104
    for (let r = 4; r <= 104; r++) {
        ws1.getCell(r, colTotalS).value = { formula: `IF(AND(${L(colFreq)}${r}<>"",${L(colFactor)}${r}<>""),${L(colFreq)}${r}*${L(colFactor)}${r},"")` };
        ws1.getCell(r, colUfReal).value = { formula: `IF(A${r}="","",IFERROR(SUMIF(ANALISIS!$A:$A,A${r},ANALISIS!$${L(colUfI)}:$${L(colUfI)}),0))` };
    }

    
    // Proteger hoja
    ws1.protect('adl123', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: true,
        formatColumns: true,
        formatRows: true,
        insertColumns: false,
        insertRows: true,
        insertHyperlinks: true,
        deleteColumns: false,
        deleteRows: true,
        sort: true,
        autoFilter: true
    });

    // ── Proteger Hoja 2 ───────────────────────────────────────
    // Desbloquear todas las columnas (1 a 100)
    for(let i=1; i<=100; i++) {
        ws2.getColumn(i).protection = { locked: false };
    }

    // Bloquear columnas específicas (Fórmulas)
    ws2.getColumn(colUfI).protection = { locked: true };
    ws2.getColumn(colHelper).protection = { locked: true };

    // Bloquear filas 1-3
    for(let r=1; r<=3; r++) {
        ws2.getRow(r).protection = { locked: true };
    }

    // Re-aplicar formulas filas 4-508
    for (let r = 4; r <= 508; r++) {
        ws2.getCell(r, colUfI).value = {
            formula: 
                `IF(A${r}="","",` +
                `IF(${L(colUfM)}${r}<>"",${L(colUfM)}${r},` +
                `IFERROR(` +
                    `VLOOKUP(A${r},FICHAS!$A:$${L(colUfDist)},${colUfDist},0)` +
                    `/IF(${L(colHelper)}${r}=0,1,${L(colHelper)}${r}),` +
                `"")))`
        };
        ws2.getCell(r, colHelper).value = { formula: `IF(A${r}<>"",COUNTIF($A$4:$A$508,A${r}),0)` };
    }

    // Proteger hoja
    ws2.protect('adl123', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: true,
        formatColumns: true,
        formatRows: true,
        insertColumns: false,
        insertRows: true,
        insertHyperlinks: true,
        deleteColumns: false,
        deleteRows: true,
        sort: true,
        autoFilter: true
    });

    await wb.xlsx.writeFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');
    console.log('✅ Archivo protegido correctamente.');
}

lockFormulas().catch(console.error);
