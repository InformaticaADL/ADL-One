// Paleta de colores estables por id_muestreador, para distinguir de un
// vistazo a cada muestreador en el mapa "Hoy en Vivo" — el mismo id siempre
// cae en el mismo color mientras dure la sesión (módulo simple, sin estado).
const PALETA = [
    '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5',
    '#0c8599', '#e8590c', '#5c940d', '#c2255c', '#1864ab',
];

export function colorPorMuestreador(idMuestreador: number): string {
    return PALETA[idMuestreador % PALETA.length];
}

export function inicialesDe(nombre: string): string {
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    const iniciales = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
    return iniciales.join('') || '?';
}
