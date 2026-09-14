import { useEffect, useState } from 'react';
import { Spin, Typography, Segmented } from 'antd';
import { useAuth } from '../../../contexts/AuthContext';
import { useTrackingStore } from '../../../store/trackingStore';
import { TrackingMapa } from '../components/TrackingMapa';
import { FlotaPanel } from '../components/FlotaPanel';
import { DetalleJornadaDrawer } from '../components/DetalleJornadaDrawer';
import { HistorialJornadasTab } from '../components/HistorialJornadasTab';
import { AlertasSinSenal } from '../components/AlertasSinSenal';
import { AvisoNuevaJornada } from '../components/AvisoNuevaJornada';

const { Text } = Typography;

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
        // El evento 'jornada_iniciada' del socket (ver trackingStore.ts) ya
        // dispara un fetchSnapshot() apenas alguien arranca una ruta nueva, así
        // que este poll de 60s es un respaldo — cubre horas_trabajadas_minutos/
        // km_recorridos (que solo se recalculan en el snapshot completo, no
        // vía socket) y cualquier evento que se haya perdido por una
        // desconexión momentánea del socket.
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>
            <div style={{ padding: 12, borderBottom: '1px solid var(--app-border)' }}>
                <Segmented
                    size="small"
                    value={vista}
                    onChange={(v) => setVista(v as 'hoy' | 'historial')}
                    options={[
                        { label: 'Hoy', value: 'hoy' },
                        { label: 'Historial', value: 'historial' },
                    ]}
                />
            </div>

            {vista === 'historial' ? (
                <HistorialJornadasTab />
            ) : loading && jornadas.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin />
                </div>
            ) : error ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text type="danger">{error}</Text>
                </div>
            ) : (
                <>
                    <AlertasSinSenal jornadas={jornadas} />
                    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                        <FlotaPanel
                            jornadas={jornadas}
                            selectedMuestreadorId={selectedMuestreadorId}
                            onSelectMuestreador={selectMuestreador}
                        />
                        <div style={{ flex: 1, position: 'relative' }}>
                            <TrackingMapa
                                jornadas={jornadas}
                                selectedMuestreadorId={selectedMuestreadorId}
                                onSelectMuestreador={selectMuestreador}
                            />
                            <AvisoNuevaJornada />
                        </div>
                        <DetalleJornadaDrawer
                            jornada={jornadaSeleccionada}
                            opened={selectedMuestreadorId !== null}
                            onClose={() => selectMuestreador(null)}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
