import ExcelJS from 'exceljs';

async function run() {
    try {
        const workbook = new ExcelJS.Workbook();
        const filePath = "C:\\Users\\rdiaz\\Desktop\\Copia de Copia de Nueva propuejkbvkj.xlsx";
        await workbook.xlsx.readFile(filePath);
        const sheet = workbook.worksheets[0];
        
        const headers = [];
        sheet.getRow(1).eachCell((cell, colNum) => {
            headers[colNum] = cell.value ? String(cell.value).trim() : `col_${colNum}`;
        });

        console.log("=== HEADERS WITH COL NUMBERS ===");
        headers.forEach((h, idx) => console.log(`${idx}: ${h}`));

        console.log("\n=== SAMPLE ROW 2 ===");
        const row2 = sheet.getRow(2);
        const obj2 = {};
        for (let i = 1; i <= headers.length; i++) {
            const cell = row2.getCell(i);
            // resolve formula result if any
            let val = cell.value;
            if (val && typeof val === 'object' && val.result !== undefined) {
                val = val.result;
            }
            obj2[headers[i] || `col_${i}`] = val;
        }
        console.log(obj2);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
