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
    } = useTrackingStore();

    useEffect(() => {
        fetchSnapshot();
    }, [fetchSnapshot]);

    useEffect(() => {
        if (!token) return;
        connectSocket(token);
        return () => disconnectSocket();
    }, [token, connectSocket, disconnectSocket]);

    const jornadaSeleccionada = jornadas.find((j) => j.id_jornada === selectedJornadaId) ?? null;

    if (loading && jornadas.length === 0) {
        return (
            <Center style={{ height: 'calc(100vh - 180px)' }}>
                <Loader />
            </Center>
        );
    }

    if (error) {
        return (
            <Center style={{ height: 'calc(100vh - 180px)' }}>
                <Text c="red">{error}</Text>
            </Center>
        );
    }

    return (
        <Box style={{ display: 'flex', height: 'calc(100vh - 180px)', minHeight: 500 }}>
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
