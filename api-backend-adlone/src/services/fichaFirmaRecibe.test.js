import test from 'node:test';
import assert from 'node:assert';
import { elegirReceptor, comoFirmante, receptorDe } from './fichaFirmaRecibe.js';

const persona = (extra = {}) => ({ id_muestreador: 258, nombre_muestreador: 'Franco Rivas ', habilitado: 'S', ...extra });

test('se pide en la app a quien tiene el equipo, si es quien figura recibiéndolo (sin distinguir tildes ni mayúsculas)', () => {
    assert.deepEqual(elegirReceptor(persona(), ' franco  rivas'), { id_muestreador: 258, nombre: 'Franco Rivas' });
    assert.deepEqual(elegirReceptor(persona({ nombre_muestreador: 'Ramón Barría' }), 'ramon barria'), { id_muestreador: 258, nombre: 'Ramón Barría' });
    assert.deepEqual(elegirReceptor(persona(), ''), { id_muestreador: 258, nombre: 'Franco Rivas' });
});

test('no se pide en la app si recibe otra persona, si es una base, si no está habilitado o si el equipo no tiene muestreador', () => {
    assert.equal(elegirReceptor(persona(), 'Pablo Campos'), null);
    assert.equal(elegirReceptor(persona({ nombre_muestreador: 'Base Puerto Montt' }), ''), null);
    assert.equal(elegirReceptor(persona({ nombre_muestreador: 'Sede Villarrica' }), ''), null);
    assert.equal(elegirReceptor(persona({ habilitado: 'N' }), ''), null);
    assert.equal(elegirReceptor(null, ''), null);
    assert.equal(elegirReceptor(persona({ id_muestreador: 0 }), ''), null);
});

test('sin FIRMA_EQUIPO_EN_APP=1 no se pide nada en la app (ni se consulta la base)', async () => {
    const antes = process.env.FIRMA_EQUIPO_EN_APP;
    const poolQueNoDebeUsarse = { request: () => { throw new Error('no debía consultar'); } };
    for (const valor of [undefined, '', '0']) {
        if (valor === undefined) delete process.env.FIRMA_EQUIPO_EN_APP; else process.env.FIRMA_EQUIPO_EN_APP = valor;
        assert.equal(await receptorDe(poolQueNoDebeUsarse, 10, 'Franco Rivas'), null);
    }
    if (antes === undefined) delete process.env.FIRMA_EQUIPO_EN_APP; else process.env.FIRMA_EQUIPO_EN_APP = antes;
});

test('quien recibe se muestra como un firmante más', () => {
    const fila = { nombre: 'Franco Rivas', estado: 'PENDIENTE', fecha_respuesta: null };
    assert.equal(comoFirmante(fila).estado, 'PENDIENTE');
    assert.equal(comoFirmante({ ...fila, estado: 'ACEPTADA', fecha_respuesta: 'hoy' }).estado, 'FIRMADA');
    assert.equal(comoFirmante({ ...fila, estado: 'ACEPTADA', fecha_respuesta: 'hoy' }).fecha_firma, 'hoy');
    assert.equal(comoFirmante({ ...fila, estado: 'RECHAZADA' }).estado, 'RECHAZADA');
    assert.equal(comoFirmante({ ...fila, estado: 'ANULADA' }), null);
    assert.equal(comoFirmante(null), null);
});
