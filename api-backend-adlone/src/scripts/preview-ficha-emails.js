// api-backend-adlone/src/scripts/preview-ficha-emails.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderEmail } from '../notifications/renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, '../../.preview-emails');

const BASE_CONTEXT = {
    CORRELATIVO: '1245',
    TIPO_FICHA_INFO: 'Monitoreo Agua/Ril - Terreno',
    BASE_OPERACIONES: 'Puerto Montt',
    EMPRESA_FACTURAR: 'Empresa XYZ SpA',
    EMPRESA_SERVICIO: 'Servicios Ambientales ABC',
    FUENTE_EMISORA: 'Planta Norte',
    OBJETIVO_MUESTREO: 'Cumplimiento Normativo DS90',
    USUARIO: 'J. Pérez',
    FECHA: '10 de junio de 2026',
    HORA: '16:18',
    OBSERVACION: 'Sin observaciones',
};

const samples = {
    'ficha-creada.html': renderEmail('FICHA_CREADA', BASE_CONTEXT),
    'ficha-rechazada-tecnica.html': renderEmail('FICHA_RECHAZADA_TECNICA', {
        ...BASE_CONTEXT,
        OBSERVACION: 'Faltan datos de muestreo en el sector norte.',
    }),
    'ficha-asignada.html': renderEmail('FICHA_ASIGNADA', {
        ...BASE_CONTEXT,
        servicios: [
            {
                numero: '1',
                muestreador_instalacion: 'Juan Pérez',
                muestreador_retiro: 'No asignado',
                fecha_muestreo: '12-06-2026',
                fecha_retiro: 'No asignada',
                old_fecha: null,
                old_fecha_retiro: null,
                old_muestreador_instalacion: null,
                old_muestreador_retiro: null,
                isModified: false,
            },
        ],
    }),
    'ficha-muestreo-reagendado.html': renderEmail('FICHA_MUESTREO_REAGENDADO', {
        ...BASE_CONTEXT,
        OBSERVACION: 'Cliente solicitó cambio de fecha por mantención de planta.',
        servicios: [
            {
                numero: '2',
                muestreador_instalacion: 'María Soto',
                muestreador_retiro: 'No asignado',
                fecha_muestreo: '15-06-2026',
                fecha_retiro: 'No asignada',
                old_fecha: '12-06-2026',
                old_fecha_retiro: null,
                old_muestreador_instalacion: null,
                old_muestreador_retiro: null,
                isModified: true,
            },
        ],
    }),
};

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [filename, result] of Object.entries(samples)) {
    if (!result) {
        console.warn(`No config found, skipping ${filename}`);
        continue;
    }
    const outPath = path.join(OUT_DIR, filename);
    // Replace the cid: logo reference with a placeholder so the HTML
    // renders standalone in a browser (no email attachment available here).
    const html = result.html.replace('cid:logo_adlone', 'https://dummyimage.com/120x28/0062a8/ffffff.png&text=ADL+ONE');
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`Asunto: ${result.asunto}`);
    console.log(`Wrote ${outPath}`);
}
