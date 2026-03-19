const XLSXChart = require('xlsx-chart');
const fs = require('fs');

const xlsxChart = new XLSXChart();
const opts = {
    charts: [
        {
            chart: 'column',
            chartTitle: 'Estado de Equipos',
            titles: ['Cantidad'],
            fields: ['Activo', 'Inactivo'],
            data: { 'Cantidad': { 'Activo': 10, 'Inactivo': 5 } }
        },
        {
            chart: 'column',
            chartTitle: 'Equipos por Tipo',
            titles: ['Cantidad'],
            fields: ['Monitor', 'Laptop'],
            data: { 'Cantidad': { 'Monitor': 8, 'Laptop': 7 } }
        }
    ]
};

console.log('Generating two-column multi-chart...');
xlsxChart.generate(opts, (err, buffer) => {
    if (err) {
        console.error('Error:', err);
        process.exit(1);
    }
    fs.writeFileSync('test_two_cols.xlsx', buffer);
    console.log('Success! Saved to test_two_cols.xlsx');
});
