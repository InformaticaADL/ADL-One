const ExcelJS = require('exceljs');

async function diagnose() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');

    const ws1 = wb.getWorksheet('FICHAS');
    const ws2 = wb.getWorksheet('ANALISIS');

    // Check row 4 formulas in both sheets
    console.log('=== HOJA 1 - Fila 4 fórmulas ===');
    ws1.getRow(4).eachCell({ includeEmpty: false }, (cell, col) => {
        if (cell.type === 6) console.log(`  Col ${col}: formula="${cell.formula}" value="${cell.value}"`);
        else if (cell.value) console.log(`  Col ${col}: value="${cell.value}"`);
    });

    console.log('\n=== HOJA 1 - Col R (18) rows 4-6 ===');
    for (let r = 4; r <= 6; r++) {
        const c = ws1.getCell(`R${r}`);
        console.log(`  R${r}: type=${c.type} formula="${c.formula}" value="${c.value}"`);
    }

    console.log('\n=== HOJA 1 - Col AN (40) rows 4-6 ===');
    for (let r = 4; r <= 6; r++) {
        const c = ws1.getCell(`AN${r}`);
        console.log(`  AN${r}: type=${c.type} formula="${c.formula}" value="${c.value}"`);
    }

    console.log('\n=== HOJA 2 - Col I (9) rows 4-10 ===');
    for (let r = 4; r <= 12; r++) {
        const c = ws2.getCell(`I${r}`);
        console.log(`  I${r}: type=${c.type} formula="${c.formula}" value="${c.value}"`);
    }

    console.log('\n=== HOJA 2 - Col J (10) rows 4-6 ===');
    for (let r = 4; r <= 6; r++) {
        const c = ws2.getCell(`J${r}`);
        console.log(`  J${r}: type=${c.type} formula="${c.formula}" value="${c.value}" hidden=${ws2.getColumn(10).hidden}`);
    }
}

diagnose().catch(console.error);
