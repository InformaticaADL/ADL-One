import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanTemplate() {
    const filePath = path.join(__dirname, '../../Formato_Carga_Masiva_ADL_test_oficial.xlsx');
    console.log('Reading from:', filePath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const wsFichas = workbook.getWorksheet('FICHAS');
    const wsAnalisis = workbook.getWorksheet('ANALISIS');

    // Clear data from FICHAS (row 4 to 2000)
    for (let r = 4; r <= 2000; r++) {
        wsFichas.getRow(r).eachCell((cell, colNum) => {
            cell.value = null;
        });
    }

    // Clear data from ANALISIS (row 4 to 4000)
    for (let r = 4; r <= 4000; r++) {
        wsAnalisis.getRow(r).eachCell((cell, colNum) => {
            cell.value = null;
        });
    }

    await workbook.xlsx.writeFile(filePath);
    console.log('Template cleaned successfully!');
}

cleanTemplate().catch(console.error);
