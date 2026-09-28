import { equipoService } from '../services/equipo.service';

/**
 * Descarga el documento de una revisión y lo entrega al navegador con su
 * nombre real.
 *
 * Va por la API (blob + object URL) y no por un <a href="/uploads/...">: el
 * archivo en disco tiene un nombre aleatorio, la ruta estática no lleva el
 * token de sesión, y en desarrollo el frontend y el backend están en puertos
 * distintos, así que un href relativo apuntaría al servidor equivocado.
 *
 * `origen` distingue el documento vigente del equipo (mae_equipo) del de una
 * versión archivada (mae_equipo_historial), que se descargan por endpoints
 * distintos.
 */
export async function descargarDocumentoRevision(
    origen: 'equipo' | 'historial',
    id: number,
    nombreSugerido?: string | null
): Promise<void> {
    const blob = origen === 'equipo'
        ? await equipoService.descargarDocumentoEquipo(id)
        : await equipoService.descargarDocumentoHistorial(id);

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', nombreSugerido || `documento-${id}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

/** "1,4 MB" / "820 KB" — para mostrar el peso del adjunto sin librerías. */
export function formatearTamano(bytes?: number | null): string {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MB`;
}
