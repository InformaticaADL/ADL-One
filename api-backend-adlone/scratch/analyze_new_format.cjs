const ExcelJS = require('exceljs');

async function analyzeCurrentFormat() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');

    workbook.eachSheet((sheet) => {
        console.log(`\n========== HOJA: "${sheet.name}" (${sheet.rowCount} filas) ==========`);
        // Headers row 3
        const hr = sheet.getRow(3);
        console.log('ENCABEZADOS (fila 3):');
        hr.eachCell({ includeEmpty: false }, (cell, col) => {
            console.log(`  Col ${col} [${colLetter(col)}]: "${cell.value}"`);
        });
        // Example row 4
        const er = sheet.getRow(4);
        console.log('\nEJEMPLO (fila 4):');
        er.eachCell({ includeEmpty: false }, (cell, col) => {
            console.log(`  Col ${col} [${colLetter(col)}]: "${cell.value}"`);
        });
        // Check if there are formulas
        console.log('\nFÓRMULAS encontradas:');
        sheet.eachRow((row, rIdx) => {
            row.eachCell({ includeEmpty: false }, (cell, cIdx) => {
                if (cell.type === 6 /* formula */) {
                    console.log(`  [${colLetter(cIdx)}${rIdx}] = ${cell.formula}`);
                }
            });
        });
    });
}

function colLetter(num) {
    let l = '';
    while (num > 0) { const m = (num-1)%26; l = String.fromCharCode(65+m)+l; num = Math.floor((num-1)/26); }
    return l;
}

analyzeCurrentFormat().catch(console.error);
