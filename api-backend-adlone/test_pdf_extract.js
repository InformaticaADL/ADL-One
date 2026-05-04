import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const pdfPath = path.resolve('C:/Users/vremolcoy/Desktop/ADL ONE/temp_bulk_pdfs/formato_test.pdf');
const buffer = fs.readFileSync(pdfPath);

pdfParse(buffer).then(data => {
    console.log('=== PDF TEXT CONTENT ===');
    console.log(data.text);
    console.log('=== END ===');
    console.log('Pages:', data.numpages);
}).catch(err => {
    console.error('Error:', err.message);
});
