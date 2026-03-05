import { calendarioService } from './src/services/calendario.service.js';

async function test() {
    try {
        console.log('Testing getEventos...');
        const eventos = await calendarioService.getEventos({ year: 2026, month: 1 });
        console.log(`Retrieved ${eventos.length} grouped fichas/events.`);
        if (eventos.length > 0) {
            console.log('First event sample:', JSON.stringify(eventos[0], null, 2));
        }

        console.log('\nTesting getDashboardStats...');
        const stats = await calendarioService.getDashboardStats(2026);
        console.log(`Stats retrieved. Mensual: ${stats.mensual.length}, Muestreador: ${stats.porMuestreador.length}, Empresa: ${stats.porEmpresa.length}`);

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}
test();
