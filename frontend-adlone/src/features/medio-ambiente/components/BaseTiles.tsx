import { TileLayer } from 'react-leaflet';
import { BASEMAPS, BASEMAP_DEFAULT } from '../utils/basemaps';

interface BaseTilesProps {
    /** id del estilo (ver BASEMAPS). Por defecto "calles". */
    styleId?: string;
}

// Capa(s) de fondo compartida(s) por todos los mapas. Debe renderizarse como
// hijo de <MapContainer>. Para los estilos gris añade la capa de etiquetas.
export function BaseTiles({ styleId = BASEMAP_DEFAULT }: BaseTilesProps) {
    const bm = BASEMAPS.find((b) => b.id === styleId) ?? BASEMAPS[0];
    return (
        <>
            <TileLayer key={bm.id} url={bm.url} attribution={bm.attribution} maxZoom={bm.maxZoom} />
            {bm.overlayUrl && (
                <TileLayer key={`${bm.id}-ref`} url={bm.overlayUrl} maxZoom={bm.maxZoom} />
            )}
        </>
    );
}
