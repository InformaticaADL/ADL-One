const ExcelJS = require('exceljs');

async function fixLockAndClear() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');

    const ws1 = wb.getWorksheet('FICHAS');
    const ws2 = wb.getWorksheet('ANALISIS');

    // ── Detectar columnas
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

    // Primero quitamos la protección si existía
    ws1.unprotect();
    ws2.unprotect();

    // ---- HOJA 1 ----
    for (let r = 1; r <= 150; r++) {
        const row = ws1.getRow(r);
        for (let c = 1; c <= 50; c++) {
            const cell = row.getCell(c);
            // IMPORTANTE: Desbloquear explicitamente celda por celda
            cell.protection = { locked: false };
            
            // Bloquear cabeceras (filas 1 a 3)
            if (r <= 3) {
                cell.protection = { locked: true };
            }
        }
        
        if (r > 3 && r <= 104) {
            // Fórmulas
            ws1.getCell(r, colTotalS).protection = { locked: true };
            ws1.getCell(r, colUfReal).protection = { locked: true };
            
            // Borrar valores ingresados manualmente en UF DISTRIBUIR
            const cellDist = ws1.getCell(r, colUfDist);
            if (cellDist.type !== 6) { // Si no es fórmula
                cellDist.value = null;
            }
        }
    }

    // ---- HOJA 2 ----
    for (let r = 1; r <= 550; r++) {
        const row = ws2.getRow(r);
        for (let c = 1; c <= 20; c++) {
            const cell = row.getCell(c);
            cell.protection = { locked: false };
            
            if (r <= 3) {
                cell.protection = { locked: true };
            }
        }
        
        if (r > 3 && r <= 508) {
            // Fórmulas
            ws2.getCell(r, colUfI).protection = { locked: true };
            ws2.getCell(r, colHelper).protection = { locked: true };
            
            // Borrar valores ingresados en UF MANUAL
            const cellMan = ws2.getCell(r, colUfM);
            if (cellMan.type !== 6) { // Si no es fórmula
                cellMan.value = null;
            }
        }
    }

    // Volver a proteger las hojas
    const protectOptions = {
        selectLockedCells: true, selectUnlockedCells: true,
        formatCells: true, formatColumns: true, formatRows: true,
        insertColumns: false, insertRows: true, insertHyperlinks: true,
        deleteColumns: false, deleteRows: true, sort: true, autoFilter: true
    };
    
    ws1.protect('adl123', protectOptions);
    ws2.protect('adl123', protectOptions);

    await wb.xlsx.writeFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');
    console.log('✅ Archivo corregido, valores manuales borrados y protección correcta a nivel de celda.');
}

fixLockAndClear().catch(console.error);
