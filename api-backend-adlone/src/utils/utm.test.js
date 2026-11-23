import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNumeroUtm, parseZona, utmALatLon, bandaDeLatitud, enlaceGoogleMaps, ubicacionDesdeUtm } from './utm.js';

const cerca = (a, b, tol) => Math.abs(a - b) <= tol;

test('parseNumeroUtm entiende puntos de miles, comas decimales y números', () => {
    assert.equal(parseNumeroUtm('5.435.661'), 5435661);
    assert.equal(parseNumeroUtm('5426758,7'), 5426758.7);
    assert.equal(parseNumeroUtm('5.435.661,25'), 5435661.25);
    assert.equal(parseNumeroUtm('665482'), 665482);
    assert.equal(parseNumeroUtm(711953), 711953);
    assert.equal(parseNumeroUtm(''), null);
    assert.equal(parseNumeroUtm(null), null);
    assert.equal(parseNumeroUtm('abc'), null);
});

test('parseZona acepta «18», «18G» y «18 h»; rechaza lo que no es una zona', () => {
    assert.deepEqual(parseZona('18G'), { huso: 18, banda: 'G' });
    assert.deepEqual(parseZona('19'), { huso: 19, banda: '' });
    assert.deepEqual(parseZona('18 h'), { huso: 18, banda: 'H' });
    assert.equal(parseZona('No aplica'), null);
    assert.equal(parseZona(''), null);
    assert.equal(parseZona('99G'), null);
});

test('un punto sobre el meridiano central del huso 18 (-75°) tiene este = 500.000 m', () => {
    const p = utmALatLon('18G', 5400000, 500000);
    assert.ok(cerca(p.lon, -75, 1e-9), `lon ${p.lon}`);
});

test('el ecuador sur (norte 10.000.000) está en latitud 0', () => {
    const p = utmALatLon('18', 10000000, 500000);
    assert.ok(cerca(p.lat, 0, 1e-9), `lat ${p.lat}`);
});

test('coordenadas reales del PDF de Piscicultura Lago Verde (huso 18, 5426758 / 711953) caen en la zona de Ralún', () => {
    const p = utmALatLon('18', '5426758', '711953');
    assert.ok(cerca(p.lat, -41.2828, 0.001), `lat ${p.lat}`);
    assert.ok(cerca(p.lon, -72.4691, 0.001), `lon ${p.lon}`);
});

test('con puntos de miles da lo mismo que sin ellos', () => {
    const a = utmALatLon('18G', '5.435.661', '665.482');
    const b = utmALatLon('18G', 5435661, 665482);
    assert.deepEqual(a, b);
});

test('el hemisferio norte solo se usa con una letra de banda norte', () => {
    const sur = utmALatLon('18', 5400000, 500000);
    const norte = utmALatLon('18T', 5400000, 500000);
    assert.ok(sur.lat < 0 && norte.lat > 0);
});

test('datos no creíbles devuelven null (no se inventa una ubicación)', () => {
    assert.equal(utmALatLon('18', '54267587', '11953'), null); // lo que leía mal el lector de PDF
    assert.equal(utmALatLon('18', '', '711953'), null);
    assert.equal(utmALatLon('No aplica', '5426758', '711953'), null);
    assert.equal(utmALatLon('18', '5426758', '90'), null);
    assert.equal(utmALatLon('18', '300', '665482'), null);
});

test('bandaDeLatitud: Los Lagos cae en la banda G y el centro de Chile en H', () => {
    assert.equal(bandaDeLatitud(-41.28), 'G');
    assert.equal(bandaDeLatitud(-33.45), 'H');
    assert.equal(bandaDeLatitud(-53.1), 'F');
});

test('ubicacionDesdeUtm arma el enlace de Google Maps', () => {
    const u = ubicacionDesdeUtm({ zona: '18', utmNorte: '5426758', utmEste: '711953' });
    assert.equal(u.enlace, enlaceGoogleMaps(u.lat, u.lon));
    assert.match(u.enlace, /^https:\/\/www\.google\.com\/maps\?q=-41\.28\d+,-72\.46\d+$/);
    assert.equal(u.banda, 'G');
    assert.equal(ubicacionDesdeUtm({ zona: '18', utmNorte: '', utmEste: '' }), null);
    assert.equal(ubicacionDesdeUtm(), null);
});

test('norte y este escritos al revés se corrigen y se avisa', () => {
    const bien = ubicacionDesdeUtm({ zona: '18G', utmNorte: '5277529', utmEste: '607941' });
    const reves = ubicacionDesdeUtm({ zona: '18G', utmNorte: '607941', utmEste: '5277529' });
    assert.equal(bien.alReves, false);
    assert.equal(reves.alReves, true);
    assert.equal(reves.lat, bien.lat);
    assert.equal(reves.lon, bien.lon);
    assert.equal(ubicacionDesdeUtm({ zona: '18G', utmNorte: '445522', utmEste: '336622' }), null); // ninguno es un norte creíble
});

// Valores de referencia calculados con proj4 (WGS84, UTM sur) para ciudades de Chile en los husos 18 y 19: la conversión debe coincidir
// con una implementación independiente al nivel de milímetros, no solo ser coherente consigo misma.
const REFERENCIA = [
    { n: 'Arica', zona: '19', e: 361414.407, no: 7956392.694, lat: -18.4783, lon: -70.3126 },
    { n: 'Santiago', zona: '19', e: 344846.72, no: 6297700.156, lat: -33.4489, lon: -70.6693 },
    { n: 'Concepción', zona: '18', e: 674420.297, no: 5923299.914, lat: -36.8201, lon: -73.0444 },
    { n: 'Puerto Montt', zona: '18', e: 671818.687, no: 5407100.532, lat: -41.4693, lon: -72.9424 },
    { n: 'Punta Arenas', zona: '19', e: 371836.858, no: 4107791.467, lat: -53.1638, lon: -70.9171 },
    { n: 'Castro (Chiloé)', zona: '18', e: 601718.028, no: 5295919.205, lat: -42.4824, lon: -73.7624 },
];
for (const r of REFERENCIA) {
    test(`UTM → lat/lon coincide con proj4: ${r.n}`, () => {
        const p = utmALatLon(r.zona, r.no, r.e);
        assert.ok(cerca(p.lat, r.lat, 1e-7) && cerca(p.lon, r.lon, 1e-7), `${p.lat}, ${p.lon}`); // 1e-7° ≈ 1 cm
    });
}

test('el enlace de Google Maps lleva latitud y longitud con 6 decimales', () => {
    const p = ubicacionDesdeUtm({ zona: '18G', utmNorte: '5407100.532', utmEste: '671818.687' });
    assert.equal(p.enlace, 'https://www.google.com/maps?q=-41.469300,-72.942400');
});
