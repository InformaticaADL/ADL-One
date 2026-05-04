const ExcelJS = require('exceljs');

async function run() {
    const workbook = new ExcelJS.Workbook();
    const filePath = 'C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL_test_oficial.xlsx';
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    // Find the Factor column
    const headerRow = worksheet.getRow(3);
    let colFactor = 15; // default O
    headerRow.eachCell({includeEmpty: true}, (cell, i) => {
        const val = String(cell.value || '').toUpperCase();
        if (val.includes('FACTOR')) colFactor = i;
    });

    console.log(`Removing validations from column ${colFactor}...`);

    // Remove validations from the entire column range (4 to 200)
    for (let r = 4; r <= 200; r++) {
        const cell = worksheet.getCell(r, colFactor);
        cell.dataValidation = null;
    }

    await workbook.xlsx.writeFile(filePath);
    console.log('✅ Data validations removed from Factor column.');
}

run().catch(console.error);
