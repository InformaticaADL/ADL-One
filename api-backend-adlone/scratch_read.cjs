const ExcelJS = require('exceljs');

async function run() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL_test_oficial.xlsx');
    const worksheet = workbook.worksheets[0];

    console.log('Headers (Row 3):');
    const headers = worksheet.getRow(3);
    headers.eachCell({includeEmpty: true}, (cell, colNumber) => {
        if (cell.value) console.log(`${colNumber}: ${cell.value}`);
    });
}

run().catch(console.error);
