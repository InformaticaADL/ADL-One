import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probarHttp, pausaVigente, estaDetenidoAPropósito } from './chequeos.js';

const servidor = (manejador) => new Promise((res) => { const s = http.createServer(manejador); s.listen(0, '127.0.0.1', () => res({ s, url: `http://127.0.0.1:${s.address().port}/` })); });

test('responde 200 con la aplicación: ok', async () => {
    const { s, url } = await servidor((q, r) => r.end('<html><div id="root"></div></html>'));
    assert.deepEqual(await probarHttp(url, { debeContener: 'id="root"' }), { ok: true });
    s.close();
});

test('responde 200 pero NO es la aplicación: falla', async () => {
    const { s, url } = await servidor((q, r) => r.end('<h1>Bienvenido a nginx</h1>'));
    const r = await probarHttp(url, { debeContener: 'id="root"' });
    assert.equal(r.ok, false);
    assert.match(r.motivo, /no es la aplicación/);
    s.close();
});

test('responde 500: falla con el código', async () => {
    const { s, url } = await servidor((q, r) => { r.statusCode = 500; r.end('x'); });
    const r = await probarHttp(url);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /HTTP 500/);
    s.close();
});

test('acepta la conexión pero nunca contesta (el caso del 19-nov): falla por tiempo', async () => {
    const { s, url } = await servidor(() => { /* se queda colgado */ });
    const t0 = Date.now();
    const r = await probarHttp(url, { timeoutMs: 400 });
    assert.equal(r.ok, false);
    assert.match(r.motivo, /no respondió en/);
    assert.ok(Date.now() - t0 < 3000);
    s.closeAllConnections?.(); s.close();
});

test('nadie escucha en ese puerto: falla al conectar', async () => {
    const { s, url } = await servidor((q, r) => r.end('x'));
    s.close(); await new Promise((r) => setTimeout(r, 50));
    const r = await probarHttp(url, { timeoutMs: 1000 });
    assert.equal(r.ok, false);
    assert.match(r.motivo, /no se pudo conectar/);
});

test('solo «stopped» y «stopping» son paradas a propósito; un proceso ausente o caído NO', () => {
    assert.equal(estaDetenidoAPropósito('stopped'), true);
    assert.equal(estaDetenidoAPropósito('stopping'), true);
    for (const e of ['online', 'errored', 'launching', 'waiting restart', undefined, null]) assert.equal(estaDetenidoAPropósito(e), false, String(e));
});

test('pausa manual: vigente solo hasta la hora indicada', () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vig-')), 'pausa');
    assert.equal(pausaVigente(f), null); // no existe
    fs.writeFileSync(f, JSON.stringify({ hasta: new Date(Date.now() + 60000).toISOString(), motivo: 'prueba' }));
    assert.equal(pausaVigente(f).motivo, 'prueba');
    fs.writeFileSync(f, JSON.stringify({ hasta: new Date(Date.now() - 60000).toISOString() }));
    assert.equal(pausaVigente(f), null); // vencida
    fs.writeFileSync(f, 'esto no es json');
    assert.equal(pausaVigente(f), null); // archivo dañado: se ignora
});
