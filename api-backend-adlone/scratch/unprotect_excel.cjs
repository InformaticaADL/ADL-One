const ExcelJS = require('exceljs');

async function unprotectExcel() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');

    const ws1 = wb.getWorksheet('FICHAS');
    const ws2 = wb.getWorksheet('ANALISIS');

    // Quitar la protección de ambas hojas completamente
    ws1.unprotect();
    ws2.unprotect();

    // Resetear el estado de protección en cada celda solo por si acaso
    ws1.eachRow((row) => {
        row.eachCell({includeEmpty: true}, (cell) => {
            if (cell.protection) {
                cell.protection = undefined;
            }
        });
    });

    ws2.eachRow((row) => {
        row.eachCell({includeEmpty: true}, (cell) => {
            if (cell.protection) {
                cell.protection = undefined;
            }
        });
    });

    await wb.xlsx.writeFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');
    console.log('✅ Archivo completamente desprotegido.');
}

unprotectExcel().catch(console.error);
