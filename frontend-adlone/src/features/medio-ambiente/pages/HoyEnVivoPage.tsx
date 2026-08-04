import { useEffect } from 'react';
import { Box, Center, Loader, Text } from '@mantine/core';
import { useAuth } from '../../../contexts/AuthContext';
import { useTrackingStore } from '../../../store/trackingStore';
import { TrackingMapa } from '../components/TrackingMapa';
import { FlotaPanel } from '../components/FlotaPanel';
import { DetalleJornadaDrawer } from '../components/DetalleJornadaDrawer';

export function HoyEnVivoPage() {
    const { token } = useAuth();
    const {
        jornadas,
        loading,
        error,
        selectedJornadaId,
        fetchSnapshot,
        connectSocket,
        disconnectSocket,
        selectJornada,
        reset,
    } = useTrackingStore();

    useEffect(() => {
        fetchSnapshot();
        // El socket solo actualiza `ultima_posicion` (ver trackingStore.ts) —
        // horas_trabajadas_minutos, km_recorridos, y la aparición de jornadas
        // NUEVAS iniciadas después de abrir esta pantalla dependen de volver a
        // pedir el snapshot completo. 60s es suficiente para que esos datos no
        // se sientan desactualizados sin generar tráfico excesivo.
        const id = setInterval(fetchSnapshot, 60_000);
        return () => clearInterval(id);
    }, [fetchSnapshot]);

    useEffect(() => {
        if (!token) return;
        connectSocket(token);
        // Al desmontar (navegar fuera de "Hoy en Vivo"), además de cerrar el
        // socket, se limpia el estado de jornadas/selección/error. Sin esto,
        // un remount mostraría de inmediato las posiciones de la sesión
        // anterior (potencialmente desactualizadas) sin indicador de carga,
        // porque el gate de loading exige jornadas.length === 0.
        return () => {
            disconnectSocket();
            reset();
        };
    }, [token, connectSocket, disconnectSocket, reset]);

    const jornadaSeleccionada = jornadas.find((j) => j.id_jornada === selectedJornadaId) ?? null;

    if (loading && jornadas.length === 0) {
        return (
            <Center style={{ height: '100%' }}>
                <Loader />
            </Center>
        );
    }

    if (error) {
        return (
            <Center style={{ height: '100%' }}>
                <Text c="red">{error}</Text>
            </Center>
        );
    }

    return (
        <Box style={{ display: 'flex', height: '100%', minHeight: 500 }}>
            <FlotaPanel
                jornadas={jornadas}
                selectedJornadaId={selectedJornadaId}
                onSelectJornada={selectJornada}
            />
            <Box style={{ flex: 1, position: 'relative' }}>
                <TrackingMapa
                    jornadas={jornadas}
                    selectedJornadaId={selectedJornadaId}
                    onSelectJornada={selectJornada}
                />
            </Box>
            <DetalleJornadaDrawer
                jornada={jornadaSeleccionada}
                opened={selectedJornadaId !== null}
                onClose={() => selectJornada(null)}
            />
        </Box>
    );
}
