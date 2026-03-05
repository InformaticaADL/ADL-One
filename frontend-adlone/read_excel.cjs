const xlsx = require('xlsx');

try {
    const workbook = xlsx.readFile('C:/Users/rdiaz/Desktop/PrAdl/Calendario Puerto Montt Enero 2026.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`Hoja seleccionada: ${sheetName}`);
    console.log('--- Primeras 20 filas (estructura) ---');
    for (let i = 0; i < 50; i++) {
        if (json[i]) {
            console.log(`Fila ${i + 1}:`, json[i].slice(0, 15));
        }
    }
} catch (err) {
    console.error('Error al leer el excel:', err);
}
