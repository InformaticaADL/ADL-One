import { useEffect } from 'react';
import { Typography } from 'antd';
import { IconPlayerPlay } from '@tabler/icons-react';
import { useTrackingStore } from '../../../store/trackingStore';

const { Text } = Typography;
const DURACION_MS = 6_000;

// Toast efímero propio de esta pantalla — se posiciona fijo arriba a la
// derecha del mapa, se autodescarta solo después de DURACION_MS.
export function AvisoNuevaJornada() {
    const avisoJornadaIniciada = useTrackingStore((s) => s.avisoJornadaIniciada);
    const limpiarAvisoJornadaIniciada = useTrackingStore((s) => s.limpiarAvisoJornadaIniciada);

    useEffect(() => {
        if (!avisoJornadaIniciada) return;
        const id = setTimeout(limpiarAvisoJornadaIniciada, DURACION_MS);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [avisoJornadaIniciada?.id]);

    if (!avisoJornadaIniciada) return null;

    return (
        <div
            key={avisoJornadaIniciada.id}
            style={{
                position: 'absolute',
                top: 16,
                right: 16,
                zIndex: 1000,
                maxWidth: 320,
                padding: 12,
                borderRadius: 10,
                border: '1px solid var(--app-border)',
                backgroundColor: 'var(--app-bg-elevated)',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
            }}
        >
            <div style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(47,158,68,0.15)', color: '#2f9e44',
            }}>
                <IconPlayerPlay size={14} />
            </div>
            <Text style={{ fontSize: 13 }}>
                <strong>{avisoJornadaIniciada.nombreMuestreador}</strong> ha iniciado su ruta
            </Text>
        </div>
    );
}
