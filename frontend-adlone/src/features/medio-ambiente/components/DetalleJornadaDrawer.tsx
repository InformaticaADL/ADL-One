import { useEffect, useState, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { IconCheck, IconClock, IconMapPin, IconFlagCheck, IconPlayerPause, IconBattery2, IconX } from '@tabler/icons-react';
import { Sheet, SheetPortal, SheetOverlay, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Timeline } from '@/components/ui/timeline';
import { cn } from '@/lib/utils';
import type { JornadaHoy } from '../services/tracking.service';
import { fichaCompletada, tipoVisitaHoy, contarFichasCompletadas } from '../utils/fichaHoyHelpers';

// Mientras la jornada sigue activa ('en_ruta'), "Tiempo de ruta" se
// recalcula en vivo contra fecha_inicio en vez de mostrar el valor fijo del
// último snapshot: horas_trabajadas_minutos llega del backend en cada fetch
// (cada 60s, ver HoyEnVivoPage.tsx), pero entre un fetch y otro igual
// queremos que el contador avance visualmente. 'pausada' y 'finalizada' ya
// no avanzan — se muestra el total fijo que vino calculado del backend (para
// 'pausada' es la suma de los tramos ya cerrados, sin contar la pausa).
function formatearMinutos(totalMin: number): string {
    const min = Math.max(0, Math.floor(totalMin));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatearHorasTrabajadas(jornada: JornadaHoy): string {
    if (jornada.estado !== 'en_ruta') return formatearMinutos(jornada.horas_trabajadas_minutos);
    // horas_trabajadas_cerradas_minutos (tramos YA cerrados) + minutos desde
    // que empezó el tramo ACTIVO — antes se calculaba desde jornada.
    // fecha_inicio (el inicio del PRIMER tramo del día), así que una pausa de
    // almuerzo se sumaba como si fuera trabajo hasta el próximo fetch del
    // snapshot (cada 60s), donde el número "saltaba" hacia abajo de golpe.
    const inicioTramoActual = jornada.fecha_inicio_tramo_actual ?? jornada.fecha_inicio;
    const msTramoActual = Date.now() - new Date(inicioTramoActual).getTime();
    return formatearMinutos(jornada.horas_trabajadas_cerradas_minutos + msTramoActual / 60000);
}

interface DetalleJornadaDrawerProps {
    jornada: JornadaHoy | null;
    opened: boolean;
    onClose: () => void;
}

// Leaflet dibuja sus propios panes internos (tiles, overlays, markers,
// tooltips, popups) con z-index hasta 700 dentro del propio MapContainer, y
// ese MapContainer no crea un nuevo stacking context — así que sin fijar el
// z-index del overlay/contenido del drawer explícitamente por encima (los
// z-[300] por defecto de <SheetContent>), el mapa terminaría visualmente
// delante del drawer en vez de detrás. Por eso este archivo arma el sheet a
// mano con los building blocks de sheet.tsx en vez de <SheetContent>, para
// poder subir el z-index del overlay también (no solo el del panel).
const DRAWER_Z_INDEX = 'z-[1000]';

function DrawerContent({ children }: { children: ReactNode }) {
    return (
        <SheetPortal>
            <SheetOverlay className={DRAWER_Z_INDEX} />
            <DialogPrimitive.Content
                className={cn(
                    'shadcn-scope fixed inset-y-0 right-0 flex h-full w-[380px] max-w-[380px] flex-col gap-4 overflow-y-auto border-l border-border bg-card p-6 shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-300',
                    DRAWER_Z_INDEX
                )}
            >
                {children}
                <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                    <IconX className="h-4 w-4" />
                    <span className="sr-only">Cerrar</span>
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </SheetPortal>
    );
}

export function DetalleJornadaDrawer({ jornada, opened, onClose }: DetalleJornadaDrawerProps) {
    // Fuerza un re-render cada 30s para que "Tiempo de ruta" avance en vivo
    // entre un fetch del snapshot y el siguiente (mismo patrón que
    // FlotaPanel.tsx usa para su badge de estado/tiempo relativo). No hace
    // nada útil si la jornada ya no está 'en_ruta' (el valor es fijo), pero
    // tampoco molesta — se limpia igual al desmontar.
    const [, forceTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => forceTick((t) => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    const handleOpenChange = (next: boolean) => {
        if (!next) onClose();
    };

    if (!jornada) {
        return (
            <Sheet open={opened} onOpenChange={handleOpenChange}>
                <DrawerContent>
                    <SheetHeader>
                        <SheetTitle>Detalle</SheetTitle>
                    </SheetHeader>
                </DrawerContent>
            </Sheet>
        );
    }

    const indiceActivo = jornada.fichas_hoy.findIndex((f) => !fichaCompletada(f));
    const { completadas, total } = contarFichasCompletadas(jornada.fichas_hoy);
    const enRuta = jornada.estado === 'en_ruta';
    const pausada = jornada.estado === 'pausada';
    const finalizada = jornada.estado === 'finalizada';
    const tieneBateria = jornada.bateria_inicio != null && jornada.bateria_fin != null;

    return (
        <Sheet open={opened} onOpenChange={handleOpenChange}>
            <DrawerContent>
                <SheetHeader>
                    <SheetTitle>{jornada.nombre_muestreador}</SheetTitle>
                </SheetHeader>

                <div className="mb-4">
                    {pausada ? (
                        <Badge variant="warning" className="gap-1">
                            <IconPlayerPause size={12} />
                            En pausa
                        </Badge>
                    ) : finalizada ? (
                        <Badge variant="default" className="gap-1">
                            <IconFlagCheck size={12} />
                            Día finalizado
                        </Badge>
                    ) : (
                        <Badge variant={jornada.ultima_posicion ? 'success' : 'outline'} className="gap-1">
                            <IconMapPin size={12} />
                            {jornada.ultima_posicion ? 'En ruta' : 'Sin posición'}
                        </Badge>
                    )}
                </div>

                {!enRuta && (
                    <p className="mb-4 text-sm font-semibold text-foreground">
                        {completadas}/{total} ficha{total === 1 ? '' : 's'} completada{completadas === 1 ? '' : 's'}
                    </p>
                )}

                <div className="mb-4 grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-xs text-muted-foreground">Fichas hoy</span>
                        <p className="m-0 font-semibold text-foreground">{jornada.fichas_hoy.length}</p>
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground">Inicio jornada</span>
                        <p className="m-0 font-semibold text-foreground">
                            {new Date(jornada.fecha_inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {!enRuta && jornada.fecha_fin && (
                            <>
                                <span className="mt-1 block text-xs text-muted-foreground">{pausada ? 'Pausado a las' : 'Término jornada'}</span>
                                <p className="m-0 font-semibold text-foreground">
                                    {new Date(jornada.fecha_fin).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </>
                        )}
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground">Tiempo de ruta</span>
                        <p className="m-0 font-semibold text-foreground">{formatearHorasTrabajadas(jornada)}</p>
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground">Km recorridos</span>
                        <p className="m-0 font-semibold text-foreground">{jornada.km_recorridos.toFixed(1)} km</p>
                    </div>
                    {tieneBateria && (
                        <div>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <IconBattery2 size={12} />
                                Batería
                            </span>
                            <p className="m-0 font-semibold text-foreground">{jornada.bateria_inicio}% → {jornada.bateria_fin}%</p>
                        </div>
                    )}
                </div>

                <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">Itinerario de hoy</p>

                {jornada.fichas_hoy.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin fichas agendadas hoy.</p>
                ) : (
                    <Timeline
                        items={jornada.fichas_hoy.map((ficha) => {
                            const completada = fichaCompletada(ficha);
                            const activa = jornada.fichas_hoy.indexOf(ficha) < (indiceActivo === -1 ? jornada.fichas_hoy.length : indiceActivo);
                            return {
                                key: ficha.id_agendamam,
                                dot: (
                                    <div
                                        className={cn(
                                            'flex h-5 w-5 items-center justify-center rounded-full text-white',
                                            activa || completada ? 'bg-primary' : 'bg-border text-muted-foreground'
                                        )}
                                    >
                                        {completada ? <IconCheck size={11} /> : <IconClock size={11} />}
                                    </div>
                                ),
                                content: (
                                    <div>
                                        <div className="flex flex-nowrap items-center gap-1.5">
                                            <span className="text-[13px] font-semibold text-foreground">{ficha.frecuencia_correlativo}</span>
                                            <Badge variant={completada ? 'success' : 'default'} className="text-[11px]">
                                                {tipoVisitaHoy(ficha)}
                                            </Badge>
                                        </div>
                                        <span className="mb-0.5 block text-xs text-muted-foreground">
                                            {completada ? 'Completada' : 'Pendiente'} · {ficha.hora_coordinador || '—'}
                                            {ficha.tiempo_trabajo_minutos != null && ` · ${formatearMinutos(ficha.tiempo_trabajo_minutos)} en terreno`}
                                        </span>
                                        {/* Promedio histórico por objetivo de muestreo (ver
                                            getSnapshotHoy en tracking.service.js) — null hasta que
                                            se acumulen al menos 3 fichas completadas con ese mismo
                                            objetivo, para no mostrar un "esperado" basado en 1-2
                                            muestras. Se muestra aunque la ficha siga pendiente, como
                                            referencia de cuánto suele tomar. */}
                                        {ficha.tiempo_estimado_minutos != null && (
                                            <span className="mb-0.5 block text-xs text-muted-foreground">
                                                Esperado: ≈{formatearMinutos(ficha.tiempo_estimado_minutos)} (promedio histórico)
                                                {ficha.tiempo_trabajo_minutos != null && ficha.tiempo_trabajo_minutos > ficha.tiempo_estimado_minutos * 1.3 && (
                                                    <span className="font-semibold text-warning"> · sobre lo esperado</span>
                                                )}
                                            </span>
                                        )}
                                        {ficha.empresa && <span className="block text-xs text-foreground">Empresa: {ficha.empresa}</span>}
                                        {ficha.centro && <span className="block text-xs text-foreground">Centro: {ficha.centro}</span>}
                                        {ficha.objetivo && <span className="block text-xs text-foreground">Objetivo: {ficha.objetivo}</span>}
                                    </div>
                                ),
                            };
                        })}
                    />
                )}
            </DrawerContent>
        </Sheet>
    );
}
