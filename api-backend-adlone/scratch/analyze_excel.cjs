const ExcelJS = require('exceljs');
const path = require('path');

async function analyzeExcel() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato Base planilla de carga - ADL (3).xlsx');

    workbook.eachSheet((sheet, id) => {
        console.log(`\n========== HOJA ${id}: "${sheet.name}" ==========`);
        console.log(`  Filas: ${sheet.rowCount}, Columnas: ${sheet.columnCount}`);

        // Print headers (row 1)
        const row1 = sheet.getRow(1);
        const row2 = sheet.getRow(2);
        const row3 = sheet.getRow(3);

        console.log('\n--- FILA 1 (posibles encabezados) ---');
        row1.eachCell({ includeEmpty: true }, (cell, col) => {
            if (cell.value) console.log(`  Col ${col} (${String.fromCharCode(64+col)}): "${cell.value}"`);
        });
        console.log('\n--- FILA 2 ---');
        row2.eachCell({ includeEmpty: true }, (cell, col) => {
            if (cell.value) console.log(`  Col ${col} (${String.fromCharCode(64+col)}): "${cell.value}"`);
        });
        console.log('\n--- FILA 3 ---');
        row3.eachCell({ includeEmpty: true }, (cell, col) => {
            if (cell.value) console.log(`  Col ${col} (${String.fromCharCode(64+col)}): "${cell.value}"`);
        });

        // Print a few data rows
        console.log('\n--- FILA 4 (primer dato) ---');
        const row4 = sheet.getRow(4);
        row4.eachCell({ includeEmpty: true }, (cell, col) => {
            if (cell.value) console.log(`  Col ${col} (${String.fromCharCode(64+col)}): "${cell.value}"`);
        });
        console.log('\n--- FILA 5 ---');
        const row5 = sheet.getRow(5);
        row5.eachCell({ includeEmpty: true }, (cell, col) => {
            if (cell.value) console.log(`  Col ${col} (${String.fromCharCode(64+col)}): "${cell.value}"`);
        });
    });
}

analyzeExcel().catch(console.error);
