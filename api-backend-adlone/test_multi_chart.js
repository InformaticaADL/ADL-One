import XLSXChart from 'xlsx-chart';
import fs from 'fs';

const xlsxChart = new XLSXChart();
const opts = {
    charts: [
        {
            chart: 'pie',
            chartTitle: 'Estado de Equipos',
            title: 'Estado de Equipos',
            titles: ['Cantidad'],
            fields: ['Activo', 'Inactivo'],
            data: { 'Cantidad': { 'Activo': 10, 'Inactivo': 5 } }
        },
        {
            chart: 'column',
            chartTitle: 'Equipos por Tipo',
            title: 'Equipos por Tipo',
            titles: ['Cantidad'],
            fields: ['Monitor', 'Laptop'],
            data: { 'Cantidad': { 'Monitor': 8, 'Laptop': 7 } }
        }
    ]
};

xlsxChart.generate(opts, (err, buffer) => {
    if (err) {
        console.error('Error generating chart:', err);
        process.exit(1);
    }
    fs.writeFileSync('test_multi_chart.xlsx', buffer);
    console.log('Successfully generated test_multi_chart.xlsx');
});
