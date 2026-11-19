import test from 'node:test';
import assert from 'node:assert/strict';
import firmaRemotaService from './firmaRemota.service.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const nueva = (extra = {}) => firmaRemotaService.crearFicha({
    titulo: 'OI-FoGe-36 · Ficha de entrega',
    slots: [{ id: 'equipo', titulo: 'Responsable del equipo (recibe)', nombre: 'Sede Villarrica' }, { id: 'area', titulo: 'Responsable de área' }],
    idUsuario: 7,
    url: (t) => `http://x/firma/${t}`,
    ...extra,
});

test('la sesión de ficha lista las firmas que faltan y se completa firma a firma', async () => {
    const s = await nueva();
    assert.equal(firmaRemotaService.tipoSesion(s.token), 'FICHA');
    assert.deepEqual(firmaRemotaService.infoFicha(s.token).slots.map((x) => x.firmada), [false, false]);

    firmaRemotaService.recibirFirmaFicha(s.token, 'equipo', PNG);
    assert.equal(firmaRemotaService.estadoFicha(s.token, 7).estado, 'pendiente');

    firmaRemotaService.recibirFirmaFicha(s.token, 'area', PNG);
    const fin = firmaRemotaService.estadoFicha(s.token, 7);
    assert.equal(fin.estado, 'completo');
    assert.equal(fin.slots[0].firma, PNG);
});

test('solo se piden las firmas que llegan en la sesión (las ya firmadas en pantalla no)', async () => {
    const s = await nueva({ slots: [{ id: 'area', titulo: 'Responsable de área' }] });
    assert.deepEqual(firmaRemotaService.infoFicha(s.token).slots.map((x) => x.id), ['area']);
    assert.throws(() => firmaRemotaService.recibirFirmaFicha(s.token, 'equipo', PNG), (e) => e.statusCode === 404);
});

test('rechaza firmas que no son PNG, repetidas o sin ninguna firma que pedir', async () => {
    const s = await nueva();
    assert.throws(() => firmaRemotaService.recibirFirmaFicha(s.token, 'equipo', 'data:text/html;base64,xx'), (e) => e.statusCode === 400);
    await assert.rejects(() => nueva({ slots: [] }), (e) => e.statusCode === 400);
    await assert.rejects(() => nueva({ slots: [{ id: 'a', titulo: 'A' }, { id: 'a', titulo: 'B' }] }), (e) => e.statusCode === 400);
});

test('solo quien generó el QR ve las firmas, y la sesión de ficha no sirve a la de verificación', async () => {
    const s = await nueva();
    assert.throws(() => firmaRemotaService.estadoFicha(s.token, 99), (e) => e.statusCode === 403);
    assert.throws(() => firmaRemotaService.info(s.token), (e) => e.statusCode === 410);
    assert.throws(() => firmaRemotaService.recibirFirma(s.token, PNG), (e) => e.statusCode === 410);
});

test('las firmas ya hechas en la web quedan bloqueadas (en gris) y no se pueden repetir desde el celular', async () => {
    const s = await nueva({ slots: [
        { id: 'firma', titulo: 'Responsable de entrega', firmada: true },
        { id: 'equipo', titulo: 'Responsable del equipo (recibe)' },
    ] });
    const info = firmaRemotaService.infoFicha(s.token);
    assert.deepEqual(info.slots.map((x) => [x.id, x.firmada, x.bloqueada]), [['firma', true, true], ['equipo', false, false]]);
    assert.throws(() => firmaRemotaService.recibirFirmaFicha(s.token, 'firma', PNG), (e) => e.statusCode === 409);
    assert.equal(firmaRemotaService.estadoFicha(s.token, 7).estado, 'pendiente');
    firmaRemotaService.recibirFirmaFicha(s.token, 'equipo', PNG);
    assert.equal(firmaRemotaService.estadoFicha(s.token, 7).estado, 'completo');
});

test('una sesión con todas las firmas bloqueadas no tiene nada que pedir', async () => {
    await assert.rejects(() => nueva({ slots: [{ id: 'firma', titulo: 'Responsable de entrega', firmada: true }] }), (e) => e.statusCode === 400);
});
