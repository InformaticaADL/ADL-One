import 'dotenv/config';
import { equipoService } from '../src/services/equipo.service.js';
import logger from '../src/utils/logger.js';

async function testGetEquipos() {
    try {
        console.log('--- Testing equipoService.getEquipos({ limit: 500 }) ---');
        const result = await equipoService.getEquipos({ limit: 500 });
        
        console.log('Success:', !!result.data);
        console.log('Total returned:', result.data?.length);
        console.log('Total in DB reported:', result.total);
        console.log('Catalogs count (tipos):', result.catalogs?.tipos?.length);
        
        if (result.data && result.data.length > 0) {
            console.log('First equipment:', result.data[0].codigo, result.data[0].nombre);
        } else {
            console.log('WARNING: No data returned!');
        }
        
    } catch (err) {
        console.error('ERROR in getEquipos:', err);
    }
}

testGetEquipos();
