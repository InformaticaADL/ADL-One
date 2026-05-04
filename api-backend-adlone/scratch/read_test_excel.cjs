const ExcelJS = require('exceljs');

async function readTestExcel() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL_test.xlsx');
    
    const wsFichas = workbook.getWorksheet('FICHAS');
    console.log('--- HOJA FICHAS ---');
    const row3 = wsFichas.getRow(3);
    const headers = [];
    row3.eachCell((cell, i) => { headers[i] = cell.value; });
    
    const row4 = wsFichas.getRow(4);
    row4.eachCell((cell, i) => {
        console.log(`${headers[i]} [Col ${i}]: "${cell.value}"`);
    });

    const wsAnalisis = workbook.getWorksheet('ANALISIS');
    console.log('\n--- HOJA ANALISIS (First 5 rows) ---');
    for (let i = 4; i <= 8; i++) {
        const r = wsAnalisis.getRow(i);
        console.log(`Fila ${i}: ${r.getCell(1).value} | ${r.getCell(2).value} | ${r.getCell(3).value} | ${r.getCell(4).value}`);
    }
}

readTestExcel().catch(console.error);
