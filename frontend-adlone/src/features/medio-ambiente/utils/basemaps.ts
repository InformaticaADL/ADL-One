// Fondos de mapa GRATUITOS y SIN API key, compartidos por TODOS los mapas de la
// app (Hoy en Vivo, asignación, planificador de rutas, replay de historial…).
// Se usan los basemaps públicos de Esri (ArcGIS Online): cargan en el navegador
// sin cuenta ni token, solo con atribución. Reemplazan al tile plano de
// OpenStreetMap (que no está permitido usar directo en producción) y a CARTO
// (que ahora exige API key). Los fondos "gris" (claro/oscuro) traen la base sin
// etiquetas, así que se les superpone una capa de referencia (labels).
//
// Un único lugar para mantener/cambiar el estilo de todos los mapas.

export interface Basemap {
    id: string;
    label: string;
    url: string;
    overlayUrl?: string; // capa de etiquetas (ciudades/calles) para los fondos gris
    attribution: string;
    maxZoom: number;
}

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const ATTR_ESRI = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';

export const BASEMAPS: Basemap[] = [
    { id: 'calles', label: 'Calles', url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`, attribution: ATTR_ESRI, maxZoom: 19 },
    {
        id: 'claro', label: 'Claro',
        url: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
        overlayUrl: `${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
        attribution: ATTR_ESRI, maxZoom: 16,
    },
    {
        id: 'oscuro', label: 'Oscuro',
        url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
        overlayUrl: `${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
        attribution: ATTR_ESRI, maxZoom: 16,
    },
    { id: 'satelite', label: 'Satélite', url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, attribution: `${ATTR_ESRI}, Maxar, Earthstar Geographics`, maxZoom: 19 },
];

// Estilo por defecto para mapas sin selector (asignación, planificador, replay).
export const BASEMAP_DEFAULT = 'calles';

export const BASEMAP_STORAGE_KEY = 'hoyEnVivo.basemap';

// Preferencia de estilo recordada (solo la usa el selector de Hoy en Vivo).
export function leerBasemapGuardado(): string {
    try {
        const v = localStorage.getItem(BASEMAP_STORAGE_KEY);
        if (v && BASEMAPS.some((b) => b.id === v)) return v;
    } catch { /* localStorage bloqueado/no disponible */ }
    return BASEMAP_DEFAULT;
}
