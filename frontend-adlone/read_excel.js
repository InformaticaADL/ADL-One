const xlsx = require('xlsx');
const fs = require('fs');

const filePath = 'C:\\Users\\rdiaz\\Desktop\\PrAdl\\Calendario Puerto Montt Enero 2026.xlsx';
const workbook = xlsx.readFile(filePath);

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log("Sheet Name:", sheetName);
console.log("Total Rows:", data.length);
console.log("First 15 Rows:");
// Print first 15 rows to understand the structure
data.slice(0, 15).forEach((row, i) => {
    console.log(`[Row ${i}]`, row);
});
