import { equipoService } from './src/services/equipo.service.js';

async function test() {
    try {
        const res = await equipoService.getEquipos({ limit: 2000 });
        console.log("total:", res.total);
        console.log("data length:", res.data.length);
        const franco = res.data.filter(e => e.nombre_asignado && e.nombre_asignado.includes('Franco'));
        console.log("Franco equipments:", franco.length);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
