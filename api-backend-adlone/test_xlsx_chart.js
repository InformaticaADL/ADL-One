import XLSXChart from 'xlsx-chart';
import fs from 'fs';

const xlsxChart = new XLSXChart();
const opts = {
    file: 'test_chart.xlsx',
    chart: 'column',
    titles: ['Equipos'],
    fields: ['Sede A', 'Sede B', 'Sede C'],
    data: {
        'Equipos': {
            'Sede A': 10,
            'Sede B': 20,
            'Sede C': 15
        }
    }
};

xlsxChart.generate(opts, (err, data) => {
    if (err) {
        console.error('Error generating chart:', err);
    } else {
        fs.writeFileSync('test_chart.xlsx', data);
        console.log('Chart generated successfully');
    }
});
