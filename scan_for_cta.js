import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
    fs.readdirSync(dir).forEach( f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            if (f !== 'node_modules' && f !== '.git') {
                walk(dirPath, callback);
            }
        } else {
            callback(path.join(dir, f));
        }
    });
}

const target = 'c:\\Users\\vremolcoy\\Desktop\\ADL ONE';
console.log('Scanning...');

walk(target, (filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.html')) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            if (content.includes('cta_text') || content.includes('Go to Request')) {
                console.log('MATCH FOUND:', filePath);
            }
        } catch (e) {}
    }
});
console.log('Done.');
