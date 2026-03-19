import unsService from './src/services/uns.service.js';
import logger from './src/utils/logger.js';

async function simulateManualTransfer() {
    console.log('--- Simulating MANUAL Transfer Notification ---');
    
    const context = {
        id_solicitud: 999,
        id_tipo: 10, // Deshabilitar muestreador id
        nombre_tipo: 'Deshabilitar muestreador',
        solicitante: 'Admin Sistema',
        usuario_accion: 'Roberto Díaz',
        observaciones: 'Traspaso manual de prueba para verificar tabla.',
        datos_json: {
            muestreador_origen_id: 14,
            muestreador_origen_nombre: 'Constanza Flores',
            tipo_traspaso: 'MANUAL',
            reasignacion_manual: [
                { id_equipo: 1, nombre_equipo: 'Multiparámetro HI98194', codigo_equipo: 'EQ-001', id_muestreador_nuevo: 378 },
                { id_equipo: 2, nombre_equipo: 'GPS Garmin 64s', codigo_equipo: 'EQ-002', id_muestreador_nuevo: 464 }
            ]
        }
    };

    try {
        await unsService.trigger('SOLICITUD_NUEVA', context);
        console.log('✅ Trigger executed. Check console for "nombre_muestreador_nuevo" resolution logs.');
    } catch (err) {
        console.error('❌ Error during simulation:', err);
    }
    
    process.exit(0);
}

simulateManualTransfer();
