const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = 'C:/Users/rdiaz/Desktop/PrAdl/Calendario Puerto Montt Enero 2026.xlsx';
const outputJsonPath = path.join(__dirname, 'src', 'data', 'calendarioEnero2026.json');

try {
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Read the file as JSON with raw values.
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });

    console.log(`Hoja seleccionada: ${sheetName}`);

    // Excel layout info from previous printout:
    // Header row is index 7. (Row 8 in 1-based)
    // Indexes:
    // 2: Fuente Emisora
    // 3: Frecuencia
    // 4: Cantidad
    // 5: Objetivo
    // 6: Sector
    // 7-13: days of week headers
    // 14+: Dates (45597, etc., but with raw: false it might be formatted as date strings if there are dates, but they are just numbers 1..31 in row 10 / index 9)

    // Actually let's look at the header row we captured earlier:
    // Fila 8 (index 7): [<2 empty>, 'Fuente Emisora', 'Frecuencia', 'Cantidad', 'Objetivo', 'Sector', 'VIE', 'SAB', 'DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE'] -> then month days
    // Fila 10 (index 9): [ <7 empty items>, 45597, 45598... ] -> wait, these are dates in number format in the original log. If we use raw: false it might parse them.

    // Let's create an array of objects
    const dataList = [];

    // We noticed the company names are in column index 1.
    // E.g. "Aquagen Chile S.A" in index 1. The following rows have <2 empty items> (so index 1 is empty) until the next company.
    let currentCompany = '';

    // Data seems to start at row index 10 (Fila 11).
    for (let i = 10; i < json.length; i++) {
        const row = json[i];
        if (!row || row.length === 0) continue;

        // Check if there is a company name in column 1
        if (row[1] && row[1].trim() !== '') {
            currentCompany = row[1];
        }

        // If there's a Fuente Emisora in column 2, it's a data row
        if (row[2] && row[2].trim() !== '') {
            const rowData = {
                empresa: currentCompany,
                fuenteEmisora: row[2],
                frecuencia: row[3] || '',
                cantidad: row[4] || '',
                objetivo: row[5] || '',
                sector: row[6] || '',
                dias: {} // maps day of month (e.g. "1") to value (e.g. "X" or content inside)
            };

            // The days of the month start from column 7.
            // Wait, looking at row 10 (index 9), the numbers 45597.. start at column 7. Let's just assume columns 7 to 37 are the days of the month (1 to 31).
            // Actually, in January there are 31 days. So cols 7 to 37.
            for (let d = 0; d < 31; d++) {
                const colIdx = 7 + d;
                const value = row[colIdx];
                if (value) {
                    rowData.dias[(d + 1).toString()] = typeof value === 'string' ? value.trim() : value;
                }
            }

            dataList.push(rowData);
        }
    }

    // Ensure the output directory exists
    const dir = path.dirname(outputJsonPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputJsonPath, JSON.stringify(dataList, null, 2), 'utf-8');
    console.log(`Extracted ${dataList.length} rows to ${outputJsonPath}`);

} catch (err) {
    console.error('Error al leer el excel:', err);
}
