import { IconSearch } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { JornadaHoy } from '../services/tracking.service';
import { colorPorMuestreador, inicialesDe } from '../utils/colorMuestreador';
import { contarFichasCompletadas, siguienteFichaPendiente, distanciaKm } from '../utils/fichaHoyHelpers';

interface FlotaPanelProps {
    jornadas: JornadaHoy[];
    selectedMuestreadorId: number | null;
    onSelectMuestreador: (id: number) => void;
}

const UMBRAL_SIN_SENAL_MS = 10 * 60 * 1000; // 10 minutos, per diseño "Hoy en Vivo"

function estadoDeJornada(jornada: JornadaHoy): { label: string; variant: 'success' | 'warning' | 'default' | 'outline' } {
    if (jornada.estado === 'pausada') return { label: 'En pausa', variant: 'warning' };
    if (jornada.estado === 'finalizada') return { label: 'Día finalizado', variant: 'default' };
    if (!jornada.ultima_posicion) return { label: 'Sin posición', variant: 'outline' };
    const msDesdeUltimoPing = Date.now() - new Date(jornada.ultima_posicion.timestamp_reporte).getTime();
    if (msDesdeUltimoPing > UMBRAL_SIN_SENAL_MS) return { label: 'Sin señal', variant: 'outline' };
    return { label: 'En ruta', variant: 'success' };
}

function tiempoRelativo(fechaIso: string): string {
    const segundos = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 1000);
    if (segundos < 60) return `hace ${segundos}s`;
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    return `hace ${horas} h`;
}

export function FlotaPanel({ jornadas, selectedMuestreadorId, onSelectMuestreador }: FlotaPanelProps) {
    const [busqueda, setBusqueda] = useState('');

    // Fuerza un re-render cada 15s para que estadoDeJornada/tiempoRelativo se
    // reevalúen aunque no llegue ningún evento nuevo por socket — sin esto, un
    // muestreador sin pings nuevos se queda "En ruta" para siempre en vez de
    // pasar a "Sin señal" al cruzar el umbral de 10 minutos.
    const [, forceTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => forceTick((t) => t + 1), 15_000);
        return () => clearInterval(id);
    }, []);

    const jornadasFiltradas = useMemo(
        () => jornadas.filter((j) => j.nombre_muestreador.toLowerCase().includes(busqueda.toLowerCase())),
        [jornadas, busqueda]
    );

    return (
        <div className="shadcn-scope flex h-full w-[280px] flex-col border-r border-border">
            <div className="p-3">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-foreground">Hoy en vivo</span>
                    <Badge variant="secondary">
                        {jornadas.filter((j) => j.estado === 'en_ruta').length} en terreno
                    </Badge>
                </div>
                <div className="relative">
                    <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar muestreador..."
                        className="h-8 pl-8 text-sm"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 pt-0">
                <div className="flex flex-col gap-2">
                    {jornadasFiltradas.length === 0 && (
                        <p className="mt-4 text-center text-[13px] text-muted-foreground">
                            No hay muestreadores en terreno en este momento.
                        </p>
                    )}
                    {jornadasFiltradas.map((j) => {
                        const estado = estadoDeJornada(j);
                        const seleccionada = j.id_muestreador === selectedMuestreadorId;
                        return (
                            <button
                                key={j.id_muestreador}
                                onClick={() => onSelectMuestreador(j.id_muestreador)}
                                className={cn(
                                    'w-full rounded-lg border p-2 text-left',
                                    seleccionada ? 'border-primary bg-accent' : 'border-border bg-transparent'
                                )}
                            >
                                {/* Sin truncate ni nowrap a propósito: un nombre largo o el
                                    label "Día finalizado" terminaban cortados en "..." al
                                    forzarlos a compartir una sola línea angosta. Se prefiere
                                    que la card crezca en alto antes que recortar texto. */}
                                <div className="mb-1 flex flex-nowrap items-start gap-2">
                                    <span
                                        className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                        style={{ backgroundColor: colorPorMuestreador(j.id_muestreador) }}
                                    >
                                        {inicialesDe(j.nombre_muestreador)}
                                    </span>
                                    <span className="flex-1 text-[13px] font-semibold text-foreground">{j.nombre_muestreador}</span>
                                </div>
                                <Badge variant={estado.variant} className="mb-1">
                                    {estado.label}
                                </Badge>
                                <span className="block text-xs text-muted-foreground">
                                    {j.estado !== 'en_ruta'
                                        ? (() => {
                                              const { completadas, total } = contarFichasCompletadas(j.fichas_hoy);
                                              return `${completadas}/${total} completadas`;
                                          })()
                                        : `${j.fichas_hoy.length} ficha(s) hoy`}
                                    {/* "última señal", no "act." — la abreviatura se prestaba a
                                        leerse como "estuvo activo/moviéndose en esos segundos"; es
                                        solo hace cuánto llegó el último ping GPS, se mueva o no. */}
                                    {j.estado === 'en_ruta' && j.ultima_posicion && ` · última señal ${tiempoRelativo(j.ultima_posicion.timestamp_reporte)}`}
                                </span>
                                {/* Distancia en línea recta a la próxima ficha pendiente — no
                                    es ruta real por calle (no hay motor de ruteo acá), pero le
                                    da al supervisor una idea de "qué tan cerca está" sin tener
                                    que abrir el drawer de detalle. Solo mientras está en_ruta y
                                    hay posición + ficha con coordenadas resueltas. */}
                                {j.estado === 'en_ruta' && j.ultima_posicion && (() => {
                                    const siguiente = siguienteFichaPendiente(j.fichas_hoy);
                                    if (!siguiente) return null;
                                    const dist = distanciaKm(
                                        { lat: j.ultima_posicion.latitud, lon: j.ultima_posicion.longitud },
                                        { lat: Number(siguiente.ubicacion_lat), lon: Number(siguiente.ubicacion_lon) }
                                    );
                                    return (
                                        <span className="mt-0.5 block text-xs text-primary">
                                            {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`} a {siguiente.centro || 'la próxima ficha'}
                                        </span>
                                    );
                                })()}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
