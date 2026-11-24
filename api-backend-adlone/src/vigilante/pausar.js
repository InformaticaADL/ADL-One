// Pausa los avisos del vigilante por un rato (mantención con el proceso «online»; las paradas con pm2 stop ya se ignoran solas).
//   node src/vigilante/pausar.js 30 "cambio de certificado"   → sin avisos durante 30 minutos
//   node src/vigilante/pausar.js 0                            → quita la pausa
import fs from 'node:fs';
import { ARCHIVO_PAUSA, CARPETA_LOGS, pausaVigente } from './chequeos.js';

const minutos = Number(process.argv[2]);
const motivo = process.argv.slice(3).join(' ');
if (!Number.isFinite(minutos) || minutos < 0 || minutos > 24 * 60) {
    console.error('Uso: node src/vigilante/pausar.js <minutos 0-1440> ["motivo"]   (0 quita la pausa)');
    process.exit(1);
}
fs.mkdirSync(CARPETA_LOGS, { recursive: true });
if (minutos === 0) {
    try { fs.unlinkSync(ARCHIVO_PAUSA); console.log('Pausa quitada: el vigilante vuelve a avisar.'); } catch { console.log('No había pausa activa.'); }
} else {
    fs.writeFileSync(ARCHIVO_PAUSA, JSON.stringify({ hasta: new Date(Date.now() + minutos * 60000).toISOString(), motivo }));
    const p = pausaVigente();
    console.log(`Avisos en pausa ${minutos} min (hasta ${new Date(p.hasta).toLocaleString('es-CL', { timeZone: 'America/Santiago' })})${motivo ? ` · ${motivo}` : ''}.`);
}
