import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderEmail, getEventConfig } from './renderer.js';

const BASE_CONTEXT = {
    CORRELATIVO: '1245',
    ID_FICHA: '1245',
    TIPO_FICHA_INFO: 'Monitoreo Agua/Ril - Terreno',
    BASE_OPERACIONES: 'Puerto Montt',
    EMPRESA_FACTURAR: 'Empresa XYZ',
    EMPRESA_SERVICIO: 'Servicios ABC',
    FUENTE_EMISORA: 'Planta Norte',
    OBJETIVO_MUESTREO: 'Cumplimiento Normativo',
    USUARIO: 'J. Pérez',
    FECHA: '10 de junio de 2026',
    HORA: '16:18',
    OBSERVACION: 'Sin observaciones',
};

test('returns null for an event with no config (not yet migrated)', () => {
    assert.equal(renderEmail('SOL_EQUIPO_NUEVA', BASE_CONTEXT), null);
    assert.equal(getEventConfig('SOL_EQUIPO_NUEVA'), null);
});

test('renders FICHA_CREADA: subject, title, badge, fields and CTA', () => {
    const result = renderEmail('FICHA_CREADA', BASE_CONTEXT);

    assert.equal(result.asunto, 'Nueva Ficha Ingresada: #1245');
    assert.match(result.html, /Ficha Comercial Creada/);
    assert.match(result.html, /NUEVA/);
    assert.match(result.html, /Monitoreo Agua\/Ril - Terreno/);
    assert.match(result.html, /Puerto Montt/);
    assert.match(result.html, /J\. Pérez/);
    assert.match(result.html, /10 de junio de 2026 16:18/);
    assert.match(result.html, /Sin observaciones/);
    assert.match(result.html, /Ver Ficha en ADL ONE/);
    assert.match(result.html, /\/\?ficha=1245/);
});

test('renders FICHA_RECHAZADA_TECNICA with RECHAZADA badge and motivo label', () => {
    const result = renderEmail('FICHA_RECHAZADA_TECNICA', {
        ...BASE_CONTEXT,
        OBSERVACION: 'Faltan datos de muestreo en el sector norte.',
    });

    assert.match(result.asunto, /URGENTE: Ficha Rechazada Técnica: #1245/);
    assert.match(result.html, /RECHAZADA/);
    assert.match(result.html, /Motivo del Rechazo/);
    assert.match(result.html, /Faltan datos de muestreo en el sector norte\./);
});

test('renders FICHA_ASIGNADA with the ficha-servicios special block', () => {
    const result = renderEmail('FICHA_ASIGNADA', {
        ...BASE_CONTEXT,
        servicios: [
            {
                numero: '1',
                muestreador_instalacion: 'Juan Pérez',
                muestreador_retiro: 'No asignado',
                fecha_muestreo: '12-06-2026',
                fecha_retiro: 'No asignada',
                old_fecha: null,
                old_fecha_retiro: null,
                old_muestreador_instalacion: null,
                old_muestreador_retiro: null,
                isModified: false,
            },
        ],
    });

    assert.match(result.html, /Detalle de Servicios/);
    assert.match(result.html, /Servicio 1/);
    assert.match(result.html, /Juan Pérez/);
    // INFORMATIVA outcome has no badge
    assert.doesNotMatch(result.html, />NUEVA</);
});

test('omits a campo row when its value is empty', () => {
    const result = renderEmail('FICHA_CREADA', {
        ...BASE_CONTEXT,
        EMPRESA_SERVICIO: 'No aplica',
    });
    assert.doesNotMatch(result.html, /Empresa Servicio/);
});

test('renders FICHA_MUESTREO_COMPLETADO: subject, title, meta and CTA to ejecutados', () => {
    const result = renderEmail('FICHA_MUESTREO_COMPLETADO', BASE_CONTEXT);

    assert.equal(result.asunto, 'Muestreo Completado - Ficha #1245');
    assert.match(result.html, /Muestreo Completado/);
    assert.match(result.html, /Se complet.* el muestreo de la ficha #1245/);
    assert.match(result.html, /J\. Pérez/);
    assert.match(result.html, /10 de junio de 2026 16:18/);
    assert.match(result.html, /Ver Muestreos Ejecutados/);
    assert.match(result.html, /\/\?vista=ejecutados/);
    // INFORMATIVA outcome has no badge
    assert.doesNotMatch(result.html, />NUEVA</);
});
