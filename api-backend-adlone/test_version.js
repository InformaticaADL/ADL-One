import { equipoService } from './src/services/equipo.service.js';
import { getConnection } from './src/config/database.js';

async function runTest() {
    try {
        console.log("Fetching equipment list...");
        const equipos = await equipoService.getEquipos({ limit: 1 });
        const eq = equipos.data[0];
        console.log("Selected equipment:", eq.id_equipo, "Version in list:", eq.version);

        console.log("Fetching by ID...");
        const detail = await equipoService.getEquipoById(eq.id_equipo);
        console.log("Version in detail:", detail.version);

        console.log("Fetching history...");
        const history = await equipoService.getEquipoHistorial(eq.id_equipo);
        console.log("History records:", history.length);
        if (history.length > 0) {
            console.log("Restoring to version:", history[0].version);
            await equipoService.restoreEquipoVersion(eq.id_equipo, history[0].id_historial);
            const detailAfter = await equipoService.getEquipoById(eq.id_equipo);
            console.log("Version after restore detail:", detailAfter.version);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
runTest();
