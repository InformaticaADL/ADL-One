import fs from 'fs';

const data = JSON.parse(fs.readFileSync('src/scripts/db_summary.json', 'utf8'));

const report = {};
data.forEach(event => {
    if (!report[event.modulo]) {
        report[event.modulo] = {
            events: [],
            allVariables: new Set()
        };
    }
    report[event.modulo].events.push(event);
    event.variables.forEach(v => report[event.modulo].allVariables.add(v));
});

let md = '# Análisis de Correos por Módulo\n\n';
md += 'A continuación se presenta el estado actual de los correos que se envían, agrupados por módulo. Para cada módulo se listan las variables (información) que actualmente manejan.\n\n';

for (const [modulo, info] of Object.entries(report)) {
    md += `## Módulo: ${modulo}\n`;
    md += `**Total de Eventos:** ${info.events.length}\n\n`;
    md += `### Información (Variables) Actuales que se inyectan:\n`;
    const vars = Array.from(info.allVariables).sort();
    md += vars.map(v => `- \`${v}\``).join('\n') + '\n\n';
    md += `### Eventos en este módulo:\n`;
    info.events.forEach(e => {
        md += `- **${e.codigo_evento}**: ${e.descripcion}\n`;
        md += `  - Asunto: *${e.asunto_template}*\n`;
    });
    md += '\n---\n\n';
}

fs.writeFileSync('C:/Users/vremolcoy/.gemini/antigravity-ide/brain/ee97faef-08b9-451c-9b41-525eaa012dd2/reporte_eventos.md', md, 'utf8');
console.log('Report generated');
