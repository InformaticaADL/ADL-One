import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import apiClient from '../../../config/axios.config';
import { BaseTiles } from './BaseTiles';
import { distanciaMetros, esEnlaceGenerado, ubicacionDesdeUtm } from '../utils/utm';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const iconoLink = L.divIcon({
    className: '',
    html: '<div style="width:16px;height:16px;border-radius:50%;background:#e11d48;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.4)"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});

interface Props {
    open: boolean;
    onClose: () => void;
    nombre?: string;
    zona: string;
    utmNorte: string;
    utmEste: string;
    refGoogle: string;
}

function Encuadre({ puntos }: { puntos: [number, number][] }) {
    const map = useMap();
    useEffect(() => {
        if (puntos.length === 1) map.setView(puntos[0], 15);
        else if (puntos.length > 1) map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 16 });
    }, [map, puntos]);
    return null;
}

const formatoDistancia = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

/**
 * Muestra en un mapa el punto que resulta de la zona y las coordenadas UTM (para comprobar el cálculo) y, si la referencia es un enlace de
 * Google Maps escrito por una persona, ese punto también (pin rojo) con la distancia entre ambos.
 */
export const MapaUbicacionDialog: React.FC<Props> = ({ open, onClose, nombre, zona, utmNorte, utmEste, refGoogle }) => {
    const utm = useMemo(() => ubicacionDesdeUtm({ zona, utmNorte, utmEste }), [zona, utmNorte, utmEste]);
    const enlacePropio = refGoogle.trim() && !esEnlaceGenerado(refGoogle) ? refGoogle.trim() : '';
    const [propio, setPropio] = useState<{ lat: number; lon: number } | null>(null);
    const [estado, setEstado] = useState<'idle' | 'cargando' | 'ok' | 'error'>('idle');

    useEffect(() => {
        if (!open || !enlacePropio) { setPropio(null); setEstado('idle'); return; }
        let vivo = true;
        setEstado('cargando');
        apiClient.post('/api/fichas/verificar-link', { link: enlacePropio })
            .then(({ data }) => {
                if (!vivo) return;
                if (data?.data?.ok) { setPropio({ lat: data.data.lat, lon: data.data.lon }); setEstado('ok'); }
                else { setPropio(null); setEstado('error'); }
            })
            .catch(() => { if (vivo) { setPropio(null); setEstado('error'); } });
        return () => { vivo = false; };
    }, [open, enlacePropio]);

    const puntos = useMemo(() => {
        const l: [number, number][] = [];
        if (utm) l.push([utm.lat, utm.lon]);
        if (propio) l.push([propio.lat, propio.lon]);
        return l;
    }, [utm, propio]);

    const distancia = utm && propio ? distanciaMetros(utm, propio) : null;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Ubicación del punto{nombre ? ` «${nombre}»` : ''}</DialogTitle>
                    <DialogDescription>
                        El pin azul es el lugar que resulta de la zona y las coordenadas UTM. Si la referencia es un enlace de Google Maps escrito por una persona, se ve también (pin rojo) para comparar.
                    </DialogDescription>
                </DialogHeader>

                {!utm && !propio ? (
                    <p className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                        Con la zona y las coordenadas ingresadas no se puede calcular una ubicación. Revise que la zona sea la correcta y que el norte tenga 7 dígitos y el este 6.
                    </p>
                ) : (
                    <div className="h-[380px] overflow-hidden rounded-md border border-border" data-testid="mapa-ubicacion">
                        <MapContainer center={puntos[0] ?? [-41.4, -72.9]} zoom={15} style={{ height: '100%', width: '100%' }}>
                            <BaseTiles />
                            <Encuadre puntos={puntos} />
                            {utm && <Marker position={[utm.lat, utm.lon]}><Popup>Según UTM<br />{utm.lat.toFixed(6)}, {utm.lon.toFixed(6)}</Popup></Marker>}
                            {propio && <Marker position={[propio.lat, propio.lon]} icon={iconoLink}><Popup>Según el enlace<br />{propio.lat.toFixed(6)}, {propio.lon.toFixed(6)}</Popup></Marker>}
                            {utm && propio && <Polyline positions={[[utm.lat, utm.lon], [propio.lat, propio.lon]]} pathOptions={{ color: '#e11d48', dashArray: '6 6', weight: 2 }} />}
                        </MapContainer>
                    </div>
                )}

                <div className="space-y-1 text-sm">
                    {utm && (
                        <p>
                            <span className="font-medium">Según UTM:</span> {utm.lat.toFixed(6)}, {utm.lon.toFixed(6)} (zona {zona}).{' '}
                            {utm.alReves && <span className="text-amber-600">El norte y el este estaban al revés; se calculó corrigiéndolos.</span>}
                        </p>
                    )}
                    {enlacePropio && estado === 'cargando' && <p className="text-muted-foreground">Leyendo el enlace de la referencia…</p>}
                    {propio && <p><span className="font-medium">Según el enlace:</span> {propio.lat.toFixed(6)}, {propio.lon.toFixed(6)}.</p>}
                    {enlacePropio && estado === 'error' && <p className="text-amber-600">No se pudo sacar una ubicación del enlace escrito en la referencia.</p>}
                    {distancia !== null && (
                        <p className={distancia > 500 ? 'font-medium text-destructive' : 'font-medium text-emerald-600'}>
                            Diferencia entre ambos: {formatoDistancia(distancia)}{distancia > 500 ? ' — revise cuál es el correcto.' : '.'}
                        </p>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    {utm && (
                        <Button type="button" variant="outline" onClick={() => window.open(utm.enlace, '_blank', 'noopener')}>
                            Abrir en Google Maps
                        </Button>
                    )}
                    <Button type="button" onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MapaUbicacionDialog;
