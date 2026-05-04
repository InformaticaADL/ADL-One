const fs = require('fs');
const pdfParse = require('pdf-parse');

async function debugPdf() {
    try {
        const filePath = 'C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\temp_bulk_pdfs\\formato_test.pdf';
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        
        console.log('--- RAW TEXT START ---');
        console.log(data.text);
        console.log('--- RAW TEXT END ---');
        
        // Also show lines for findValueAfterLabel debugging
        const lines = data.text.split('\n').map(l => l.trim()).filter(Boolean);
        console.log('--- LINES ---');
        lines.forEach((l, i) => console.log(`${i}: [${l}]`));
        
    } catch (err) {
        console.error('Error parsing PDF:', err);
    }
}

debugPdf();
