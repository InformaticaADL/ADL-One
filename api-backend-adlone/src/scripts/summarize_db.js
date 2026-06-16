import fs from 'fs';

const data = JSON.parse(fs.readFileSync('src/scripts/db_results_utf8.json', 'utf8'));

const summary = data.map(item => ({
    id_evento: item.id_evento,
    codigo_evento: item.codigo_evento,
    descripcion: item.descripcion,
    modulo: item.modulo,
    asunto_template: item.asunto_template,
    variables: item.cuerpo_template_html ? Array.from(new Set(item.cuerpo_template_html.match(/\{[A-Z_0-9a-z]+\}/g))) : []
}));

fs.writeFileSync('src/scripts/db_summary.json', JSON.stringify(summary, null, 2), 'utf8');
console.log("Summary created with " + summary.length + " events.");
