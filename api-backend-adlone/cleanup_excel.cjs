const ExcelJS = require('exceljs');

async function run() {
    const workbook = new ExcelJS.Workbook();
    const filePath = 'C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL_test_oficial.xlsx';
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    // Delete columns 15 and 16 (1-indexed)
    // spliceColumns(start, count, ...insert)
    worksheet.spliceColumns(15, 2);

    await workbook.xlsx.writeFile(filePath);
    console.log('✅ Columns 15 and 16 deleted successfully.');
}

run().catch(console.error);
