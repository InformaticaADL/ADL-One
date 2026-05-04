const ExcelJS = require('exceljs');

async function run() {
    const workbook = new ExcelJS.Workbook();
    const filePath = 'C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL_test_oficial.xlsx';
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    console.log('Data Validations:');
    // iterate over all cells and find validations
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 5) return; // only check first few rows
        row.eachCell((cell, colNumber) => {
            if (cell.dataValidation) {
                console.log(`Cell ${cell.address}:`, cell.dataValidation);
            }
        });
    });
}

run().catch(console.error);
