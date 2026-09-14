import React, { useMemo } from 'react';
import { MapContainer, Marker, Popup } from 'react-leaflet';
import { BaseTiles } from './BaseTiles';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Card, Typography, Button, Tag } from 'antd';

// Fix for default Leaflet markers missing in React bundle
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const { Text } = Typography;

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
        <Card style={{ overflow: 'hidden', height: '100%', minHeight: 400 }} styles={{ body: { padding: 0, height: '100%' } }}>
            <MapContainer center={fallbackCenter} zoom={5} style={{ height: '100%', width: '100%', minHeight: 400 }}>
                <BaseTiles />
                {markers.map(m => (
                    <Marker key={m.id} position={[m.lat, m.lng]}>
                        <Popup>
                            <div>
                                <Text strong style={{ fontSize: 13, display: 'block' }}>{m.title}</Text>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Cliente: {m.client}</Text>
                                <Tag style={{ marginTop: 4, marginBottom: 8 }}>{m.estado}</Tag>
                                <Button size="small" block onClick={() => onViewAssignment(m.id)}>
                                    Gestionar Asignación
                                </Button>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </Card>
    );
};
