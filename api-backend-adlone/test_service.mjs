import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded
dotenv.config({ path: path.join(__dirname, '.env') });

import ursService from './src/services/urs.service.js';

async function check() {
    try {
        console.log("Testing getDerivationTargets(8)...");
        const targets = await ursService.getDerivationTargets(8);
        console.log("Result:", JSON.stringify(targets, null, 2));
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
check();
