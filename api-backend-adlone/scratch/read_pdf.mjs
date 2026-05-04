import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const fs = require('fs');

const buffer = fs.readFileSync('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\1.1 Ficha Ingreso Piscicultura Lago Verde - Autocontrol Compuesta 24 hrs....pdf');
const data = await pdfParse(buffer);
console.log(data.text);
