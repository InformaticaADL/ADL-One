// comuna (id legado) → región (id legado de mae_region). mae_comuna NO trae la región; este mapeo explícito la asigna.
// Lo usan el cargador (scripts/migracion-geo.mjs) y el motor de sincronización: una comuna nueva del legado que no esté aquí
// se rechaza (queda en la cola de errores) hasta que se agregue. Revisión pendiente del negocio.
export const R = { ARICA: 1, TARAPACA: 2, ATACAMA: 4, COQUIMBO: 5, VALPARAISO: 6, RM: 7, OHIGGINS: 8, MAULE: 9, BIOBIO: 10, ARAUCANIA: 11, LOSRIOS: 12, LOSLAGOS: 13, AYSEN: 14, MAGALLANES: 15, NUBLE: 17 };
export const REGION_DE_COMUNA = new Map();
const asignar = (region, ids) => ids.forEach((id) => REGION_DE_COMUNA.set(id, region));
asignar(R.LOSLAGOS, [26, 27, 40, 13, 19, 30, 31, 1, 16, 92, 98, 12, 8, 46, 42, 33, 11, 89, 6, 9, 15, 48, 14, 52, 18, 20, 47, 50, 7, 104, 102]);
asignar(R.LOSRIOS, [83, 93, 45, 94, 22, 103, 29, 23, 24]);
asignar(R.ARAUCANIA, [41, 38, 37, 3, 100, 96, 28, 10, 2, 5, 77, 79, 25, 4]);
asignar(R.AYSEN, [95, 36, 90, 34, 39, 35, 70]);
asignar(R.MAGALLANES, [21, 81, 84, 87]);
asignar(R.BIOBIO, [91, 61, 107, 105, 49, 76, 43]);
asignar(R.NUBLE, [106]); asignar(R.MAULE, [99, 82, 44, 101]); asignar(R.OHIGGINS, [73]);
asignar(R.ATACAMA, [85]); asignar(R.COQUIMBO, [97]); asignar(R.VALPARAISO, [78]); asignar(R.TARAPACA, [88]);
asignar(R.RM, [60, 62, 63, 64, 65, 66, 67, 68, 69, 71, 72, 74, 75, 51, 80]);
