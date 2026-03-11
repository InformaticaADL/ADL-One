import { equipoService } from './src/services/equipo.service.js';

async function test() {
    try {
        const res = await equipoService.getEquipos({ limit: 2000 });
        const aysenEquipos = res.data.filter(e => e.nombre_asignado === 'Base Aysén' || e.ubicacion === 'Aysén' || (e.nombre_asignado && e.nombre_asignado.toLowerCase().includes('aysen')));
        console.log("Aysén Equipos Count:", aysenEquipos.length);
        console.log("First Aysén Equipo:", aysenEquipos[0]);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
