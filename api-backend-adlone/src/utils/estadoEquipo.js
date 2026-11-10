// Estado del equipo (columna mae_equipo.Estado, "ESTADO" en el inventario
// OI-FoGe-21). Son solo tres: Operativo, Dado de Baja y Fuera de Servicio.
// Las planillas traen variantes ("Operativa", "De Baja", "fuera de servicio"):
// se llevan siempre al nombre oficial para que filtros y reportes no se dividan.

export const ESTADOS_EQUIPO = ['Operativo', 'Fuera de Servicio', 'Dado de Baja'];

const plano = (v) => String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

// Devuelve el estado oficial, null si viene vacío, o el texto original si no
// se reconoce (no se descarta un dato sin avisar).
export const normalizarEstadoEquipo = (valor) => {
    if (valor === null || valor === undefined || String(valor).trim() === '') return null;
    const t = plano(valor);
    if (t.includes('BAJA')) return 'Dado de Baja';
    // En mantención / calibración / reparación: no está disponible para terreno.
    if (t.includes('FUERA') || t.includes('MANTENC') || t.includes('CALIBRAC') || t.includes('REPARAC')) return 'Fuera de Servicio';
    if (t.startsWith('OPERATIV') || t === 'ACTIVO' || t === 'HABILITADO') return 'Operativo';
    return String(valor).trim();
};
