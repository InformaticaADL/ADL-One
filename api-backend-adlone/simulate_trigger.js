import unsService from './src/services/uns.service.js';
import logger from './src/utils/logger.js';

async function simulate() {
    console.log('--- Simulating SOLICITUD_COMENTARIO_NUEVO for id_tipo = 7 ---');
    const context = {
        id_solicitud: 14,
        id_tipo: 7,
        nombre_tipo: 'Tipo 7 Test',
        solicitante: 'Usuario Test',
        mensaje: 'Este es un mensaje de prueba para ver el config_email',
        observaciones: 'Mensaje de prueba'
    };
    
    await unsService.trigger('SOLICITUD_COMENTARIO_NUEVO', context);
    
    console.log('--- Simulating SOLICITUD_COMENTARIO_NUEVO for id_tipo = 8 ---');
    context.id_tipo = 8;
    await unsService.trigger('SOLICITUD_COMENTARIO_NUEVO', context);

    process.exit(0);
}

simulate();
