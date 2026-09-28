import { useEffect, useMemo, useState } from 'react';
import { IconActivity, IconAlertTriangle, IconFlagCheck, IconList, IconMap, IconPlayerPause } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { PageHeader } from '../../../components/layout/PageHeader';
import { StatCard } from '../../../components/common/StatCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useTrackingStore } from '../../../store/trackingStore';
import { TrackingMapa } from '../components/TrackingMapa';
import { FlotaPanel } from '../components/FlotaPanel';
import { DetalleJornadaDrawer } from '../components/DetalleJornadaDrawer';
import { HistorialJornadasTab } from '../components/HistorialJornadasTab';
import { AlertasSinSenal } from '../components/AlertasSinSenal';
import { estaSinSenal } from '../utils/fichaHoyHelpers';
import { AvisoNuevaJornada } from '../components/AvisoNuevaJornada';

export function HoyEnVivoPage() {
    const { token } = useAuth();
    const [vista, setVista] = useState<'hoy' | 'historial'>('hoy');
    // En celular no caben lista y mapa lado a lado: se muestra uno a la vez
    // con un alternador. El mapa se desmonta al pasar a "Lista" (en vez de
    // ocultarlo con display:none) porque Leaflet no recalcula su tamaño al
    // volver a ser visible y quedaría con tiles grises a medio pintar;
    // CentradorMapa lo vuelve a encuadrar al montarse.
    const isMobile = useMediaQuery('(max-width: 768px)');
    const [panelMovil, setPanelMovil] = useState<'lista' | 'mapa'>('lista');
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

    const stats = useMemo(() => ({
        enRuta: jornadas.filter((j) => j.estado === 'en_ruta').length,
        sinSenal: jornadas.filter(estaSinSenal).length,
        pausadas: jornadas.filter((j) => j.estado === 'pausada').length,
        finalizadas: jornadas.filter((j) => j.estado === 'finalizada').length,
    }), [jornadas]);

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
            <div className={cn('border-b border-border pt-3', isMobile ? 'px-3' : 'px-4')}>
                <PageHeader
                    title="Hoy en Vivo"
                    subtitle="Seguimiento en tiempo real de muestreadores en terreno."
                    centerOnMobile
                    rightSection={
                        <div className="flex gap-1 rounded-lg bg-muted p-1">
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
                                        vista === opt.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    }
                />

                {/* En celular los 4 KPIs van siempre en una sola fila (flex-nowrap
                    + basis-0 en cada tarjeta): apilados se comían toda la pantalla
                    y empujaban el mapa/lista fuera de vista. En escritorio siguen
                    pudiendo envolverse. */}
                {vista === 'hoy' && !loading && !error && (
                    <div className={cn(isMobile ? 'mb-3 flex flex-nowrap gap-1.5' : 'mb-4 flex flex-wrap gap-2')}>
                        <StatCard compact={isMobile} icon={<IconActivity size={isMobile ? 15 : 18} />} label="En terreno" value={stats.enRuta} tone="primary" />
                        <StatCard compact={isMobile} icon={<IconAlertTriangle size={isMobile ? 15 : 18} />} label="Sin señal" value={stats.sinSenal} tone="warning" />
                        <StatCard compact={isMobile} icon={<IconPlayerPause size={isMobile ? 15 : 18} />} label="En pausa" value={stats.pausadas} tone="muted" />
                        <StatCard compact={isMobile} icon={<IconFlagCheck size={isMobile ? 15 : 18} />} label="Finalizados" value={stats.finalizadas} tone="success" />
                    </div>
                )}

                {vista === 'hoy' && isMobile && !loading && !error && (
                    <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                        {(
                            [
                                { label: 'Lista', value: 'lista' as const, icon: <IconList size={15} /> },
                                { label: 'Mapa', value: 'mapa' as const, icon: <IconMap size={15} /> },
                            ]
                        ).map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setPanelMovil(opt.value)}
                                className={cn(
                                    'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors',
                                    panelMovil === opt.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                                )}
                            >
                                {opt.icon}
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
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
                    <div className="relative flex min-h-0 flex-1">
                        {/* En celular el aviso va a nivel del contenedor (no dentro del
                            mapa) para que se vea también mientras se mira la lista. */}
                        {isMobile && <AvisoNuevaJornada />}
                        {(!isMobile || panelMovil === 'lista') && (
                            <FlotaPanel
                                jornadas={jornadas}
                                selectedMuestreadorId={selectedMuestreadorId}
                                onSelectMuestreador={selectMuestreador}
                                fullWidth={isMobile}
                            />
                        )}
                        {(!isMobile || panelMovil === 'mapa') && (
                            <div className="relative flex-1">
                                <TrackingMapa
                                    jornadas={jornadas}
                                    selectedMuestreadorId={selectedMuestreadorId}
                                    onSelectMuestreador={selectMuestreador}
                                />
                                {!isMobile && <AvisoNuevaJornada />}
                            </div>
                        )}
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
