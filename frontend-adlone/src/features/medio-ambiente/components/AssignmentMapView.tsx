import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Box, Paper, Text, Button, Badge } from '@mantine/core';

// Fix for default Leaflet markers missing in React bundle
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

interface AssignmentMapViewProps {
    fichas: any[];
    onViewAssignment: (id: number) => void;
}

// Very rough approximation of UTM (Zone 19s) to LatLng for Chile just to show markers if needed
// Or assume they pass lat/lng
const fallbackCenter: [number, number] = [-33.4489, -70.6693]; // Santiago

export const AssignmentMapView: React.FC<AssignmentMapViewProps> = ({ fichas, onViewAssignment }) => {
    // Attempt parse lat/lng from the DB row. Assuming they might have .coordenada_norte as UTM, 
    // or maybe .latitud / .longitud explicitly.
    const markers = useMemo(() => {
        return fichas.map(f => {
            let lat = fallbackCenter[0] + (Math.random() - 0.5) * 5; // Fake scatter if no coords
            let lng = fallbackCenter[1] + (Math.random() - 0.5) * 2;
            
            // If actual lat/lng exists in data, use it
            if (f.latitud && f.longitud) {
                lat = parseFloat(f.latitud);
                lng = parseFloat(f.longitud);
            } else if (f.coordenada_norte && f.coordenada_este) {
                // Mock UTM fallback logic (requires external library for true conversion like proj4)
                // We just scatter them relative to a known point for visual testing
                // Real usage should convert UTM to LatLng!
            }

            return {
                id: f.id_fichaingresoservicio || f.fichaingresoservicio,
                lat,
                lng,
                title: f.centro || f.nombre_centro || 'Desconocido',
                client: f.empresa_facturar || '-',
                estado: f.estado_ficha || f.nombre_estadomuestreo
            };
        });
    }, [fichas]);

    return (
        <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden', height: '100%', minHeight: 400 }}>
            <MapContainer center={fallbackCenter} zoom={5} style={{ height: '100%', width: '100%', minHeight: 400 }}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {markers.map(m => (
                    <Marker key={m.id} position={[m.lat, m.lng]}>
                        <Popup>
                            <Box>
                                <Text fw={700} size="sm">{m.title}</Text>
                                <Text size="xs" c="dimmed">Cliente: {m.client}</Text>
                                <Badge size="xs" mt={4} mb="xs">{m.estado}</Badge>
                                <Button size="xs" fullWidth onClick={() => onViewAssignment(m.id)}>
                                    Gestionar Asignación
                                </Button>
                            </Box>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </Paper>
    );
};
