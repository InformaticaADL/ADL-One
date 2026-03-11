import { equipoService } from './src/services/equipo.service.js';

async function test() {
    const res = await equipoService.suggestNextCode('Bomba Muestreadora', 'AY', 'Bomba');
    console.log(res);
    process.exit(0);
}

test().catch(console.error);
