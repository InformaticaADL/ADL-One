const ExcelJS = require('exceljs');

async function analyzeSheet1() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato Base planilla de carga - ADL (3).xlsx');

    // Focus on Sheet 1 (main ficha sheet)
    const ws = workbook.getWorksheet(1);
    if (!ws) { console.log('No sheet 1'); return; }

    console.log(`HOJA 1: "${ws.name}"`);
    console.log(`Filas totales: ${ws.rowCount}, Columnas: ${ws.columnCount}\n`);

    // Print ALL header rows (usually rows 1-3)
    for (let r = 1; r <= 5; r++) {
        const row = ws.getRow(r);
        console.log(`--- FILA ${r} ---`);
        for (let c = 1; c <= ws.columnCount; c++) {
            const cell = row.getCell(c);
            if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
                const colLetter = colNum2Letter(c);
                console.log(`  ${colLetter}${r}: "${cell.value}"`);
            }
        }
        console.log('');
    }

    // Print a real data row
    console.log('--- PRIMERA FILA DE DATOS (fila 6-10, buscar la primera no vacía) ---');
    for (let r = 6; r <= 15; r++) {
        const row = ws.getRow(r);
        const firstCell = row.getCell(1);
        if (firstCell.value) {
            console.log(`Fila ${r}:`);
            for (let c = 1; c <= ws.columnCount; c++) {
                const cell = row.getCell(c);
                if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
                    console.log(`  ${colNum2Letter(c)}${r}: "${cell.value}"`);
                }
            }
            break;
        }
    }
}

function colNum2Letter(num) {
    let letter = '';
    while (num > 0) {
        const mod = (num - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        num = Math.floor((num - 1) / 26);
    }
    return letter;
}

analyzeSheet1().catch(console.error);
