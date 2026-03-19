console.log('1. Loading XLSXChart...');
const XLSXChart = require('xlsx-chart');
console.log('2. Loading fs...');
const fs = require('fs');

console.log('3. Instantiating xlsxChart...');
const xlsxChart = new XLSXChart();

const opts = {
    titles: ['Cantidad'],
    fields: ['Test'],
    charts: [
        {
            chart: 'column',
            chartTitle: 'Prueba',
            titles: ['Cantidad'],
            fields: ['Activo', 'Inactivo'],
            data: { 'Cantidad': { 'Activo': 10, 'Inactivo': 5 } }
        }
    ]
};

console.log('4. Calling generate...');
xlsxChart.generate(opts, (err, buffer) => {
    console.log('5. Generate callback reached. error:', err);
    if (err) {
        console.error('Error details:', err);
        process.exit(1);
    }
    fs.writeFileSync('test_simple_mult.xlsx', buffer);
    console.log('6. File saved successfully!');
});
console.log('7. Sync flow finished, waiting for callback...');
