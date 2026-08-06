import { useEffect, useState } from 'react';
import { Box, Center, Loader, Text, SegmentedControl } from '@mantine/core';
import { useAuth } from '../../../contexts/AuthContext';
import { useTrackingStore } from '../../../store/trackingStore';
import { TrackingMapa } from '../components/TrackingMapa';
import { FlotaPanel } from '../components/FlotaPanel';
import { DetalleJornadaDrawer } from '../components/DetalleJornadaDrawer';
import { HistorialJornadasTab } from '../components/HistorialJornadasTab';
import { AlertasSinSenal } from '../components/AlertasSinSenal';

export function HoyEnVivoPage() {
    const { token } = useAuth();
    const [vista, setVista] = useState<'hoy' | 'historial'>('hoy');
    const {
        jornadas,
        loading,
        error,
        selectedMuestreadorId,
        fetchSnapshot,
        connectSocket,
        disconnectSocket,
        selectMuestreador,
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

    const jornadaSeleccionada = jornadas.find((j) => j.id_muestreador === selectedMuestreadorId) ?? null;

    return (
        <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>
            <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                <SegmentedControl
                    size="xs"
                    value={vista}
                    onChange={(v) => setVista(v as 'hoy' | 'historial')}
                    data={[
                        { label: 'Hoy', value: 'hoy' },
                        { label: 'Historial', value: 'historial' },
                    ]}
                />
            </Box>

            {vista === 'historial' ? (
                <HistorialJornadasTab />
            ) : loading && jornadas.length === 0 ? (
                <Center style={{ flex: 1 }}>
                    <Loader />
                </Center>
            ) : error ? (
                <Center style={{ flex: 1 }}>
                    <Text c="red">{error}</Text>
                </Center>
            ) : (
                <>
                    <AlertasSinSenal jornadas={jornadas} />
                    <Box style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                        <FlotaPanel
                            jornadas={jornadas}
                            selectedMuestreadorId={selectedMuestreadorId}
                            onSelectMuestreador={selectMuestreador}
                        />
                        <Box style={{ flex: 1, position: 'relative' }}>
                            <TrackingMapa
                                jornadas={jornadas}
                                selectedMuestreadorId={selectedMuestreadorId}
                                onSelectMuestreador={selectMuestreador}
                            />
                        </Box>
                        <DetalleJornadaDrawer
                            jornada={jornadaSeleccionada}
                            opened={selectedMuestreadorId !== null}
                            onClose={() => selectMuestreador(null)}
                        />
                    </Box>
                </>
            )}
        </Box>
    );
}
