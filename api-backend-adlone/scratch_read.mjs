import ExcelJS from './node_modules/exceljs/dist/exceljs.js';

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL_test_oficial.xlsx');
const worksheet = workbook.worksheets[0];

console.log('Sheet Name:', worksheet.name);

// Get headers from first row
const headers = [];
worksheet.getRow(1).eachCell((cell) => {
    headers.push(cell.value);
});
console.log('Headers:', headers);

// Get first data row (row 2)
const row2 = [];
worksheet.getRow(2).eachCell((cell) => {
    row2.push(cell.value);
});
console.log('Row 2 values:', row2);
