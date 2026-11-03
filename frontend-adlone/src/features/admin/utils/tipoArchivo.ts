export type TipoArchivo = 'pdf' | 'imagen' | 'otro';

// Extensión en minúsculas de la ruta guardada ('' si no tiene).
export const extensionArchivo = (ruta: string): string => {
    const limpio = ruta.split('?')[0];
    const nombre = limpio.split('/').pop() || '';
    return nombre.includes('.') ? (nombre.split('.').pop() || '').toLowerCase() : '';
};

// Se decide por la extensión de la ruta guardada: es lo único que devuelve el
// backend para los adjuntos (no guarda el mime type).
export const tipoArchivo = (ruta: string): TipoArchivo => {
    const ext = extensionArchivo(ruta);
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'imagen';
    return 'otro';
};

// El nombre visible puede no traer extensión (ej. "132"): al descargar se le
// agrega la del archivo real para que el sistema operativo sepa abrirlo.
export const nombreDescarga = (nombre: string, ruta: string): string => {
    const ext = extensionArchivo(ruta);
    if (!ext || nombre.toLowerCase().endsWith(`.${ext}`)) return nombre;
    return `${nombre}.${ext}`;
};
