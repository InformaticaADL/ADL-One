import { equipoService } from './src/services/equipo.service.js';

async function test() {
    try {
        const res = await equipoService.suggestNextCode('BOTELLA OCEANOGRAFICA', 'PM', 'BOTELLA OCEANOGRAFICA');
        console.log("Suggestion:", res);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}

test();
