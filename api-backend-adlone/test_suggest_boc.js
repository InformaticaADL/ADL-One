import { equipoService } from './src/services/equipo.service.js';

async function test() {
    try {
        const res = await equipoService.suggestNextCode('Bomba de Combustible', 'AY', 'Bomba de Combustible');
        console.log("Suggestion:", res);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}

test();
