const ExcelJS = require('exceljs');

async function checkFormulas() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');

    const ws1 = wb.getWorksheet('FICHAS');
    const ws2 = wb.getWorksheet('ANALISIS');

    console.log("=== HOJA 1: FICHAS (Fila 4) ===");
    // 40 = AN, 41 = AO (UF Distribuir), 42 = AP (UF Total Real)
    // Busquemos las celdas de UF por nombre en fila 3
    let colUfDist = 0, colUfReal = 0, colSvc = 0;
    ws1.getRow(3).eachCell((c, i) => {
        const val = String(c.value||'').toUpperCase();
        if (val.includes('TOTAL SERVICIOS')) colSvc = i;
        if (val.includes('UF DISTRIBUIR')) colUfDist = i;
        if (val.includes('UF TOTAL REAL')) colUfReal = i;
    });
    
    console.log(`Col Total Svc = ${colSvc}, Col Uf Dist = ${colUfDist}, Col Uf Real = ${colUfReal}`);
    const cellTS = ws1.getCell(4, colSvc);
    const cellUD = ws1.getCell(4, colUfDist);
    const cellUR = ws1.getCell(4, colUfReal);
    
    console.log(`TOTAL SVC: type=${cellTS.type}, formula=${cellTS.formula}, value=${cellTS.value}`);
    console.log(`UF DISTRI: type=${cellUD.type}, formula=${cellUD.formula}, value=${cellUD.value}`);
    console.log(`UF REAL:   type=${cellUR.type}, formula=${cellUR.formula}, value=${cellUR.value}`);

    console.log("\n=== HOJA 2: ANALISIS (Fila 4) ===");
    let colUfI = 0, colUfM = 0, colHelp = 0;
    ws2.getRow(3).eachCell((c, i) => {
        const val = String(c.value||'').toUpperCase();
        if (val.includes('UF INDIVIDUAL')) colUfI = i;
        if (val.includes('UF MANUAL')) colUfM = i;
        if (val.includes('_CNT')) colHelp = i;
    });

    console.log(`Col Uf Ind = ${colUfI}, Col Uf Man = ${colUfM}, Col Helper = ${colHelp}`);
    const cellUI = ws2.getCell(4, colUfI);
    const cellUM = ws2.getCell(4, colUfM);
    const cellH = ws2.getCell(4, colHelp);

    console.log(`UF INDIV: type=${cellUI.type}, formula=${cellUI.formula}, value=${JSON.stringify(cellUI.value)}`);
    console.log(`UF MANUAL:type=${cellUM.type}, formula=${cellUM.formula}, value=${cellUM.value}`);
    console.log(`HELPER:   type=${cellH.type}, formula=${cellH.formula}, value=${JSON.stringify(cellH.value)}`);
}

checkFormulas().catch(console.error);
