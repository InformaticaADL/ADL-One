import { useEffect } from 'react';
import { Paper, Text, Group, ThemeIcon } from '@mantine/core';
import { IconPlayerPlay } from '@tabler/icons-react';
import { useTrackingStore } from '../../../store/trackingStore';

const DURACION_MS = 6_000;

// Toast efímero propio de esta pantalla (no se instaló @mantine/notifications
// — no se usa en ningún otro lado de ADL ONE todavía, y esto es lo único que
// lo necesita por ahora). Se posiciona fijo arriba a la derecha del mapa, se
// autodescarta solo después de DURACION_MS.
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
        <Paper
            key={avisoJornadaIniciada.id}
            shadow="md"
            radius="md"
            p="sm"
            withBorder
            style={{
                position: 'absolute',
                top: 16,
                right: 16,
                zIndex: 1000,
                maxWidth: 320,
                backgroundColor: 'var(--mantine-color-body)',
            }}
        >
            <Group gap="xs" wrap="nowrap">
                <ThemeIcon color="green" variant="light" radius="xl" size={28}>
                    <IconPlayerPlay size={14} />
                </ThemeIcon>
                <Text size="sm">
                    <strong>{avisoJornadaIniciada.nombreMuestreador}</strong> ha iniciado su ruta
                </Text>
            </Group>
        </Paper>
    );
}
