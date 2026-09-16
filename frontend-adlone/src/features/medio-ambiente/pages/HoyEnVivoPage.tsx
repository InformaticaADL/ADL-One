import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useTrackingStore } from '../../../store/trackingStore';
import { TrackingMapa } from '../components/TrackingMapa';
import { FlotaPanel } from '../components/FlotaPanel';
import { DetalleJornadaDrawer } from '../components/DetalleJornadaDrawer';
import { HistorialJornadasTab } from '../components/HistorialJornadasTab';
import { AlertasSinSenal } from '../components/AlertasSinSenal';
import { AvisoNuevaJornada } from '../components/AvisoNuevaJornada';

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
        <div className="shadcn-scope flex h-full min-h-0 flex-col">
            <div className="flex gap-1 border-b border-border p-3">
                {(
                    [
                        { label: 'Hoy', value: 'hoy' as const },
                        { label: 'Historial', value: 'historial' as const },
                    ]
                ).map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setVista(opt.value)}
                        className={cn(
                            'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                            vista === opt.value ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {vista === 'historial' ? (
                <HistorialJornadasTab />
            ) : loading && jornadas.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : error ? (
                <div className="flex flex-1 items-center justify-center">
                    <span className="text-destructive">{error}</span>
                </div>
            ) : (
                <>
                    <AlertasSinSenal jornadas={jornadas} />
                    <div className="flex min-h-0 flex-1">
                        <FlotaPanel
                            jornadas={jornadas}
                            selectedMuestreadorId={selectedMuestreadorId}
                            onSelectMuestreador={selectMuestreador}
                        />
                        <div className="relative flex-1">
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
