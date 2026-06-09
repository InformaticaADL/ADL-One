import ExcelJS from 'exceljs';
import path from 'path';

async function readHeaders() {
    const filePath = 'C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL_V2.xlsx';
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const wsFichas = workbook.getWorksheet('FICHAS');
    const wsAnalisis = workbook.getWorksheet('ANALISIS');

    console.log("=== FICHAS HEADERS (Row 3) ===");
    wsFichas.getRow(3).eachCell({includeEmpty: true}, (c, i) => {
        if(c.value) console.log(`${i}: ${c.value}`);
    });

    console.log("\n=== ANALISIS HEADERS (Row 3) ===");
    wsAnalisis.getRow(3).eachCell({includeEmpty: true}, (c, i) => {
        if(c.value) console.log(`${i}: ${c.value}`);
    });
}

readHeaders().catch(console.error);
